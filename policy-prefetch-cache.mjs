// Bounded, deterministic cache for prefetch plans. It never becomes a source of truth.
export class PrefetchCacheError extends Error {
  constructor(code, message) { super(message); this.name = 'PrefetchCacheError'; this.code = code; }
}

const assertTier = tier => {
  if (tier !== 'hot' && tier !== 'warm') throw new PrefetchCacheError('INVALID_TIER', `Unsupported cache tier: ${tier}`);
};

export class TieredPrefetchCache {
  constructor({ hotLimit = 128, warmLimit = 2048 } = {}) {
    if (!Number.isSafeInteger(hotLimit) || hotLimit < 1 || !Number.isSafeInteger(warmLimit) || warmLimit < hotLimit) throw new PrefetchCacheError('INVALID_LIMITS', 'warmLimit must be >= hotLimit and both limits must be positive integers');
    this.hotLimit = hotLimit;
    this.warmLimit = warmLimit;
    this.hot = new Map();
    this.warm = new Map();
    this.stats = { hits: 0, misses: 0, promotions: 0, evictions: 0, loads: 0 };
  }

  #touch(map, key, value) { map.delete(key); map.set(key, value); }
  #trim(map, limit) {
    while (map.size > limit) { map.delete(map.keys().next().value); this.stats.evictions++; }
  }

  put(key, value, tier = 'warm') {
    if (typeof key !== 'string' || !key) throw new PrefetchCacheError('INVALID_KEY', 'Cache key must be a non-empty string');
    assertTier(tier);
    const target = tier === 'hot' ? this.hot : this.warm;
    target.delete(key);
    this.hot.delete(key); this.warm.delete(key);
    target.set(key, value);
    this.#trim(target, tier === 'hot' ? this.hotLimit : this.warmLimit);
    return value;
  }

  get(key) {
    if (this.hot.has(key)) { const value = this.hot.get(key); this.#touch(this.hot, key, value); this.stats.hits++; return value; }
    if (this.warm.has(key)) {
      const value = this.warm.get(key); this.warm.delete(key); this.stats.promotions++;
      this.put(key, value, 'hot'); this.stats.hits++; return value;
    }
    this.stats.misses++;
    return undefined;
  }

  has(key) { return this.hot.has(key) || this.warm.has(key); }

  prefetch(plan, loader) {
    if (!plan || !Array.isArray(plan.reads)) throw new PrefetchCacheError('INVALID_PLAN', 'Plan must contain reads[]');
    if (typeof loader !== 'function') throw new PrefetchCacheError('LOADER_REQUIRED', 'A loader function is required');
    const loaded = [];
    for (const key of [...new Set(plan.reads)].sort()) {
      if (this.has(key)) { this.get(key); continue; }
      this.stats.misses++;
      const value = loader(key);
      this.stats.loads++;
      if (value !== undefined) { this.put(key, value, 'warm'); loaded.push(key); }
    }
    return Object.freeze({ loaded, stats: this.report() });
  }

  report() {
    return Object.freeze({ hotEntries: this.hot.size, warmEntries: this.warm.size, ...this.stats, hitRate: this.stats.hits + this.stats.misses ? this.stats.hits / (this.stats.hits + this.stats.misses) : 0 });
  }

  clear() { this.hot.clear(); this.warm.clear(); }
}
