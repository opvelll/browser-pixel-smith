export type RgbaImageData = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type PixelSnapperConfig = {
  kColors: number
  kSeed: number
  maxKmeansIterations: number
  peakThresholdMultiplier: number
  peakDistanceFilter: number
  walkerSearchWindowRatio: number
  walkerMinSearchWindow: number
  walkerStrengthThreshold: number
  minCutsPerAxis: number
  fallbackTargetSegments: number
  maxStepRatio: number
}

export const defaultPixelSnapperConfig: PixelSnapperConfig = {
  kColors: 16,
  kSeed: 42,
  maxKmeansIterations: 15,
  peakThresholdMultiplier: 0.2,
  peakDistanceFilter: 4,
  walkerSearchWindowRatio: 0.35,
  walkerMinSearchWindow: 2,
  walkerStrengthThreshold: 0.5,
  minCutsPerAxis: 4,
  fallbackTargetSegments: 64,
  maxStepRatio: 1.8,
}

export function validateImageDimensions(width: number, height: number): void {
  if (width === 0 || height === 0) {
    throw new Error('Image dimensions cannot be zero')
  }
  if (width > 10000 || height > 10000) {
    throw new Error('Image dimensions too large (max 10000x10000)')
  }
}

export function processPixelSnap(
  imageData: ImageData,
  partialConfig: Partial<PixelSnapperConfig> = {},
): ImageData {
  const config = { ...defaultPixelSnapperConfig, ...partialConfig }
  validateImageDimensions(imageData.width, imageData.height)

  const source = cloneImageData(imageData)
  const quantizedImage = quantizeImage(source, config)
  const { profileX, profileY } = computeProfiles(quantizedImage)
  const stepXOpt = estimateStepSize(profileX, config)
  const stepYOpt = estimateStepSize(profileY, config)
  const { stepX, stepY } = resolveStepSizes(
    stepXOpt,
    stepYOpt,
    source.width,
    source.height,
    config,
  )
  const rawColCuts = walk(profileX, stepX, source.width, config)
  const rawRowCuts = walk(profileY, stepY, source.height, config)
  const { colCuts, rowCuts } = stabilizeBothAxes(
    profileX,
    profileY,
    rawColCuts,
    rawRowCuts,
    source.width,
    source.height,
    config,
  )
  const output = resample(quantizedImage, colCuts, rowCuts)

  return new ImageData(Uint8ClampedArray.from(output.data), output.width, output.height)
}

export function quantizeImage(
  img: RgbaImageData,
  config: PixelSnapperConfig,
): RgbaImageData {
  if (config.kColors <= 0 || !Number.isFinite(config.kColors)) {
    throw new Error('Number of colors must be greater than 0')
  }

  const opaquePixels: Array<[number, number, number]> = []
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] !== 0) {
      opaquePixels.push([img.data[i], img.data[i + 1], img.data[i + 2]])
    }
  }

  const nPixels = opaquePixels.length
  if (nPixels === 0) {
    return cloneImageData(img)
  }

  const rng = createPrng(config.kSeed)
  const k = Math.min(Math.trunc(config.kColors), nPixels)
  const centroids: Array<[number, number, number]> = []
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

  const prevCentroids = centroids.map((centroid) => [...centroid] as [number, number, number])
  for (let iteration = 0; iteration < config.maxKmeansIterations; iteration += 1) {
    const sums = Array.from({ length: k }, () => [0, 0, 0] as [number, number, number])
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

  const newImg = {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data.length),
  }

  for (let i = 0; i < img.data.length; i += 4) {
    const alpha = img.data[i + 3]
    if (alpha === 0) {
      newImg.data.set(img.data.slice(i, i + 4), i)
      continue
    }

    const pixel: [number, number, number] = [img.data[i], img.data[i + 1], img.data[i + 2]]
    let minDist = Number.MAX_VALUE
    let bestCentroid = pixel

    for (const centroid of centroids) {
      const d = distSq(pixel, centroid)
      if (d < minDist) {
        minDist = d
        bestCentroid = centroid
      }
    }

    newImg.data[i] = Math.round(bestCentroid[0])
    newImg.data[i + 1] = Math.round(bestCentroid[1])
    newImg.data[i + 2] = Math.round(bestCentroid[2])
    newImg.data[i + 3] = alpha
  }

  return newImg
}

