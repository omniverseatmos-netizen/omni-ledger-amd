import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runRecallScenario } from '../demo-scenarios.mjs';
import { RbacService } from '../pilot-rbac.mjs';
import { PilotStore, emptyPilotState } from '../pilot-persistence.mjs';
import { PilotService } from '../pilot-service.mjs';

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atmos-pilot-'));
  const scenario = runRecallScenario();
  scenario.core.dispositionRequests = [];
  const store = new PilotStore({ filePath: path.join(dir, 'state.json'), initialState: { ...emptyPilotState(), core: scenario.core.toJSON() } });
  const clock = () => new Date('2026-10-20T07:00:00.000Z');
  const rbac = new RbacService({ clock, tokenSecret: 'test-secret' });
  const service = new PilotService({ store, rbac, clock });
  await service.bootstrap({ admin: { id: 'admin', email: 'admin@example.test', displayName: 'Admin', roles: ['pilot_admin'], password: 'correct-horse-battery-staple' } });
  await store.transaction(state => { for (const input of [
    { id: 'maker', email: 'maker@example.test', displayName: 'Maker', roles: ['recall_operator'], password: 'maker-password-123' },
    { id: 'quality', email: 'quality@example.test', displayName: 'Quality', roles: ['quality_officer'], password: 'quality-password-123' },
    { id: 'qa', email: 'qa@example.test', displayName: 'QA', roles: ['qa_manager'], password: 'qa-manager-password' },
    { id: 'ops', email: 'ops@example.test', displayName: 'Operations', roles: ['operations_manager'], password: 'ops-manager-password' },
  ]) state.users.push(rbac.createUser(input)); });
  const login = async role => service.login({ email: `${role}@example.test`, password: { maker: 'maker-password-123', quality: 'quality-password-123', qa: 'qa-manager-password', ops: 'ops-manager-password' }[role] });
  return { dir, store, service, login };
}

test('Pilot RBAC enforces roles, tenant/session boundaries, and password verification', async () => {
  const { service, login } = await fixture();
  const maker = await login('maker');
  assert.equal((await service.me(maker.token)).roles[0], 'recall_operator');
  await assert.rejects(() => service.dashboard(maker.token), error => error.code === 'PERMISSION_DENIED');
  await assert.rejects(() => service.login({ email: 'maker@example.test', password: 'wrong-password-123' }), error => error.code === 'INVALID_CREDENTIALS');
});

test('Pilot disposition flow requires idempotency and two distinct approval roles', async () => {
  const { service, login } = await fixture();
  const maker = await login('maker'); const quality = await login('quality'); const qa = await login('qa'); const ops = await login('ops');
  const input = { itemCode: 'PARA-500', batch: 'BATCH-RECALL-01', warehouseCode: 'WH-OCT6', disposition: 'HOLD', refNo: 'PILOT-DSP-1', reason: 'Pilot control test' };
  await assert.rejects(() => service.createDisposition(maker.token, input), error => error.code === 'IDEMPOTENCY_KEY_REQUIRED');
  const request = await service.createDisposition(maker.token, input, 'pilot-create-key-0001');
  const replay = await service.createDisposition(maker.token, input, 'pilot-create-key-0001');
  assert.equal(replay.id, request.id);
  await assert.rejects(() => service.createDisposition(maker.token, { ...input, reason: 'Different payload' }, 'pilot-create-key-0001'), error => error.code === 'IDEMPOTENCY_CONFLICT');
  await service.approveDisposition(quality.token, request.id, 'APPROVE', 'Quality approved', 'approve-quality-0001');
  await assert.rejects(() => service.approveDisposition(quality.token, request.id, 'APPROVE', 'Duplicate role', 'approve-quality-0002'), error => error.code === 'APPROVAL_ROLE_ALREADY_USED');
  await service.approveDisposition(qa.token, request.id, 'APPROVE', 'QA approved', 'approve-qa-00001');
  const executed = await service.executeDisposition(ops.token, request.id, 'execute-0000000001');
  assert.equal(executed.status, 'EXECUTED');
  const dashboard = await service.dashboard(ops.token);
  assert.equal(dashboard.requests[0].status, 'EXECUTED');
});

test('Pilot store serializes concurrent transactions and preserves monotonic versions', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atmos-lock-'));
  const store = new PilotStore({ filePath: path.join(dir, 'state.json'), initialState: { ...emptyPilotState(), counter: 0 } });
  await Promise.all(Array.from({ length: 100 }, () => store.transaction(state => { state.counter += 1; return state.counter; })));
  const state = await store.read();
  assert.equal(state.counter, 100);
  assert.equal(state.meta.version, 100);
  await fs.rm(dir, { recursive: true, force: true });
});
