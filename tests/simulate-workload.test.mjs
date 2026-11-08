import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runPharmaceuticalSimulation } from '../simulate-workload.mjs';

test('synthetic workload is reproducible and explicitly non-production', () => {
  const a = runPharmaceuticalSimulation({ orderCount: 40, pharmacyCount: 10, seed: 20261020 });
  const b = runPharmaceuticalSimulation({ orderCount: 40, pharmacyCount: 10, seed: 20261020 });
  assert.deepEqual(a, b);
  assert.equal(a.datasetProvenance.mode, 'SYNTHETIC_DETERMINISTIC');
  assert.equal(a.datasetProvenance.realDataUsed, false);
  assert.equal(a.datasetProvenance.externalCalls, 0);
  assert.equal(a.datasetProvenance.calibrationStatus, 'NOT_CALIBRATED_TO_PRODUCTION');
  assert.equal(a.distributionNetwork.downstreamPharmaciesCount, 10);
});

test('synthetic chaos scenarios fail closed without claiming production SLOs', () => {
  const report = runPharmaceuticalSimulation({ orderCount: 80, pharmacyCount: 8, seed: 7 });
  assert.ok(report.resilienceAndSafety.chaosScenariosInjected > 0);
  assert.equal(report.resilienceAndSafety.stateMutationOnFault, 0);
  assert.ok(report.resilienceAndSafety.hardBlocksEnforced >= report.resilienceAndSafety.chaosScenariosInjected);
  assert.equal(report.latencyDistributionMs.model, 'deterministic workload estimate; not wall-clock and not an SLO');
});

test('checked-in workshop fixture cannot be mistaken for calibrated production data', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/synthetic-workload-report.json', import.meta.url)));
  assert.equal(fixture.datasetProvenance.mode, 'SYNTHETIC_DETERMINISTIC');
  assert.equal(fixture.datasetProvenance.realDataUsed, false);
  assert.equal(fixture.datasetProvenance.calibrationStatus, 'NOT_CALIBRATED_TO_PRODUCTION');
  assert.equal(fixture.latencyDistributionMs.unit, 'logical-ms');
});
