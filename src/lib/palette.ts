import type { PaletteColor } from '../types/images'

export type RgbColor = {
  r: number
  g: number
  b: number
}

function toHexChannel(value: number) {
  return value.toString(16).padStart(2, '0').toUpperCase()
}

export function collectImagePalette(imageData: ImageData): PaletteColor[] {
  const counts = new Map<number, number>()

  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i + 3] === 0) {
      continue
    }

    const r = imageData.data[i]
    const g = imageData.data[i + 1]
    const b = imageData.data[i + 2]
    const packed = (r << 16) | (g << 8) | b
    counts.set(packed, (counts.get(packed) ?? 0) + 1)
  }

  return Array.from(counts, ([packed, count]) => {
    const r = (packed >> 16) & 255
    const g = (packed >> 8) & 255
    const b = packed & 255
    const hex = `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`

    return { r, g, b, hex, count }
  }).sort((a, b) => {
    const countComparison = b.count - a.count
    return countComparison === 0 ? a.hex.localeCompare(b.hex) : countComparison
  })
}

export function createExactColorMask(imageData: ImageData, color: RgbColor) {
  const mask = new Uint8Array(imageData.width * imageData.height)

  for (let index = 0; index < mask.length; index += 1) {
    const offset = index * 4
    if (imageData.data[offset + 3] === 0) {
      continue
    }

    if (
      imageData.data[offset] === color.r &&
      imageData.data[offset + 1] === color.g &&
      imageData.data[offset + 2] === color.b
    ) {
      mask[index] = 1
    }
  }

  return mask
}

export function replaceImageColor(
  imageData: ImageData,
  beforeColor: RgbColor,
  afterColor: RgbColor,
) {
  const nextImageData = new ImageData(
    Uint8ClampedArray.from(imageData.data),
    imageData.width,
    imageData.height,
  )

  for (let i = 0; i < nextImageData.data.length; i += 4) {
    if (nextImageData.data[i + 3] === 0) {
      continue
    }

    if (
      nextImageData.data[i] === beforeColor.r &&
      nextImageData.data[i + 1] === beforeColor.g &&
      nextImageData.data[i + 2] === beforeColor.b
    ) {
      nextImageData.data[i] = afterColor.r
      nextImageData.data[i + 1] = afterColor.g
      nextImageData.data[i + 2] = afterColor.b
    }
  }

  return nextImageData
}
