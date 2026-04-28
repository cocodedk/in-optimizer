export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function jitter(base: number, fraction: number, rng: Rng): number {
  if (base <= 0) throw new Error("jitter: base must be positive");
  if (fraction < 0 || fraction >= 1) {
    throw new Error("jitter: fraction must be in [0, 1)");
  }
  const offset = (rng() * 2 - 1) * base * fraction;
  return Math.round(base + offset);
}

export function shouldLongBreak(count: number, cadence: number): boolean {
  if (cadence <= 0) return false;
  return count > 0 && count % cadence === 0;
}

export function longBreakMs(min: number, max: number, rng: Rng): number {
  if (min >= max) throw new Error("longBreakMs: min must be less than max");
  return Math.round(min + rng() * (max - min));
}