export function computeProfiles(img: RgbaImageData): {
  profileX: number[]
  profileY: number[]
} {
  const { width, height } = img
  if (width < 3 || height < 3) {
    throw new Error('Image too small (minimum 3x3)')
  }

  const colProj = new Array<number>(width).fill(0)
  const rowProj = new Array<number>(height).fill(0)

  const gray = (x: number, y: number) => {
    const i = (y * width + x) * 4
    if (img.data[i + 3] === 0) {
      return 0
    }
    return 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      colProj[x] += Math.abs(gray(x + 1, y) - gray(x - 1, y))
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      rowProj[y] += Math.abs(gray(x, y + 1) - gray(x, y - 1))
    }
  }

  return { profileX: colProj, profileY: rowProj }
}

export function estimateStepSize(
  profile: number[],
  config: PixelSnapperConfig,
): number | null {
  if (profile.length === 0) {
    return null
  }

  const maxVal = profile.reduce((max, value) => Math.max(max, value), Number.NEGATIVE_INFINITY)
  if (maxVal === 0 || !Number.isFinite(maxVal)) {
    return null
  }

  const threshold = maxVal * config.peakThresholdMultiplier
  const peaks: number[] = []
  for (let i = 1; i < profile.length - 1; i += 1) {
    if (profile[i] > threshold && profile[i] > profile[i - 1] && profile[i] > profile[i + 1]) {
      peaks.push(i)
    }
  }

  if (peaks.length < 2) {
    return null
  }

  const cleanPeaks = [peaks[0]]
  for (const peak of peaks.slice(1)) {
    if (peak - cleanPeaks[cleanPeaks.length - 1] > config.peakDistanceFilter - 1) {
      cleanPeaks.push(peak)
    }
  }

  if (cleanPeaks.length < 2) {
    return null
  }

  const diffs = cleanPeaks
    .slice(1)
    .map((peak, index) => peak - cleanPeaks[index])
    .sort((a, b) => a - b)

  return diffs[Math.floor(diffs.length / 2)]
}

export function resolveStepSizes(
  stepXOpt: number | null,
  stepYOpt: number | null,
  width: number,
  height: number,
  config: PixelSnapperConfig,
): { stepX: number; stepY: number } {
  if (stepXOpt != null && stepYOpt != null) {
    const ratio = stepXOpt > stepYOpt ? stepXOpt / stepYOpt : stepYOpt / stepXOpt
    if (ratio > config.maxStepRatio) {
      const smaller = Math.min(stepXOpt, stepYOpt)
      return { stepX: smaller, stepY: smaller }
    }
    const average = (stepXOpt + stepYOpt) / 2
    return { stepX: average, stepY: average }
  }

  if (stepXOpt != null) {
    return { stepX: stepXOpt, stepY: stepXOpt }
  }
  if (stepYOpt != null) {
    return { stepX: stepYOpt, stepY: stepYOpt }
  }

  const fallbackStep = Math.max(Math.min(width, height) / config.fallbackTargetSegments, 1)
  return { stepX: fallbackStep, stepY: fallbackStep }
}

export function walk(
  profile: number[],
  stepSize: number,
  limit: number,
  config: PixelSnapperConfig,
): number[] {
  if (profile.length === 0) {
    throw new Error('Cannot walk on empty profile')
  }

  const cuts = [0]
  let currentPos = 0
  const searchWindow = Math.max(
    stepSize * config.walkerSearchWindowRatio,
    config.walkerMinSearchWindow,
  )
  const meanVal = profile.reduce((sum, value) => sum + value, 0) / profile.length

  while (currentPos < limit) {
    const target = currentPos + stepSize
    if (target >= limit) {
      cuts.push(limit)
      break
    }

    const startSearch = Math.max(Math.trunc(target - searchWindow), Math.trunc(currentPos + 1))
    const endSearch = Math.min(Math.trunc(target + searchWindow), limit)

    if (endSearch <= startSearch) {
      currentPos = target
      continue
    }

    let maxVal = -1
    let maxIdx = startSearch
    for (let i = startSearch; i < endSearch; i += 1) {
      if ((profile[i] ?? 0) > maxVal) {
        maxVal = profile[i]
        maxIdx = i
      }
    }

    if (maxVal > meanVal * config.walkerStrengthThreshold) {
      cuts.push(maxIdx)
      currentPos = maxIdx
    } else {
      cuts.push(Math.trunc(target))
      currentPos = target
    }
  }

  return cuts
}

