import { validateImageDimensions } from '../pixelSnapper'

export async function fileToImageData(file: File): Promise<ImageData> {
  if (file.size === 0) {
    throw new Error('File is empty')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file')
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not decode the image file')
  })

  try {
    validateImageDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('Canvas is not available')
    }
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

export function drawImageData(canvas: HTMLCanvasElement | null, imageData: ImageData) {
  if (!canvas) {
    return
  }

  canvas.width = imageData.width
  canvas.height = imageData.height
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  context.putImageData(imageData, 0, 0)
}

export function imageDataToBlob(imageData: ImageData, callback: (blob: Blob | null) => void) {
  const canvas = document.createElement('canvas')
  drawImageData(canvas, imageData)
  canvas.toBlob(callback, 'image/png')
}

export function cloneImageData(imageData: ImageData) {
  return new ImageData(Uint8ClampedArray.from(imageData.data), imageData.width, imageData.height)
}
