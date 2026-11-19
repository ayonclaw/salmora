// Independent streams keep changes to props from reshuffling the buildings.
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ (state >>> 15), state | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export function between(next, min, max) {
  return min + (max - min) * next();
}

export function integer(next, min, max) {
  return Math.floor(between(next, min, max + 1));
}

export function pick(next, values) {
  return values[Math.floor(next() * values.length)];
}

export function shuffled(next, values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; --i) {
    const j = integer(next, 0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
