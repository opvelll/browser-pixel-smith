import type { PixelSnapperConfig } from '../pixelSnapper'

export type PixelSnapperControlField = {
  key: keyof PixelSnapperConfig
  label: string
  min: number
  max: number
  step: number
}

export const PIXEL_SNAPPER_CONTROL_FIELDS: PixelSnapperControlField[] = [
  { key: 'kColors', label: 'Colors', min: 1, max: 256, step: 1 },
  { key: 'kSeed', label: 'Seed', min: 0, max: 9999, step: 1 },
  { key: 'maxKmeansIterations', label: 'K-means iter', min: 1, max: 80, step: 1 },
  { key: 'peakThresholdMultiplier', label: 'Peak threshold', min: 0.01, max: 2, step: 0.01 },
  { key: 'peakDistanceFilter', label: 'Peak distance', min: 1, max: 32, step: 1 },
  { key: 'walkerSearchWindowRatio', label: 'Search ratio', min: 0.01, max: 2, step: 0.01 },
  { key: 'walkerMinSearchWindow', label: 'Min window', min: 1, max: 32, step: 1 },
  { key: 'walkerStrengthThreshold', label: 'Strength', min: 0.01, max: 2, step: 0.01 },
  { key: 'minCutsPerAxis', label: 'Min cuts', min: 2, max: 64, step: 1 },
  { key: 'fallbackTargetSegments', label: 'Fallback cells', min: 2, max: 512, step: 1 },
  { key: 'maxStepRatio', label: 'Step ratio', min: 1, max: 8, step: 0.1 },
]
