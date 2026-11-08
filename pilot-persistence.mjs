import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class PersistenceError extends Error { constructor(code, message, status = 500) { super(message); this.code = code; this.status = status; } }

export class PilotStore {
  constructor({ filePath, initialState = {}, clock = () => new Date() } = {}) {
    if (!filePath) throw new PersistenceError('STORE_PATH_REQUIRED', 'filePath is required.', 500);
    this.filePath = filePath; this.lockPath = `${filePath}.lock`; this.initialState = structuredClone(initialState); this.clock = clock; this.state = null; this.loaded = false; this.queue = Promise.resolve();
  }
  async load() {
    if (this.loaded) return this.state;
    try { this.state = JSON.parse(await fs.readFile(this.filePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; this.state = structuredClone(this.initialState); await this._atomicWrite(this.state); }
    this.loaded = true; return this.state;
  }
  async transaction(fn) {
    const run = this.queue.then(async () => {
      await this.load();
      const lock = await this._acquireLock();
      try {
        const fresh = await this._readFresh();
        const draft = structuredClone(fresh);
        const result = await fn(draft);
        draft.meta = { ...(draft.meta || {}), version: Number(draft.meta?.version || 0) + 1, updatedAt: this.clock().toISOString() };
        await this._atomicWrite(draft);
        this.state = draft; return result;
      } finally { await lock.release(); }
    });
    this.queue = run.catch(() => {}); return run;
  }
  async read() { await this.load(); const fresh = await this._readFresh(); this.state = fresh; return structuredClone(fresh); }
  async _readFresh() { try { return JSON.parse(await fs.readFile(this.filePath, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return structuredClone(this.initialState); throw error; } }
  async _atomicWrite(value) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
    await fs.rename(tmp, this.filePath);
  }
  async _acquireLock(timeoutMs = 5000) {
    const started = Date.now();
    while (true) {
      try { const handle = await fs.open(this.lockPath, 'wx', 0o600); return { release: async () => { await handle.close(); await fs.rm(this.lockPath, { force: true }); } }; }
      catch (error) { if (error.code !== 'EEXIST' || Date.now() - started > timeoutMs) throw new PersistenceError('LOCK_TIMEOUT', 'Could not acquire Pilot transaction lock.', 409); await new Promise(resolve => setTimeout(resolve, 5)); }
    }
  }
  async close() { await this.queue; }
}

export function emptyPilotState() { return { meta: { version: 0 }, users: [], sessions: [], idempotency: [], core: null }; }
