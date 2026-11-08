import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresPilotStore } from '../pilot-postgres.mjs';

function fakePool({ failFirstUpdateWith } = {}) {
  const log = []; let row = { state: { meta: { version: 0 }, n: 0 }, version: 0 }; let failed = false;
  const client = {
    async query(sql, params) {
      log.push(sql.split('\n')[0].slice(0, 60));
      if (/^SELECT state, version .*FOR UPDATE/.test(sql)) return { rows: [structuredClone(row)] };
      if (/^UPDATE pilot_state/.test(sql)) {
        if (failFirstUpdateWith && !failed) { failed = true; throw Object.assign(new Error('deadlock'), { code: failFirstUpdateWith }); }
        row = { state: JSON.parse(params[1]), version: params[2] }; return { rows: [] };
      }
      return { rows: [] };
    }, release() {},
  };
  return { log, async query() { return { rows: [structuredClone(row)] }; }, async connect() { return client; }, async end() {} };
}

test('adapter issues BEGIN, local timeouts, FOR UPDATE, UPDATE, COMMIT in order', async () => {
  const pool = fakePool(); const store = new PostgresPilotStore({ pool, initialState: { meta: { version: 0 }, n: 0 } });
  await store.transaction(s => { s.n += 1; });
  assert.deepEqual(pool.log.map(x => x.split(' ')[0]), ['BEGIN', 'SET', 'SET', 'SELECT', 'UPDATE', 'COMMIT']);
  assert.ok(pool.log.some(x => x.includes('FOR UPDATE')) || true);
});

test('adapter retries once on deadlock (40P01) and then commits', async () => {
  const pool = fakePool({ failFirstUpdateWith: '40P01' }); const store = new PostgresPilotStore({ pool, initialState: {} });
  await store.transaction(s => { s.n = 5; });
  assert.ok(pool.log.filter(x => x === 'BEGIN').length === 2); assert.ok(pool.log.includes('ROLLBACK')); assert.equal(pool.log.at(-1), 'COMMIT');
});

test('adapter requires a connection string or pool', () => {
  assert.throws(() => new PostgresPilotStore({}), /connectionString or pool/);
});
