import type { PixelSnapperConfig, QuantizeConfig } from './types'

export const defaultPixelSnapperConfig: PixelSnapperConfig = {
  kColors: 32,
  kSeed: 42,
  maxKmeansIterations: 15,
  peakThresholdMultiplier: 0.12,
  peakDistanceFilter: 2,
  walkerSearchWindowRatio: 0.2,
  walkerMinSearchWindow: 1,
  walkerStrengthThreshold: 0.65,
  minCutsPerAxis: 4,
  fallbackTargetSegments: 128,
  maxStepRatio: 3,
}

export const defaultQuantizeConfig: QuantizeConfig = {
  colors: 32,
  method: 'oklabRefine',
  seed: 42,
  refineIterations: 8,
}
