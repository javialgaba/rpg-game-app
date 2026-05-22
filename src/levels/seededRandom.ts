export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = SeededRandom.hashSeed(seed);
  }

  private static hashSeed(seed: string) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  next() {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  integer(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number) {
    return min + this.next() * (max - min);
  }

  chance(probability: number) {
    return this.next() < probability;
  }

  pick<T>(items: T[]) {
    return items[Math.floor(this.next() * items.length)];
  }
}
