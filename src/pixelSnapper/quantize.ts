import { cloneRgbaImageData, createPrng, distSq, sampleIndex, sampleWeightedIndex } from './math'
import type { PixelSnapperConfig, RgbaImageData } from './types'

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
    return cloneRgbaImageData(img)
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
