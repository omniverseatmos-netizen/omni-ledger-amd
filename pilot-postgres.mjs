import { PersistenceError } from './pilot-persistence.mjs';
import { persistNormalizedSnapshot } from './normalized-postgres.mjs';

// PostgreSQL snapshot store with the same interface as PilotStore:
// load(), read(), transaction(fn), close().
// 'pg' is loaded dynamically so file mode remains usable on a phone; the
// package is nevertheless pinned for reproducible PostgreSQL deployments.
const RETRYABLE = new Set(['40001', '40P01']); // serialization failure, deadlock

export class PostgresPilotStore {
  constructor({ connectionString, pool, tenantId = 'default', initialState = {}, clock = () => new Date(),
    lockTimeoutMs = 3000, statementTimeoutMs = 15000, maxRetries = 3, poolSize = 10,
    normalized = process.env.NORMALIZED_REPOSITORY === '1' } = {}) {
    if (!pool && !connectionString) throw new PersistenceError('DATABASE_URL_REQUIRED', 'connectionString or pool is required.', 500);
    Object.assign(this, { connectionString, tenantId, clock, lockTimeoutMs, statementTimeoutMs, maxRetries, poolSize, normalized });
    this.initialState = structuredClone(initialState); this.pool = pool || null; this.ready = null;
  }
  async _pool() {
    if (this.pool) return this.pool;
    let mod;
    try { mod = await import('pg'); }
    catch { throw new PersistenceError('PG_NOT_INSTALLED', "Package 'pg' is not installed. Run: npm ci", 500); }
    const Pool = (mod.default || mod).Pool;
    this.pool = new Pool({ connectionString: this.connectionString, max: this.poolSize });
    return this.pool;
  }
  async load() {
    if (!this.ready) this.ready = (async () => {
      const pool = await this._pool();
      await pool.query('INSERT INTO pilot_state (tenant_id, version, state) VALUES ($1, 0, $2::jsonb) ON CONFLICT (tenant_id) DO NOTHING',
        [this.tenantId, JSON.stringify(this.initialState)]);
    })().catch(error => { this.ready = null; throw error; });
    return this.ready;
  }
  async read() {
    await this.load();
    const { rows } = await (await this._pool()).query('SELECT state, version FROM pilot_state WHERE tenant_id = $1', [this.tenantId]);
    if (!rows.length) return structuredClone(this.initialState);
    const state = typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state;
    state.meta = { ...(state.meta || {}), version: Number(rows[0].version) };
    return state;
  }
  async transaction(fn) {
    await this.load();
    const pool = await this._pool();
    for (let attempt = 0; ; attempt++) {
      const client = await pool.connect();
      let finished = false;
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL lock_timeout = '${Math.trunc(this.lockTimeoutMs)}ms'`);
        await client.query(`SET LOCAL statement_timeout = '${Math.trunc(this.statementTimeoutMs)}ms'`);
        const { rows } = await client.query('SELECT state, version FROM pilot_state WHERE tenant_id = $1 FOR UPDATE', [this.tenantId]);
        if (!rows.length) throw new PersistenceError('STATE_ROW_MISSING', 'Pilot state row is missing.', 500);
        const draft = structuredClone(typeof rows[0].state === 'string' ? JSON.parse(rows[0].state) : rows[0].state);
        const next = Number(rows[0].version) + 1;
        const result = await fn(draft);
        draft.meta = { ...(draft.meta || {}), version: next, updatedAt: this.clock().toISOString() };
        if (this.normalized) await persistNormalizedSnapshot(client, { tenantId: this.tenantId, state: draft, now: this.clock().toISOString() });
        await client.query('UPDATE pilot_state SET state = $2::jsonb, version = $3, updated_at = now() WHERE tenant_id = $1',
          [this.tenantId, JSON.stringify(draft), next]);
        await client.query('COMMIT'); finished = true;
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* connection may be gone */ }
        finished = true;
        if (RETRYABLE.has(error.code) && attempt < this.maxRetries) { await new Promise(r => setTimeout(r, 10 + Math.random() * 40 * (attempt + 1))); continue; }
        if (error.code === '55P03') throw new PersistenceError('LOCK_TIMEOUT', 'Could not acquire Pilot transaction lock.', 409);
        if (RETRYABLE.has(error.code)) throw new PersistenceError('TRANSACTION_CONFLICT', 'Transaction conflict, retry the request.', 409);
        throw error;
      } finally { client.release(); void finished; }
    }
  }
  async close() { if (this.pool?.end) await this.pool.end(); this.pool = null; this.ready = null; }
}
