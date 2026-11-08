import { evaluatePolicyExperts } from './policy-experts.mjs';

const MODES = new Set(['off', 'shadow', 'enforce']);
const decisionStatus = value => value?.status || 'ALLOW';

export function createPolicyShadow(mode = 'off', { registry } = {}) {
  const selectedMode = String(mode || 'off').toLowerCase();
  if (!MODES.has(selectedMode)) throw new Error(`Invalid policy experts mode: ${mode}`);
  const stats = { mode: selectedMode, evaluations: 0, mismatches: 0, blocks: 0, reviews: 0, lastMismatch: null };
  return Object.freeze({
    mode: selectedMode,
    evaluate(context, legacyDecision = { status: 'ALLOW' }) {
      if (selectedMode === 'off') return Object.freeze({ mode: 'off', applied: false, mismatch: false, legacy: legacyDecision, expert: null });
      const expert = evaluatePolicyExperts(context, registry);
      const legacyStatus = decisionStatus(legacyDecision);
      const mismatch = legacyStatus !== expert.status;
      stats.evaluations++;
      if (expert.status === 'BLOCK') stats.blocks++;
      if (expert.status === 'REVIEW') stats.reviews++;
      if (mismatch) {
        stats.mismatches++;
        stats.lastMismatch = { legacyStatus, expertStatus: expert.status, selectedExperts: expert.selectedExperts };
      }
      if (selectedMode === 'enforce' && expert.status === 'BLOCK' && legacyStatus !== 'BLOCK') {
        const error = new Error(`Policy expert blocked operation: ${expert.decisions.filter(d => d.status === 'BLOCK').map(d => d.code).join(',')}`);
        error.code = 'POLICY_EXPERT_BLOCK';
        error.expert = expert;
        throw error;
      }
      return Object.freeze({ mode: selectedMode, applied: true, mismatch, legacy: legacyDecision, expert });
    },
    report() {
      return Object.freeze({ ...stats, lastMismatch: stats.lastMismatch ? { ...stats.lastMismatch } : null });
    },
  });
}
