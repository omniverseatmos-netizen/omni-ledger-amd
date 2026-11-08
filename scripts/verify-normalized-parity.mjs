import pg from 'pg';

const { Pool } = pg;
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required.');
const pool = new Pool({ connectionString: url, max: 2 });
const tables = { users: 'pilot_users', sessions: 'pilot_sessions', recalls: 'pilot_recalls', dispositions: 'pilot_dispositions', ledger: 'pilot_ledger_events', audit: 'pilot_audit_events', idempotency: 'pilot_idempotency_keys' };
const count = async (client, table, tenant) => Number((await client.query(`SELECT count(*)::int AS count FROM ${table} WHERE tenant_id = $1`, [tenant])).rows[0].count);
try {
  const client = await pool.connect();
  try {
    const tenants = (await client.query('SELECT tenant_id, state FROM pilot_state ORDER BY tenant_id')).rows;
    const failures = [];
    const report = [];
    for (const row of tenants) {
      const state = typeof row.state === 'string' ? JSON.parse(row.state) : row.state;
      const core = state.core || {};
      const recalls = new Set((core.audit || []).filter(e => e.eventType?.startsWith('RECALL_') && e.afterState?.id).map(e => String(e.afterState.id)));
      const approvals = (core.dispositionRequests || []).reduce((sum, request) => sum + (request.approvals || []).length, 0);
      const expected = { users: (state.users || []).length, sessions: (state.sessions || []).length, recalls: recalls.size, dispositions: (core.dispositionRequests || []).length, approvals, ledger: (core.ledger || []).length, audit: (core.audit || []).length, idempotency: (state.idempotency || []).length };
      const actual = { users: await count(client, tables.users, row.tenant_id), sessions: await count(client, tables.sessions, row.tenant_id), recalls: await count(client, tables.recalls, row.tenant_id), dispositions: await count(client, tables.dispositions, row.tenant_id), approvals: await count(client, 'pilot_disposition_approvals', row.tenant_id), ledger: await count(client, tables.ledger, row.tenant_id), audit: await count(client, tables.audit, row.tenant_id), idempotency: await count(client, tables.idempotency, row.tenant_id) };
      for (const key of Object.keys(expected)) if (expected[key] !== actual[key]) failures.push(`${row.tenant_id}:${key} expected=${expected[key]} actual=${actual[key]}`);
      report.push({ tenant_id: row.tenant_id, expected, actual, pass: !failures.some(x => x.startsWith(`${row.tenant_id}:`)) });
    }
    const result = { checkedAt: new Date().toISOString(), tenants: report, pass: failures.length === 0, failures };
    console.log(JSON.stringify(result, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { client.release(); }
} finally { await pool.end(); }
