import test from 'node:test';
import assert from 'node:assert/strict';
import { TieredPrefetchCache } from '../policy-prefetch-cache.mjs';

test('prefetch loads sorted unique keys into warm tier', () => {
  const cache = new TieredPrefetchCache({ hotLimit: 2, warmLimit: 4 });
  const result = cache.prefetch({ reads: ['b', 'a', 'b'] }, key => `${key}-value`);
  assert.deepEqual(result.loaded, ['a', 'b']);
  assert.equal(cache.report().warmEntries, 2);
  assert.equal(cache.get('a'), 'a-value');
  assert.equal(cache.report().promotions, 1);
});

test('warm hit promotes to hot and bounded hot tier evicts the oldest entry', () => {
  const cache = new TieredPrefetchCache({ hotLimit: 2, warmLimit: 4 });
  cache.put('a', 1, 'hot'); cache.put('b', 2, 'hot'); cache.get('a'); cache.put('c', 3, 'hot');
  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.report().evictions, 1);
});

test('prefetch never overwrites an existing value from the loader', () => {
  const cache = new TieredPrefetchCache();
  cache.put('policy:fefo-expiry', 'trusted');
  const result = cache.prefetch({ reads: ['policy:fefo-expiry'] }, () => { throw new Error('loader should not run'); });
  assert.deepEqual(result.loaded, []);
  assert.equal(cache.get('policy:fefo-expiry'), 'trusted');
});

test('cache statistics are deterministic and cache is not a source of truth', () => {
  const cache = new TieredPrefetchCache({ hotLimit: 1, warmLimit: 2 });
  cache.prefetch({ reads: ['missing'] }, () => undefined);
  assert.equal(cache.has('missing'), false);
  assert.deepEqual(cache.report(), { hotEntries: 0, warmEntries: 0, hits: 0, misses: 1, promotions: 0, evictions: 0, loads: 1, hitRate: 0 });
});
