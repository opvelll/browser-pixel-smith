import { defaultQuantizeConfig } from './config'
import { cloneRgbaImageData, createPrng, distSq, sampleIndex, sampleWeightedIndex } from './math'
import type { PixelSnapperConfig, QuantizeConfig, RgbaImageData } from './types'

type Rgb = [number, number, number]
type Lab = [number, number, number]

type WeightedColor = {
  rgb: Rgb
  count: number
  lab?: Lab
}

type ColorBox = {
  colors: WeightedColor[]
  count: number
  range: Rgb
}

const MAX_EXACT_COLORS = 32768
const OCTREE_BUCKET_BITS = 5

export function quantizeImage(
  img: RgbaImageData,
  config: PixelSnapperConfig,
): RgbaImageData {
  if (config.kColors <= 0 || !Number.isFinite(config.kColors)) {
    throw new Error('Number of colors must be greater than 0')
  }

  const opaquePixels: Rgb[] = []
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] !== 0) {
      opaquePixels.push([img.data[i], img.data[i + 1], img.data[i + 2]])
    }
  }

  const nPixels = opaquePixels.length
  if (nPixels === 0) {
    return cloneRgbaImageData(img)
  }

  const rng = createPrng(config.kSeed)
  const k = Math.min(Math.trunc(config.kColors), nPixels)
  const centroids: Rgb[] = []
  centroids.push([...opaquePixels[sampleIndex(rng, nPixels)]])
  const distances = new Float64Array(nPixels)
  distances.fill(Number.MAX_VALUE)

  for (let next = 1; next < k; next += 1) {
    const lastCentroid = centroids[centroids.length - 1]
    let sumSqDist = 0

    for (let i = 0; i < nPixels; i += 1) {
      const dSq = distSq(opaquePixels[i], lastCentroid)
      if (dSq < distances[i]) {
        distances[i] = dSq
      }
      sumSqDist += distances[i]
    }

    const idx =
      sumSqDist <= 0 ? sampleIndex(rng, nPixels) : sampleWeightedIndex(rng, distances, sumSqDist)
    centroids.push([...opaquePixels[idx]])
  }

  const prevCentroids = centroids.map((centroid) => [...centroid] as Rgb)
  for (let iteration = 0; iteration < config.maxKmeansIterations; iteration += 1) {
    const sums = Array.from({ length: k }, () => [0, 0, 0] as Rgb)
    const counts = new Array<number>(k).fill(0)

    for (const pixel of opaquePixels) {
      let minDist = Number.MAX_VALUE
      let bestK = 0

      for (let i = 0; i < centroids.length; i += 1) {
        const d = distSq(pixel, centroids[i])
        if (d < minDist) {
          minDist = d
          bestK = i
        }
      }

      sums[bestK][0] += pixel[0]
      sums[bestK][1] += pixel[1]
      sums[bestK][2] += pixel[2]
      counts[bestK] += 1
    }

    for (let i = 0; i < k; i += 1) {
      if (counts[i] > 0) {
        centroids[i] = [
          sums[i][0] / counts[i],
          sums[i][1] / counts[i],
          sums[i][2] / counts[i],
        ]
      }
    }

    if (iteration > 0) {
      let maxMovement = 0
      for (let i = 0; i < centroids.length; i += 1) {
        maxMovement = Math.max(maxMovement, distSq(centroids[i], prevCentroids[i]))
      }
      if (maxMovement < 0.01) {
        break
      }
    }

    for (let i = 0; i < centroids.length; i += 1) {
      prevCentroids[i] = [...centroids[i]]
    }
  }

  return applyPalette(img, centroids, 'rgb')
}

export function processQuantize(
  imageData: ImageData,
  partialConfig: Partial<QuantizeConfig> = {},
): ImageData {
  const config = normalizeQuantizeConfig(partialConfig)
  const source = cloneRgbaImageData(imageData)
  const colors = collectWeightedColors(source)
  if (colors.length === 0) {
    return new ImageData(Uint8ClampedArray.from(source.data), source.width, source.height)
  }

  const k = Math.min(config.colors, colors.length)
  const palette =
    config.method === 'medianCut'
      ? medianCutPalette(colors, k)
      : refinePalette(
          colors,
          config.method === 'oklabRefine'
            ? seededPalette(colors, k, config.seed, 'oklab')
            : octreeDiversePalette(colors, k),
          config.refineIterations,
          config.method === 'oklabRefine' ? 'oklab' : 'rgb',
        )

  const metric = config.method === 'oklabRefine' ? 'oklab' : 'rgb'
  const output = applyPalette(source, palette, metric)
  return new ImageData(Uint8ClampedArray.from(output.data), output.width, output.height)
}