export function stabilizeBothAxes(
  profileX: number[],
  profileY: number[],
  rawColCuts: number[],
  rawRowCuts: number[],
  width: number,
  height: number,
  config: PixelSnapperConfig,
): { colCuts: number[]; rowCuts: number[] } {
  const colCutsPass1 = stabilizeCuts(profileX, rawColCuts, width, rawRowCuts, height, config)
  const rowCutsPass1 = stabilizeCuts(profileY, rawRowCuts, height, rawColCuts, width, config)

  const colCells = Math.max(colCutsPass1.length - 1, 1)
  const rowCells = Math.max(rowCutsPass1.length - 1, 1)
  const colStep = width / colCells
  const rowStep = height / rowCells
  const stepRatio = colStep > rowStep ? colStep / rowStep : rowStep / colStep

  if (stepRatio > config.maxStepRatio) {
    const targetStep = Math.min(colStep, rowStep)
    const finalColCuts =
      colStep > targetStep * 1.2
        ? snapUniformCuts(profileX, width, targetStep, config, config.minCutsPerAxis)
        : colCutsPass1
    const finalRowCuts =
      rowStep > targetStep * 1.2
        ? snapUniformCuts(profileY, height, targetStep, config, config.minCutsPerAxis)
        : rowCutsPass1

    return { colCuts: finalColCuts, rowCuts: finalRowCuts }
  }

  return { colCuts: colCutsPass1, rowCuts: rowCutsPass1 }
}

export function resample(img: RgbaImageData, cols: number[], rows: number[]): RgbaImageData {
  if (cols.length < 2 || rows.length < 2) {
    throw new Error('Insufficient grid cuts for resampling')
  }

  const outWidth = Math.max(cols.length, 1) - 1
  const outHeight = Math.max(rows.length, 1) - 1
  const output = {
    width: outWidth,
    height: outHeight,
    data: new Uint8ClampedArray(outWidth * outHeight * 4),
  }

  for (let yI = 0; yI < rows.length - 1; yI += 1) {
    for (let xI = 0; xI < cols.length - 1; xI += 1) {
      const ys = rows[yI]
      const ye = rows[yI + 1]
      const xs = cols[xI]
      const xe = cols[xI + 1]
      if (xe <= xs || ye <= ys) {
        continue
      }

      const counts = new Map<number, number>()
      for (let y = ys; y < ye; y += 1) {
        for (let x = xs; x < xe; x += 1) {
          if (x < img.width && y < img.height) {
            const idx = (y * img.width + x) * 4
            const packed = packRgba(
              img.data[idx],
              img.data[idx + 1],
              img.data[idx + 2],
              img.data[idx + 3],
            )
            counts.set(packed, (counts.get(packed) ?? 0) + 1)
          }
        }
      }

      const candidates = [...counts.entries()].sort((a, b) => {
        const countCmp = b[1] - a[1]
        return countCmp === 0 ? a[0] - b[0] : countCmp
      })
      const winner = candidates[0]?.[0] ?? 0
      const outIdx = (yI * outWidth + xI) * 4
      output.data[outIdx] = winner & 0xff
      output.data[outIdx + 1] = (winner >>> 8) & 0xff
      output.data[outIdx + 2] = (winner >>> 16) & 0xff
      output.data[outIdx + 3] = (winner >>> 24) & 0xff
    }
  }

  return output
}

