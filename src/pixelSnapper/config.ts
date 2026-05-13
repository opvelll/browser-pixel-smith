import type { PixelSnapperConfig } from "./types";

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
};
