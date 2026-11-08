export const REVIEW_VERSION = 1;

export const REVIEW_STATES = Object.freeze({
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CANCELLED: 'CANCELLED',
});

export const REVIEW_SEVERITY_RANK = Object.freeze({ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 });

export const REVIEW_SLA_MINUTES = Object.freeze({
  CRITICAL: 30,
  HIGH: 120,
  MEDIUM: 480,
  LOW: 1440,
});

export const REVIEW_POLICY = Object.freeze({
  QC_FAIL: { requiredRole: 'qa_manager', blockedAction: 'POST_RECEIPT', severity: 'HIGH' },
  EXPIRED_GOODS: { requiredRole: 'receiving_supervisor', blockedAction: 'RECEIVE_STOCK', severity: 'CRITICAL' },
  PICK_BLOCKED: { requiredRole: 'warehouse_manager', blockedAction: 'PICK_STOCK', severity: 'CRITICAL' },
  RECALL_IMPACT: { requiredRole: 'quality_officer', blockedAction: 'RECALL_DISPOSITION', severity: 'CRITICAL' },
  RECALLED_BATCH: { requiredRole: 'quality_officer', blockedAction: 'PICK_STOCK', severity: 'CRITICAL' },
  ITEM_MISMATCH: { requiredRole: 'warehouse_manager', blockedAction: 'PICK_STOCK', severity: 'CRITICAL' },
  BATCH_MISMATCH: { requiredRole: 'warehouse_manager', blockedAction: 'PICK_STOCK', severity: 'CRITICAL' },
});

const asDate = value => new Date(value).getTime();
const minutesAfter = (iso, minutes) => new Date(asDate(iso) + minutes * 60_000).toISOString();

export function policyForReviewType(type, overrides = {}) {
  return { ...(REVIEW_POLICY[type] ?? { requiredRole: 'operations_supervisor', blockedAction: 'REVIEW', severity: 'MEDIUM' }), ...overrides };
}

export function buildReviewCase({ id, exception, now, policy = {} }) {
  const selected = policyForReviewType(exception.type, policy);
  const severity = selected.severity ?? exception.severity ?? 'MEDIUM';
  const createdAt = now ?? exception.detectedAt ?? new Date().toISOString();
  return {
    version: REVIEW_VERSION,
    id,
    exceptionId: exception.id,
    type: exception.type,
    state: REVIEW_STATES.OPEN,
    severity,
    requiredRole: selected.requiredRole,
    blockedAction: selected.blockedAction,
    sourceType: exception.sourceType ?? (exception.receiptId ? 'GoodsReceipt' : exception.soId ? 'SalesOrder' : 'Exception'),
    sourceId: exception.sourceId ?? exception.receiptId ?? exception.soId ?? exception.id,
    itemCode: exception.itemCode ?? null,
    createdAt,
    dueAt: minutesAfter(createdAt, REVIEW_SLA_MINUTES[severity] ?? REVIEW_SLA_MINUTES.MEDIUM),
    assignee: null,
    claimedAt: null,
    leaseUntil: null,
    resolution: null,
    resolutionNote: null,
    resolvedBy: null,
    resolvedAt: null,
    escalatedAt: null,
    version: 1,
  };
}

export function isReviewOverdue(review, now = new Date().toISOString()) {
  return ![REVIEW_STATES.RESOLVED, REVIEW_STATES.CANCELLED].includes(review.state) && asDate(now) >= asDate(review.dueAt);
}

export function sortReviewCases(cases, now = new Date().toISOString()) {
  return [...cases].sort((a, b) => {
    const ar = REVIEW_SEVERITY_RANK[a.severity] ?? 9;
    const br = REVIEW_SEVERITY_RANK[b.severity] ?? 9;
    const ao = isReviewOverdue(a, now) ? 0 : 1;
    const bo = isReviewOverdue(b, now) ? 0 : 1;
    return ar - br || ao - bo || asDate(a.dueAt) - asDate(b.dueAt) || asDate(a.createdAt) - asDate(b.createdAt) || String(a.id).localeCompare(String(b.id));
  });
}

