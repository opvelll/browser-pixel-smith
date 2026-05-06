import type { PixelSnapperConfig, RgbaImageData } from './types'

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
