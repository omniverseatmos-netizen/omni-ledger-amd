import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import pg from 'pg';

const sourceUrl = process.env.DATABASE_URL;
const restoreUrl = process.env.RESTORE_DATABASE_URL;
const backupDir = process.env.BACKUP_DIR || path.resolve('backups');
if (!sourceUrl || !restoreUrl) throw new Error('DATABASE_URL and RESTORE_DATABASE_URL are required. Use a disposable restore database.');
await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
const file = path.join(backupDir, `atmos-${new Date().toISOString().replace(/[-:.]/g, '')}.dump`);
const run = (command, args) => new Promise((resolve, reject) => { const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], env: process.env }); let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; }); child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} failed (${code}): ${stderr}`))); });
const started = performance.now();
await run('pg_dump', ['--format=custom', '--no-owner', '--file', file, sourceUrl]);
const backupSeconds = (performance.now() - started) / 1000;
const restoreStarted = performance.now();
await run('pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', restoreUrl, file]);
const restoreSeconds = (performance.now() - restoreStarted) / 1000;
const source = new pg.Pool({ connectionString: sourceUrl, max: 1 });
const restored = new pg.Pool({ connectionString: restoreUrl, max: 1 });
const tables = ['pilot_state', 'pilot_users', 'pilot_sessions', 'pilot_recalls', 'pilot_dispositions', 'pilot_disposition_approvals', 'pilot_ledger_events', 'pilot_audit_events', 'pilot_idempotency_keys'];
const counts = async pool => Object.fromEntries(await Promise.all(tables.map(async table => [table, Number((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n)])));
try {
  const [sourceCounts, restoredCounts] = await Promise.all([counts(source), counts(restored)]);
  const mismatches = tables.filter(table => sourceCounts[table] !== restoredCounts[table]);
  const result = { completedAt: new Date().toISOString(), backupFile: file, backupSeconds, restoreSeconds, rtoSeconds: backupSeconds + restoreSeconds, rpoSeconds: Number(process.env.EXPECTED_RPO_SECONDS || 0), sourceCounts, restoredCounts, pass: mismatches.length === 0, mismatches };
  console.log(JSON.stringify(result, null, 2));
  if (mismatches.length) process.exitCode = 1;
} finally { await source.end(); await restored.end(); }
