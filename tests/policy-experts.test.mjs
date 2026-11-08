import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PolicyExpertRegistry,
  buildDeterministicPrefetchPlan,
  createDefaultPolicyRegistry,
  evaluatePolicyExperts,
} from '../policy-experts.mjs';

test('expired FEFO batch is blocked without invoking unrelated experts', () => {
  assert.deepEqual(evaluatePolicyExperts({ expiryDate: '2026-01-01', today: '2026-10-20' }), {
    status: 'BLOCK',
    selectedExperts: ['fefo-expiry'],
    decisions: [{ expertId: 'fefo-expiry', priority: 10, status: 'BLOCK', code: 'EXPIRED_BATCH', evidence: '2026-01-01 < 2026-10-20' }],
  });
});

test('cold-chain expert allows an in-range measurement and blocks a breach', () => {
  assert.equal(evaluatePolicyExperts({ coldChain: true, temperatureRangeC: [2, 8], measuredTemperatureC: 5 }).status, 'ALLOW');
  assert.equal(evaluatePolicyExperts({ coldChain: true, temperatureRangeC: [2, 8], measuredTemperatureC: 10 }).decisions[0].code, 'COLD_CHAIN_BREACH');
});

test('controlled-substance expert requires two distinct approvers', () => {
  assert.equal(evaluatePolicyExperts({ controlledSchedule: 'II', approvals: [{ actorId: 'a' }] }).status, 'BLOCK');
  assert.equal(evaluatePolicyExperts({ controlledSchedule: 'II', approvals: [{ actorId: 'a' }, { actorId: 'b' }] }).status, 'ALLOW');
  assert.equal(evaluatePolicyExperts({ controlledSchedule: 'II', approvals: [{ actorId: 'a' }, { actorId: 'a' }] }).status, 'BLOCK');
});

test('lazy expert loader is not called unless its predicate matches', () => {
  let loads = 0;
  const registry = new PolicyExpertRegistry().registerLazy({
    id: 'special-handling',
    matches: context => context.specialHandling === true,
    load: () => { loads++; return { evaluate: () => ({ status: 'ALLOW', code: 'SPECIAL_OK' }) }; },
  });
  registry.evaluate({ specialHandling: false });
  assert.equal(loads, 0);
  registry.evaluate({ specialHandling: true });
  assert.equal(loads, 1);
  registry.evaluate({ specialHandling: true });
  assert.equal(loads, 1);
});

test('prefetch plan is stable, deduplicated and explicitly keyed', () => {
  const plan = buildDeterministicPrefetchPlan({
    registry: createDefaultPolicyRegistry(),
    baseKeys: ['hot:session:T1', 'hot:session:T1'],
    lines: [
      { itemCode: 'VAC-1', batch: 'B2', coldChain: true, temperatureRangeC: [2, 8], measuredTemperatureC: 5 },
      { itemCode: 'VAC-1', batch: 'B2', coldChain: true, temperatureRangeC: [2, 8], measuredTemperatureC: 5 },
      { itemCode: 'TAB-1', batch: 'B1', expiryDate: '2027-01-01', today: '2026-10-20' },
    ],
  });
  assert.deepEqual(plan.requests.map(request => request.key), ['TAB-1|B1', 'VAC-1|B2']);
  assert.equal(plan.reads.includes('policy:cold-chain'), true);
  assert.equal(plan.reads.includes('policy:fefo-expiry'), true);
  assert.equal(plan.reads.filter(key => key === 'hot:session:T1').length, 1);
});

test('expert selection order is deterministic by priority then id', () => {
  const registry = new PolicyExpertRegistry()
    .register({ id: 'zeta', priority: 20, matches: () => true, evaluate: () => ({ status: 'ALLOW', code: 'Z' }) })
    .register({ id: 'alpha', priority: 20, matches: () => true, evaluate: () => ({ status: 'ALLOW', code: 'A' }) })
    .register({ id: 'first', priority: 10, matches: () => true, evaluate: () => ({ status: 'ALLOW', code: 'F' }) });
  assert.deepEqual(registry.evaluate({}).selectedExperts, ['first', 'alpha', 'zeta']);
});
