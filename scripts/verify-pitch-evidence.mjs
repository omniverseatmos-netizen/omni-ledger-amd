import fs from 'node:fs';

const report = JSON.parse(fs.readFileSync(new URL('../fixtures/synthetic-workload-report.json', import.meta.url)));
const pack = fs.readFileSync(new URL('../PITCH_EVIDENCE_PACK_AR.md', import.meta.url), 'utf8');
const matcher = fs.readFileSync(new URL('../levenshtein.mjs', import.meta.url), 'utf8');
const required = [
  ['synthetic provenance', report.datasetProvenance.mode === 'SYNTHETIC_DETERMINISTIC'],
  ['no real data claim', report.datasetProvenance.realDataUsed === false],
  ['no external calls claim', report.datasetProvenance.externalCalls === 0],
  ['not calibrated claim', report.datasetProvenance.calibrationStatus === 'NOT_CALIBRATED_TO_PRODUCTION'],
  ['2000 workload', report.workloadMetrics.totalWorkloadTransactions === 2000],
  ['102 chaos scenarios', report.resilienceAndSafety.chaosScenariosInjected === 102],
  ['102 hard blocks', report.resilienceAndSafety.hardBlocksEnforced === 102],
  ['logical latency label', report.latencyDistributionMs.unit === 'logical-ms'],
  ['not production wording', /not production measurements/i.test(pack)],
  ['not SLO wording', /not wall-clock benchmark|logical-ms|not production/i.test(pack)],
  ['OIDC boundary', /ليس اختبار Entra tenant حيًا/.test(pack)],
  ['k6 boundary', /لم يُشغّل بدون staging secrets/.test(pack)],
  ['Levenshtein implementation exists', /levenshteinMatrix/.test(matcher)],
  ['Levenshtein framed as suggestion only', /اقتراح فقط/.test(pack)],
  ['No auto-acceptance claim', /لا توجد عتبة قبول أو اختيار تلقائي/.test(pack)],
];
const failures = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) { console.error(`Pitch evidence verification failed: ${failures.join(', ')}`); process.exit(1); }
console.log(`Pitch evidence verification PASS: ${required.length} claims/limits checked.`);
