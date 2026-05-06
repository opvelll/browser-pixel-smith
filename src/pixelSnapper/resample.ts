import { packRgba } from './math'
import type { RgbaImageData } from './types'

export function resample(img: RgbaImageData, cols: number[], rows: number[]): RgbaImageData {
  if (cols.length < 2 || rows.length < 2) {
    throw new Error('Insufficient grid cuts for resampling')
  }

  const outWidth = Math.max(cols.length, 1) - 1
  const outHeight = Math.max(rows.length, 1) - 1
  const output = {
    width: outWidth,
    height: outHeight,
    data: new Uint8ClampedArray(outWidth * outHeight * 4),
  }

  for (let yI = 0; yI < rows.length - 1; yI += 1) {
    for (let xI = 0; xI < cols.length - 1; xI += 1) {
      const ys = rows[yI]
      const ye = rows[yI + 1]
      const xs = cols[xI]
      const xe = cols[xI + 1]
      if (xe <= xs || ye <= ys) {
        continue
      }

      const counts = new Map<number, number>()
      for (let y = ys; y < ye; y += 1) {
        for (let x = xs; x < xe; x += 1) {
          if (x < img.width && y < img.height) {
            const idx = (y * img.width + x) * 4
            const packed = packRgba(
              img.data[idx],
              img.data[idx + 1],
              img.data[idx + 2],
              img.data[idx + 3],
            )
            counts.set(packed, (counts.get(packed) ?? 0) + 1)
          }
        }
      }

      const candidates = [...counts.entries()].sort((a, b) => {
        const countCmp = b[1] - a[1]
        return countCmp === 0 ? a[0] - b[0] : countCmp
      })
      const winner = candidates[0]?.[0] ?? 0
      const outIdx = (yI * outWidth + xI) * 4
      output.data[outIdx] = winner & 0xff
      output.data[outIdx + 1] = (winner >>> 8) & 0xff
      output.data[outIdx + 2] = (winner >>> 16) & 0xff
      output.data[outIdx + 3] = (winner >>> 24) & 0xff
    }
  }

  return output
}
