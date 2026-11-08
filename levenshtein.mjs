export function normalizeMatchText(value) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
}
export function levenshteinMatrix(a, b) {
  const left = Array.from(normalizeMatchText(a));
  const right = Array.from(normalizeMatchText(b));
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return { distance: matrix[left.length][right.length], matrix, left, right };
}
export function rankProductCandidates(input, candidates) {
  return candidates.map((candidate, index) => ({ ...candidate, distance: levenshteinMatrix(input, candidate.name).distance, originalIndex: index }))
    .sort((a, b) => a.distance - b.distance || a.originalIndex - b.originalIndex);
}