function normalizeQuantizeConfig(partialConfig: Partial<QuantizeConfig>): QuantizeConfig {
  const config = { ...defaultQuantizeConfig, ...partialConfig }
  const colors = Math.trunc(config.colors)
  const refineIterations = Math.trunc(config.refineIterations)

  if (!Number.isFinite(colors) || colors <= 0) {
    throw new Error('Number of colors must be greater than 0')
  }
  if (!Number.isFinite(config.seed) || config.seed < 0) {
    throw new Error('Seed must be zero or greater')
  }
  if (!Number.isFinite(refineIterations) || refineIterations < 0) {
    throw new Error('Refine iterations must be zero or greater')
  }

  return {
    colors: Math.min(256, Math.max(1, colors)),
    method: config.method,
    seed: Math.trunc(config.seed),
    refineIterations: Math.min(80, refineIterations),
  }
}

function collectWeightedColors(img: RgbaImageData): WeightedColor[] {
  const exactCounts = new Map<number, number>()
  let overflow = false

  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) {
      continue
    }

    const packed = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]
    exactCounts.set(packed, (exactCounts.get(packed) ?? 0) + 1)
    if (exactCounts.size > MAX_EXACT_COLORS) {
      overflow = true
      break
    }
  }

  if (overflow) {
    return bucketColors(img)
  }

  return Array.from(exactCounts, ([packed, count]) => ({
    rgb: [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255],
    count,
  }))
}

function bucketColors(img: RgbaImageData): WeightedColor[] {
  const buckets = new Map<number, { sums: Rgb; count: number }>()
  const shift = 8 - OCTREE_BUCKET_BITS

  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) {
      continue
    }

    const r = img.data[i]
    const g = img.data[i + 1]
    const b = img.data[i + 2]
    const key = ((r >> shift) << 10) | ((g >> shift) << 5) | (b >> shift)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.sums[0] += r
      bucket.sums[1] += g
      bucket.sums[2] += b
      bucket.count += 1
    } else {
      buckets.set(key, { sums: [r, g, b], count: 1 })
    }
  }

  return Array.from(buckets.values(), ({ sums, count }) => ({
    rgb: [sums[0] / count, sums[1] / count, sums[2] / count],
    count,
  }))
}

function medianCutPalette(colors: WeightedColor[], k: number): Rgb[] {
  const boxes: ColorBox[] = [createColorBox(colors)]

  while (boxes.length < k) {
    let splitIndex = -1
    let splitScore = -1
    for (let i = 0; i < boxes.length; i += 1) {
      if (boxes[i].colors.length < 2) {
        continue
      }
      const widest = Math.max(...boxes[i].range)
      const score = widest * boxes[i].count
      if (score > splitScore) {
        splitScore = score
        splitIndex = i
      }
    }

    if (splitIndex < 0) {
      break
    }

    const [box] = boxes.splice(splitIndex, 1)
    const axis = box.range.indexOf(Math.max(...box.range))
    const sorted = [...box.colors].sort((a, b) => a.rgb[axis] - b.rgb[axis])
    const halfCount = box.count / 2
    let runningCount = 0
    let splitAt = 1
    for (; splitAt < sorted.length; splitAt += 1) {
      runningCount += sorted[splitAt - 1].count
      if (runningCount >= halfCount) {
        break
      }
    }
    splitAt = Math.max(1, Math.min(sorted.length - 1, splitAt))

    boxes.push(createColorBox(sorted.slice(0, splitAt)), createColorBox(sorted.slice(splitAt)))
  }

  return boxes.filter((box) => box.colors.length > 0).map((box) => averageColor(box.colors))
}

