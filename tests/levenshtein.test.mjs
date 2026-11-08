import test from 'node:test';
import assert from 'node:assert/strict';
import { levenshteinMatrix, normalizeMatchText, rankProductCandidates } from '../levenshtein.mjs';

test('empty and identical strings', () => { assert.equal(levenshteinMatrix('', '').distance, 0); assert.equal(levenshteinMatrix('Medicine', 'Medicine').distance, 0); });
test('one edit for substitution, insertion, and deletion', () => { assert.equal(levenshteinMatrix('cat','cut').distance,1); assert.equal(levenshteinMatrix('cat','cats').distance,1); assert.equal(levenshteinMatrix('cats','cat').distance,1); });
test('case, whitespace and canonical Unicode normalization', () => { assert.equal(normalizeMatchText('  AMOXICILLIN   500mg '), 'amoxicillin 500mg'); assert.equal(levenshteinMatrix('café','cafe\u0301').distance,0); });
test('Unicode code points, including Arabic and emoji', () => { assert.equal(levenshteinMatrix('أ','ب').distance,1); assert.equal(levenshteinMatrix('😀','').distance,1); });
test('matrix dimensions and terminal cell match computed distance', () => { const x=levenshteinMatrix('ab','ac'); assert.equal(x.matrix.length,3); assert.equal(x.matrix[0].length,3); assert.equal(x.matrix.at(-1).at(-1),1); });
test('candidate ranking is stable on ties and never auto-selects', () => { const r=rankProductCandidates('ab',[{name:'ac',sku:'A'},{name:'ba',sku:'B'}]); assert.deepEqual(r.map(x=>x.sku),['A','B']); assert.equal(r[0].distance,1); assert.equal(r.some(x=>x.selected),false); });
test('pitch demonstration example gives one edit', () => { assert.equal(levenshteinMatrix('Amoxcillin 500mg','Amoxicillin 500mg').distance,1); });
