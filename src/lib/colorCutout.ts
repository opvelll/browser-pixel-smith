export type RgbaColor = {
  r: number
  g: number
  b: number
  a: number
}

export function getPixelColor(imageData: ImageData, x: number, y: number): RgbaColor {
  const clampedX = Math.min(imageData.width - 1, Math.max(0, x))
  const clampedY = Math.min(imageData.height - 1, Math.max(0, y))
  const offset = (clampedY * imageData.width + clampedX) * 4

  return {
    r: imageData.data[offset],
    g: imageData.data[offset + 1],
    b: imageData.data[offset + 2],
    a: imageData.data[offset + 3],
  }
}

export function colorDistanceRgb(first: RgbaColor, second: RgbaColor) {
  const red = first.r - second.r
  const green = first.g - second.g
  const blue = first.b - second.b

  return Math.sqrt(red * red + green * green + blue * blue)
}

export function createColorSelectionMask(
  imageData: ImageData,
  selectedColor: RgbaColor,
  tolerance: number,
) {
  const mask = new Uint8Array(imageData.width * imageData.height)
  const safeTolerance = Math.max(0, tolerance)

  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4
    const candidate = {
      r: imageData.data[offset],
      g: imageData.data[offset + 1],
      b: imageData.data[offset + 2],
      a: imageData.data[offset + 3],
    }

    if (colorDistanceRgb(candidate, selectedColor) <= safeTolerance) {
      mask[index] = 1
    }
  }

  return mask
}

export function countSelectionPixels(mask: Uint8Array | null) {
  if (!mask) {
    return 0
  }

  let count = 0
  for (let index = 0; index < mask.length; index += 1) {
    count += mask[index]
  }

  return count
}

export function applySelectionCutout(imageData: ImageData, mask: Uint8Array) {
  if (mask.length !== imageData.width * imageData.height) {
    throw new Error('Selection does not match the image size')
  }

  const nextImageData = new ImageData(
    Uint8ClampedArray.from(imageData.data),
    imageData.width,
    imageData.height,
  )

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) {
      nextImageData.data[index * 4 + 3] = 0
    }
  }

  return nextImageData
}