function createColorBox(colors: WeightedColor[]): ColorBox {
  const min = [255, 255, 255] as Rgb
  const max = [0, 0, 0] as Rgb
  let count = 0

  for (const color of colors) {
    for (let channel = 0; channel < 3; channel += 1) {
      min[channel] = Math.min(min[channel], color.rgb[channel])
      max[channel] = Math.max(max[channel], color.rgb[channel])
    }
    count += color.count
  }

  return {
    colors,
    count,
    range: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

function octreeDiversePalette(colors: WeightedColor[], k: number): Rgb[] {
  let buckets = octreeBucketsFromColors(colors, OCTREE_BUCKET_BITS)
  for (let bits = OCTREE_BUCKET_BITS + 1; bits <= 8 && buckets.length < k * 4; bits += 1) {
    buckets = octreeBucketsFromColors(colors, bits)
  }
  buckets.sort((a, b) => b.count - a.count)
  if (buckets.length <= k) {
    return buckets.map((bucket) => bucket.rgb)
  }

  const palette: WeightedColor[] = [{ rgb: [...buckets[0].rgb] as Rgb, count: buckets[0].count }]
  const selectedBucketIndexes = new Set<number>([0])

  while (palette.length < k) {
    let nextBucket = buckets[palette.length]
    let nextBucketIndex = palette.length
    let nextScore = -1
    for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
      if (selectedBucketIndexes.has(bucketIndex)) {
        continue
      }
      const bucket = buckets[bucketIndex]
      let nearestDist = Number.MAX_VALUE
      for (const entry of palette) {
        nearestDist = Math.min(nearestDist, distSq(bucket.rgb, entry.rgb))
      }
      const score = nearestDist * Math.sqrt(bucket.count)
      if (score > nextScore) {
        nextScore = score
        nextBucket = bucket
        nextBucketIndex = bucketIndex
      }
    }
    palette.push({ rgb: [...nextBucket.rgb] as Rgb, count: nextBucket.count })
    selectedBucketIndexes.add(nextBucketIndex)
    if (palette.length >= buckets.length) {
      break
    }
  }

  return palette.map((entry) => entry.rgb)
}

function octreeBucketsFromColors(colors: WeightedColor[], bits: number): WeightedColor[] {
  const buckets = new Map<number, { sums: Rgb; count: number }>()
  const shift = 8 - bits

  for (const color of colors) {
    const r = clampByte(color.rgb[0])
    const g = clampByte(color.rgb[1])
    const b = clampByte(color.rgb[2])
    const key = ((r >> shift) << (bits * 2)) | ((g >> shift) << bits) | (b >> shift)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.sums[0] += color.rgb[0] * color.count
      bucket.sums[1] += color.rgb[1] * color.count
      bucket.sums[2] += color.rgb[2] * color.count
      bucket.count += color.count
    } else {
      buckets.set(key, {
        sums: [
          color.rgb[0] * color.count,
          color.rgb[1] * color.count,
          color.rgb[2] * color.count,
        ],
        count: color.count,
      })
    }
  }

  return Array.from(buckets.values(), ({ sums, count }) => ({
    rgb: [sums[0] / count, sums[1] / count, sums[2] / count],
    count,
  }))
}

function seededPalette(
  colors: WeightedColor[],
  k: number,
  seed: number,
  metric: 'rgb' | 'oklab',
): Rgb[] {
  const rng = createPrng(seed)
  const palette: Rgb[] = []
  const weights = Float64Array.from(colors, (color) => color.count)
  const totalWeight = colors.reduce((sum, color) => sum + color.count, 0)
  palette.push([...colors[sampleWeightedIndex(rng, weights, totalWeight)].rgb])
  const distances = new Float64Array(colors.length)
  distances.fill(Number.MAX_VALUE)

  for (let next = 1; next < k; next += 1) {
    const last = palette[palette.length - 1]
    let totalDistance = 0
    for (let i = 0; i < colors.length; i += 1) {
      const d = colorDistance(colors[i].rgb, last, metric) * colors[i].count
      if (d < distances[i]) {
        distances[i] = d
      }
      totalDistance += distances[i]
    }
    const index =
      totalDistance <= 0 ? sampleIndex(rng, colors.length) : sampleWeightedIndex(rng, distances, totalDistance)
    palette.push([...colors[index].rgb])
  }

  return palette
}

