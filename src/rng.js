// 시드 난수 (mulberry32). 같은 시드면 같은 수열을 돌려준다.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 문자열·숫자 시드를 32비트 정수로 바꾼다. 비어 있으면 무작위.
export function toSeed(value) {
  if (value === null || value === undefined || value === '') return (Math.random() * 2 ** 32) >>> 0;
  const number = Number(value);
  if (Number.isFinite(number)) return number >>> 0;
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return hash >>> 0;
}

export function shuffle(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