function stabilizeCuts(
  profile: number[],
  cuts: number[],
  limit: number,
  siblingCuts: number[],
  siblingLimit: number,
  config: PixelSnapperConfig,
): number[] {
  if (limit === 0) {
    return [0]
  }

  const sanitizedCuts = sanitizeCuts(cuts, limit)
  const minRequired = Math.min(Math.max(config.minCutsPerAxis, 2), limit + 1)
  const axisCells = sanitizedCuts.length - 1
  const siblingCells = siblingCuts.length - 1
  const siblingHasGrid = siblingLimit > 0 && siblingCells >= minRequired - 1 && siblingCells > 0
  const stepsSkewed =
    siblingHasGrid &&
    axisCells > 0 &&
    (() => {
      const axisStep = limit / axisCells
      const siblingStep = siblingLimit / siblingCells
      const stepRatio = axisStep / siblingStep
      return stepRatio > config.maxStepRatio || stepRatio < 1 / config.maxStepRatio
    })()
  const hasEnough = sanitizedCuts.length >= minRequired

  if (hasEnough && !stepsSkewed) {
    return sanitizedCuts
  }

  let targetStep: number
  if (siblingHasGrid) {
    targetStep = siblingLimit / siblingCells
  } else if (config.fallbackTargetSegments > 1) {
    targetStep = limit / config.fallbackTargetSegments
  } else if (axisCells > 0) {
    targetStep = limit / axisCells
  } else {
    targetStep = limit
  }

  if (!Number.isFinite(targetStep) || targetStep <= 0) {
    targetStep = 1
  }

  return snapUniformCuts(profile, limit, targetStep, config, minRequired)
}

function sanitizeCuts(cuts: number[], limit: number): number[] {
  if (limit === 0) {
    return [0]
  }

  let hasZero = false
  let hasLimit = false
  const sanitized = cuts.map((value) => {
    let nextValue = Math.trunc(value)
    if (nextValue === 0) {
      hasZero = true
    }
    if (nextValue >= limit) {
      nextValue = limit
    }
    if (nextValue === limit) {
      hasLimit = true
    }
    return nextValue
  })

  if (!hasZero) {
    sanitized.push(0)
  }
  if (!hasLimit) {
    sanitized.push(limit)
  }

  return [...new Set(sanitized.sort((a, b) => a - b))]
}

function snapUniformCuts(
  profile: number[],
  limit: number,
  targetStep: number,
  config: PixelSnapperConfig,
  minRequired: number,
): number[] {
  if (limit === 0) {
    return [0]
  }
  if (limit === 1) {
    return [0, 1]
  }

  let desiredCells =
    Number.isFinite(targetStep) && targetStep > 0 ? Math.round(limit / targetStep) : 0
  desiredCells = Math.min(Math.max(desiredCells, Math.max(minRequired - 1, 1)), limit)

  const cellWidth = limit / desiredCells
  const searchWindow = Math.max(
    cellWidth * config.walkerSearchWindowRatio,
    config.walkerMinSearchWindow,
  )
  const meanVal = profile.length
    ? profile.reduce((sum, value) => sum + value, 0) / profile.length
    : 0

  const cuts: number[] = [0]
  for (let idx = 1; idx < desiredCells; idx += 1) {
    const target = cellWidth * idx
    const previous = cuts[cuts.length - 1]
    if (previous + 1 >= limit) {
      break
    }

    let start = Math.max(Math.floor(target - searchWindow), previous + 1, 0)
    let end = Math.min(Math.ceil(target + searchWindow), limit - 1)
    if (end < start) {
      start = previous + 1
      end = start
    }

    let bestIdx = Math.min(start, Math.max(profile.length - 1, 0))
    let bestVal = -1
    for (let i = start; i <= Math.min(end, profile.length - 1); i += 1) {
      const value = profile[i] ?? 0
      if (value > bestVal) {
        bestVal = value
        bestIdx = i
      }
    }

    if (bestVal < meanVal * config.walkerStrengthThreshold) {
      let fallbackIdx = Math.round(target)
      if (fallbackIdx <= previous) {
        fallbackIdx = previous + 1
      }
      if (fallbackIdx >= limit) {
        fallbackIdx = Math.max(limit - 1, previous + 1)
      }
      bestIdx = fallbackIdx
    }

    cuts.push(bestIdx)
  }

  if (cuts[cuts.length - 1] !== limit) {
    cuts.push(limit)
  }
  return sanitizeCuts(cuts, limit)
}

function cloneImageData(img: RgbaImageData): RgbaImageData {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
  }
}

function distSq(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

function sampleIndex(rng: () => number, upper: number): number {
  return Math.floor(rng() * upper)
}

function sampleWeightedIndex(rng: () => number, weights: Float64Array, totalWeight: number): number {
  let target = rng() * totalWeight
  for (let i = 0; i < weights.length; i += 1) {
    target -= weights[i]
    if (target <= 0) {
      return i
    }
  }
  return weights.length - 1
}

function createPrng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function packRgba(r: number, g: number, b: number, a: number): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}