export function reviewError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export class ReviewQueue {
  constructor(core) { this.core = core; }

  list({ state = null, role = null, now = this.core._iso() } = {}) {
    const rows = this.core.reviewCases.filter(x => (!state || x.state === state) && (!role || x.requiredRole === role));
    return sortReviewCases(rows, now).map(x => ({ ...x, overdue: isReviewOverdue(x, now) }));
  }

  claim(id, { actor, role, now = this.core._iso(), leaseMinutes = 20 } = {}) {
    if (!actor || !role) throw reviewError('ACTOR_ROLE_REQUIRED', 'Actor and role are required to claim a review.');
    const review = this.core.reviewCases.find(x => x.id === id);
    if (!review) throw reviewError('REVIEW_NOT_FOUND', `Review case not found: ${id}`);
    if (review.state === REVIEW_STATES.RESOLVED || review.state === REVIEW_STATES.CANCELLED) throw reviewError('REVIEW_CLOSED', `Review case is already ${review.state}.`);
    if (review.requiredRole !== role) throw reviewError('ROLE_NOT_ALLOWED', `Role ${role} cannot claim ${review.type}; required role is ${review.requiredRole}.`);
    const leaseActive = review.leaseUntil && asDate(now) < asDate(review.leaseUntil);
    if (leaseActive && review.assignee !== actor) throw reviewError('REVIEW_CLAIMED', `Review case is claimed by ${review.assignee}.`);
    const before = { state: review.state, assignee: review.assignee, leaseUntil: review.leaseUntil };
    review.state = REVIEW_STATES.CLAIMED;
    review.assignee = actor;
    review.claimedAt = review.claimedAt ?? now;
    review.leaseUntil = new Date(asDate(now) + leaseMinutes * 60_000).toISOString();
    review.version += 1;
    this.core._audit('REVIEW_CLAIMED', actor, 'ReviewCase', review.id, before, { state: review.state, assignee: actor, leaseUntil: review.leaseUntil }, review.exceptionId);
    return review;
  }

  release(id, { actor, now = this.core._iso() } = {}) {
    const review = this.core.reviewCases.find(x => x.id === id);
    if (!review) throw reviewError('REVIEW_NOT_FOUND', `Review case not found: ${id}`);
    if (review.state !== REVIEW_STATES.CLAIMED) throw reviewError('REVIEW_NOT_CLAIMED', 'Only a claimed review can be released.');
    if (review.assignee !== actor && review.leaseUntil && asDate(now) < asDate(review.leaseUntil)) throw reviewError('NOT_ASSIGNEE', 'Only the current assignee can release an active review.');
    const before = { state: review.state, assignee: review.assignee, leaseUntil: review.leaseUntil };
    review.state = REVIEW_STATES.OPEN;
    review.assignee = null;
    review.leaseUntil = null;
    review.version += 1;
    this.core._audit('REVIEW_RELEASED', actor, 'ReviewCase', review.id, before, { state: review.state }, review.exceptionId);
    return review;
  }

  escalateOverdue({ now = this.core._iso(), actor = 'system' } = {}) {
    const changed = [];
    for (const review of this.core.reviewCases) {
      if (!isReviewOverdue(review, now) || review.state === REVIEW_STATES.ESCALATED) continue;
      const before = { state: review.state, requiredRole: review.requiredRole, assignee: review.assignee };
      review.state = REVIEW_STATES.ESCALATED;
      review.escalatedAt = now;
      review.leaseUntil = null;
      review.version += 1;
      this.core._audit('REVIEW_ESCALATED', actor, 'ReviewCase', review.id, before, { state: review.state, escalatedAt: now }, review.exceptionId);
      changed.push(review);
    }
    return changed;
  }

  resolveWithAction(id, { actor, role, action, note, now = this.core._iso() } = {}) {
    const review = this.core.reviewCases.find(x => x.id === id);
    if (!review) throw reviewError('REVIEW_NOT_FOUND', `Review case not found: ${id}`);
    const allowed = {
      QC_FAIL: ['RETURN_TO_VENDOR'],
      RECALL_IMPACT: ['CONFIRM_IMPACT'],
      EXPIRED_GOODS: ['CONFIRM_BLOCK'],
      RECALLED_BATCH: ['CONFIRM_BLOCK'],
      PICK_BLOCKED: ['CONFIRM_BLOCK'],
      ITEM_MISMATCH: ['CONFIRM_BLOCK'],
      BATCH_MISMATCH: ['CONFIRM_BLOCK'],
    }[review.type] ?? ['CONFIRM_BLOCK'];
    if (!allowed.includes(action)) throw reviewError('REVIEW_ACTION_NOT_ALLOWED', `Action ${action} is not allowed for ${review.type}.`);
    if (action === 'RETURN_TO_VENDOR') {
      if (!review.sourceId) throw reviewError('REVIEW_SOURCE_REQUIRED', 'A receipt source is required for RTV.');
      this.core.returnToVendor(review.sourceId, actor);
    }
    const resolution = action === 'RETURN_TO_VENDOR' ? 'RTV_POSTED' : action;
    const defaultNote = action === 'RETURN_TO_VENDOR'
      ? 'Rejected QC material was returned to the vendor through the deterministic core.'
      : action === 'CONFIRM_IMPACT'
        ? 'Recall impact was reviewed; affected orders remain blocked pending reallocation.'
        : 'The deterministic block was reviewed and remains in force.';
    return this.resolve(id, { actor, role, resolution, note: note || defaultNote, now, action });
  }

  resolve(id, { actor, role, resolution, note, now = this.core._iso(), action = null } = {}) {
    if (!actor || !role || !resolution || !note || String(note).trim().length < 3) throw reviewError('RESOLUTION_REQUIRED', 'Actor, role, resolution and a meaningful note are required.');
    const review = this.core.reviewCases.find(x => x.id === id);
    if (!review) throw reviewError('REVIEW_NOT_FOUND', `Review case not found: ${id}`);
    if (![REVIEW_STATES.CLAIMED, REVIEW_STATES.ESCALATED].includes(review.state)) throw reviewError('REVIEW_NOT_CLAIMED', 'A review must be claimed before resolution.');
    if (review.requiredRole !== role) throw reviewError('ROLE_NOT_ALLOWED', `Role ${role} cannot resolve this review.`);
    if (review.assignee && review.assignee !== actor) throw reviewError('NOT_ASSIGNEE', 'Only the assignee can resolve this review.');
    if (review.resolution) throw reviewError('REVIEW_ALREADY_RESOLVED', 'Review is already resolved.');
    const before = { state: review.state, resolution: review.resolution };
    review.state = REVIEW_STATES.RESOLVED;
    review.resolution = resolution;
    review.resolutionNote = String(note).trim();
    review.resolvedBy = actor;
    review.resolvedAt = now;
    review.leaseUntil = null;
    review.version += 1;
    this.core._audit('REVIEW_RESOLVED', actor, 'ReviewCase', review.id, before, { state: review.state, resolution, action }, review.exceptionId);
    const exception = this.core.exceptions.find(x => x.id === review.exceptionId);
    if (exception) { exception.resolution = resolution; exception.resolutionNote = review.resolutionNote; exception.resolvedBy = actor; exception.resolvedAt = now; }
    return review;
  }
}
