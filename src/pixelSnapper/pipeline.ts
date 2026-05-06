import { defaultPixelSnapperConfig } from './config'
import { resolveStepSizes, stabilizeBothAxes, walk } from './grid'
import { cloneRgbaImageData } from './math'
import { computeProfiles, estimateStepSize } from './profiles'
import { quantizeImage } from './quantize'
import { resample } from './resample'
import type { PixelSnapperConfig } from './types'
import { validateImageDimensions } from './validation'

export function processPixelSnap(
  imageData: ImageData,
  partialConfig: Partial<PixelSnapperConfig> = {},
): ImageData {
  const config = { ...defaultPixelSnapperConfig, ...partialConfig }
  validateImageDimensions(imageData.width, imageData.height)

  const source = cloneRgbaImageData(imageData)
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
