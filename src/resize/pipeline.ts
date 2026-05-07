import { validateImageDimensions } from '../pixelSnapper'
import { defaultResizeConfig } from './config'
import type { ResizeConfig } from './types'

export function processResize(
  imageData: ImageData,
  partialConfig: Partial<ResizeConfig> = {},
): ImageData {
  const config = { ...defaultResizeConfig, ...partialConfig }
  if (!Number.isFinite(config.scale) || config.scale <= 0) {
    throw new Error('Resize scale must be greater than zero')
  }

  const width = Math.max(1, Math.round(imageData.width * config.scale))
  const height = Math.max(1, Math.round(imageData.height * config.scale))
  validateImageDimensions(width, height)

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = imageData.width
  sourceCanvas.height = imageData.height
  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) {
    throw new Error('Canvas is not available')
  }
  sourceContext.putImageData(imageData, 0, 0)

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = width
  outputCanvas.height = height
  const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!outputContext) {
    throw new Error('Canvas is not available')
  }

  outputContext.imageSmoothingEnabled = config.algorithm === 'smooth'
  outputContext.drawImage(sourceCanvas, 0, 0, width, height)

  return outputContext.getImageData(0, 0, width, height)
}
