import fs from 'node:fs';

const status = JSON.parse(fs.readFileSync(new URL('../pilot-governance-status.json', import.meta.url), 'utf8'));
const required = ['measurementPermission', 'privacyReview', 'ipReview', 'dataOwnerApproval', 'baselinePlan', 'stopPlan', 'incidentPlan', 'shadowApproval'];
const failures = [];
if (status.pilotStatus !== 'NOT_READY') failures.push('default pilotStatus must remain NOT_READY until human approval');
if (status.operatingMode !== 'SYNTHETIC_OR_DESKTOP_DEMO_ONLY') failures.push('default operatingMode must be demo-only');
if (status.externalWrites !== false) failures.push('externalWrites must be false before approved Shadow');
if (status.patientData !== false) failures.push('patientData must be false');
for (const key of required) if (status.approvals?.[key] !== 'MISSING') failures.push(`${key} must be reviewed explicitly before activation`);
if (status.approvals?.enforceApproval !== 'NOT_ALLOWED') failures.push('enforceApproval must remain NOT_ALLOWED before Shadow evidence');
if (failures.length) {
  console.error('Pilot governance verification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Pilot governance verification PASS: demo-only, no external writes, ${required.length} approval gates unfulfilled by design.`);
