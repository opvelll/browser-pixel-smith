import type { PixelSnapperConfig } from './types'

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
