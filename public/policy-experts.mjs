// Deterministic, dependency-free policy experts for AtMoS.
// Experts are selected by explicit predicates; no probabilistic routing or I/O is used.

export class PolicyExpertError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PolicyExpertError';
    this.code = code;
  }
}

const asObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PolicyExpertError('INVALID_CONTEXT', `${label} must be an object`);
  }
  return value;
};

const normalizeDate = (value, label) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new PolicyExpertError('INVALID_DATE', `${label} must be YYYY-MM-DD`);
  }
  return value;
};

const uniqueSorted = values => [...new Set(values)].sort();

export class PolicyExpertRegistry {
  #descriptors = new Map();

  register({ id, priority = 100, matches, evaluate }) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new PolicyExpertError('INVALID_EXPERT_ID', `Invalid expert id: ${id}`);
    if (this.#descriptors.has(id)) throw new PolicyExpertError('DUPLICATE_EXPERT', `Expert already registered: ${id}`);
    if (!Number.isSafeInteger(priority)) throw new PolicyExpertError('INVALID_PRIORITY', `Invalid priority for ${id}`);
    if (typeof matches !== 'function' || typeof evaluate !== 'function') throw new PolicyExpertError('INVALID_EXPERT', `Expert ${id} requires matches/evaluate functions`);
    this.#descriptors.set(id, { id, priority, matches, evaluate });
    return this;
  }

  registerLazy({ id, priority = 100, matches, load }) {
    if (typeof load !== 'function') throw new PolicyExpertError('INVALID_EXPERT', `Lazy expert ${id} requires a loader`);
    let loaded;
    return this.register({
      id,
      priority,
      matches,
      evaluate: context => {
        loaded ??= load();
        if (!loaded || typeof loaded.evaluate !== 'function') throw new PolicyExpertError('INVALID_EXPERT', `Lazy expert ${id} did not provide evaluate()`);
        return loaded.evaluate(context);
      },
    });
  }

  selected(context) {
    const safeContext = asObject(context, 'context');
    return [...this.#descriptors.values()]
      .filter(expert => expert.matches(safeContext) === true)
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  evaluate(context) {
    const safeContext = asObject(context, 'context');
    const experts = this.selected(safeContext);
    const decisions = experts.map(expert => {
      const decision = expert.evaluate(safeContext);
      if (!decision || !['ALLOW', 'BLOCK', 'REVIEW'].includes(decision.status)) {
        throw new PolicyExpertError('INVALID_DECISION', `Expert ${expert.id} returned an invalid decision`);
      }
      return Object.freeze({ expertId: expert.id, priority: expert.priority, ...decision });
    });
    const blocked = decisions.filter(decision => decision.status === 'BLOCK');
    return Object.freeze({
      status: blocked.length ? 'BLOCK' : decisions.some(decision => decision.status === 'REVIEW') ? 'REVIEW' : 'ALLOW',
      selectedExperts: experts.map(expert => expert.id),
      decisions,
    });
  }
}

export function createDefaultPolicyRegistry() {
  return new PolicyExpertRegistry()
    .register({
      id: 'fefo-expiry',
      priority: 10,
      matches: context => Boolean(context.expiryDate),
      evaluate: context => {
        const expiryDate = normalizeDate(context.expiryDate, 'expiryDate');
        const today = normalizeDate(context.today, 'today');
        return expiryDate < today
          ? { status: 'BLOCK', code: 'EXPIRED_BATCH', evidence: `${expiryDate} < ${today}` }
          : { status: 'ALLOW', code: 'FEFO_DATE_VALID', evidence: expiryDate };
      },
    })
    .register({
      id: 'cold-chain',
      priority: 20,
      matches: context => Boolean(context.coldChain || context.temperatureRangeC),
      evaluate: context => {
        const range = context.temperatureRangeC;
        if (!Array.isArray(range) || range.length !== 2 || range.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
          return { status: 'BLOCK', code: 'COLD_CHAIN_RANGE_REQUIRED', evidence: 'temperatureRangeC=[min,max] is required' };
        }
        const measured = context.measuredTemperatureC;
        if (typeof measured !== 'number' || !Number.isFinite(measured)) {
          return { status: 'REVIEW', code: 'COLD_CHAIN_MEASUREMENT_REQUIRED', evidence: 'No measured temperature supplied' };
        }
        const [min, max] = range;
        return measured >= min && measured <= max
          ? { status: 'ALLOW', code: 'COLD_CHAIN_VALID', evidence: `${measured}°C in [${min},${max}]` }
          : { status: 'BLOCK', code: 'COLD_CHAIN_BREACH', evidence: `${measured}°C outside [${min},${max}]` };
      },
    })
    .register({
      id: 'controlled-substance',
      priority: 30,
      matches: context => Boolean(context.controlledSubstance || context.controlledSchedule),
      evaluate: context => {
        const approvals = Array.isArray(context.approvals) ? context.approvals : [];
        const distinctApprovers = uniqueSorted(approvals.map(approval => String(approval?.actorId || approval?.actor || '')).filter(Boolean));
        return distinctApprovers.length >= 2
          ? { status: 'ALLOW', code: 'DUAL_APPROVAL_VALID', evidence: distinctApprovers }
          : { status: 'BLOCK', code: 'DUAL_APPROVAL_REQUIRED', evidence: distinctApprovers };
      },
    });
}

export function evaluatePolicyExperts(context, registry = createDefaultPolicyRegistry()) {
  return registry.evaluate(context);
}

export function buildDeterministicPrefetchPlan({ lines = [], registry = createDefaultPolicyRegistry(), baseKeys = [] } = {}) {
  if (!Array.isArray(lines)) throw new PolicyExpertError('INVALID_LINES', 'lines must be an array');
  const requests = [];
  for (const line of lines) {
    asObject(line, 'line');
    if (!line.itemCode) throw new PolicyExpertError('ITEM_CODE_REQUIRED', 'Each line requires itemCode');
    const key = `${line.itemCode}|${line.batch || ''}`;
    const evaluation = registry.evaluate(line);
    requests.push({
      key,
      itemCode: line.itemCode,
      batch: line.batch || null,
      selectedExperts: evaluation.selectedExperts,
      status: evaluation.status,
      reads: [`warm:item:${line.itemCode}`, ...(line.batch ? [`warm:batch:${line.itemCode}|${line.batch}`] : []), ...evaluation.selectedExperts.map(id => `policy:${id}`)],
    });
  }
  const deduped = new Map(requests.map(request => [request.key, request]));
  const reads = uniqueSorted([...baseKeys, ...requests.flatMap(request => request.reads)]);
  return Object.freeze({
    version: 1,
    strategy: 'deterministic-keyed-prefetch',
    requests: [...deduped.values()].sort((a, b) => a.key.localeCompare(b.key)),
    reads,
  });
}
