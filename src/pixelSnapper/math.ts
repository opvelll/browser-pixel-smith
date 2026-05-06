export function cloneRgbaImageData<T extends { width: number; height: number; data: Uint8ClampedArray }>(
  img: T,
) {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  }
}

export function distSq(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

export function sampleIndex(rng: () => number, upper: number): number {
  return Math.floor(rng() * upper)
}

export function sampleWeightedIndex(
  rng: () => number,
  weights: Float64Array,
  totalWeight: number,
): number {
  let target = rng() * totalWeight
  for (let i = 0; i < weights.length; i += 1) {
    target -= weights[i]
    if (target <= 0) {
      return i
    }
  }
  return weights.length - 1
}

export function createPrng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function packRgba(r: number, g: number, b: number, a: number): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}