function refinePalette(
  colors: WeightedColor[],
  initialPalette: Rgb[],
  iterations: number,
  metric: 'rgb' | 'oklab',
): Rgb[] {
  let palette = initialPalette.map((color) => [...color] as Rgb)

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sums = Array.from({ length: palette.length }, () => [0, 0, 0] as Rgb)
    const labSums = Array.from({ length: palette.length }, () => [0, 0, 0] as Lab)
    const counts = new Array<number>(palette.length).fill(0)

    for (const color of colors) {
      const nearest = nearestPaletteIndex(color.rgb, palette, metric)
      if (metric === 'oklab') {
        const lab = color.lab ?? rgbToOklab(color.rgb)
        color.lab = lab
        labSums[nearest][0] += lab[0] * color.count
        labSums[nearest][1] += lab[1] * color.count
        labSums[nearest][2] += lab[2] * color.count
      } else {
        sums[nearest][0] += color.rgb[0] * color.count
        sums[nearest][1] += color.rgb[1] * color.count
        sums[nearest][2] += color.rgb[2] * color.count
      }
      counts[nearest] += color.count
    }

    let maxMovement = 0
    palette = palette.map((color, index) => {
      if (counts[index] === 0) {
        return color
      }
      const next: Rgb =
        metric === 'oklab'
          ? oklabToRgb([
              labSums[index][0] / counts[index],
              labSums[index][1] / counts[index],
              labSums[index][2] / counts[index],
            ])
          : [
              sums[index][0] / counts[index],
              sums[index][1] / counts[index],
              sums[index][2] / counts[index],
            ]
      maxMovement = Math.max(maxMovement, colorDistance(color, next, metric))
      return next
    })

    if (maxMovement < 0.0001) {
      break
    }
  }

  return palette
}

function averageColor(colors: WeightedColor[]): Rgb {
  const sums = [0, 0, 0] as Rgb
  let count = 0

  for (const color of colors) {
    sums[0] += color.rgb[0] * color.count
    sums[1] += color.rgb[1] * color.count
    sums[2] += color.rgb[2] * color.count
    count += color.count
  }

  return count > 0 ? [sums[0] / count, sums[1] / count, sums[2] / count] : [0, 0, 0]
}

function applyPalette(
  img: RgbaImageData,
  palette: Rgb[],
  metric: 'rgb' | 'oklab',
): RgbaImageData {
  const output = {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data.length),
  }

  for (let i = 0; i < img.data.length; i += 4) {
    const alpha = img.data[i + 3]
    if (alpha === 0) {
      output.data.set(img.data.slice(i, i + 4), i)
      continue
    }

    const pixel: Rgb = [img.data[i], img.data[i + 1], img.data[i + 2]]
    const nearest = palette[nearestPaletteIndex(pixel, palette, metric)] ?? pixel
    output.data[i] = clampByte(nearest[0])
    output.data[i + 1] = clampByte(nearest[1])
    output.data[i + 2] = clampByte(nearest[2])
    output.data[i + 3] = alpha
  }

  return output
}

function nearestPaletteIndex(pixel: Rgb, palette: Rgb[], metric: 'rgb' | 'oklab'): number {
  let nearest = 0
  let nearestDist = Number.MAX_VALUE

  for (let i = 0; i < palette.length; i += 1) {
    const d = colorDistance(pixel, palette[i], metric)
    if (d < nearestDist) {
      nearestDist = d
      nearest = i
    }
  }

  return nearest
}

function colorDistance(a: Rgb, b: Rgb, metric: 'rgb' | 'oklab'): number {
  if (metric === 'rgb') {
    return distSq(a, b)
  }
  const labA = rgbToOklab(a)
  const labB = rgbToOklab(b)
  const dl = labA[0] - labB[0]
  const da = labA[1] - labB[1]
  const db = labA[2] - labB[2]
  return dl * dl + da * da + db * db
}

function rgbToOklab(rgb: Rgb): Lab {
  const r = srgbToLinear(rgb[0] / 255)
  const g = srgbToLinear(rgb[1] / 255)
  const b = srgbToLinear(rgb[2] / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function oklabToRgb(lab: Lab): Rgb {
  const l = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2]
  const m = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2]
  const s = lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2]
  const l3 = l * l * l
  const m3 = m * m * m
  const s3 = s * s * s

  return [
    linearToSrgb(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3) * 255,
    linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3) * 255,
    linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3) * 255,
  ]
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value))
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}
