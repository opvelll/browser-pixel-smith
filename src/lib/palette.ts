import type { PaletteColor } from '../types/images'

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
