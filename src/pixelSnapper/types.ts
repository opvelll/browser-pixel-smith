export type RgbaImageData = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type QuantizeMethod = 'medianCut' | 'oklabRefine' | 'octreeRefine'

export type QuantizeConfig = {
  colors: number
  method: QuantizeMethod
  seed: number
  refineIterations: number
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
