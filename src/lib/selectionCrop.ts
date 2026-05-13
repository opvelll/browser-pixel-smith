export type ImagePoint = {
  x: number
  y: number
}

export type SelectionBounds = {
  x: number
  y: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function createRectangleSelectionMask(
  width: number,
  height: number,
  start: ImagePoint,
  end: ImagePoint,
) {
  const mask = new Uint8Array(width * height)
  const minX = clamp(Math.min(start.x, end.x), 0, width - 1)
  const maxX = clamp(Math.max(start.x, end.x), 0, width - 1)
  const minY = clamp(Math.min(start.y, end.y), 0, height - 1)
  const maxY = clamp(Math.max(start.y, end.y), 0, height - 1)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      mask[y * width + x] = 1
    }
  }

  return mask
}

function isPointInsidePolygon(point: ImagePoint, polygon: ImagePoint[]) {
  let isInside = false

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    const crossesScanline =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || 1) +
          currentPoint.x

    if (crossesScanline) {
      isInside = !isInside
    }
  }

  return isInside
}

export function createLassoSelectionMask(width: number, height: number, polygon: ImagePoint[]) {
  const mask = new Uint8Array(width * height)
  if (polygon.length < 3) {
    return mask
  }

  const bounds = polygon.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y),
    }),
    {
      minX: width - 1,
      maxX: 0,
      minY: height - 1,
      maxY: 0,
    },
  )

  const minX = clamp(bounds.minX, 0, width - 1)
  const maxX = clamp(bounds.maxX, 0, width - 1)
  const minY = clamp(bounds.minY, 0, height - 1)
  const maxY = clamp(bounds.maxY, 0, height - 1)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (isPointInsidePolygon({ x: x + 0.5, y: y + 0.5 }, polygon)) {
        mask[y * width + x] = 1
      }
    }
  }

  return mask
}

export function getSelectionBounds(mask: Uint8Array, width: number, height: number) {
  if (mask.length !== width * height) {
    throw new Error('Selection does not match the image size')
  }

  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) {
      continue
    }

    const x = index % width
    const y = Math.floor(index / width)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  if (maxX < minX || maxY < minY) {
    return null
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  } satisfies SelectionBounds
}

export function cropSelectionToImage(imageData: ImageData, mask: Uint8Array) {
  const bounds = getSelectionBounds(mask, imageData.width, imageData.height)
  if (!bounds) {
    throw new Error('Selection is empty')
  }

  const cropped = new ImageData(bounds.width, bounds.height)

  for (let y = 0; y < bounds.height; y += 1) {
    for (let x = 0; x < bounds.width; x += 1) {
      const sourceX = bounds.x + x
      const sourceY = bounds.y + y
      const sourceIndex = sourceY * imageData.width + sourceX
      const targetIndex = y * bounds.width + x

      if (!mask[sourceIndex]) {
        continue
      }

      const sourceOffset = sourceIndex * 4
      const targetOffset = targetIndex * 4
      cropped.data[targetOffset] = imageData.data[sourceOffset]
      cropped.data[targetOffset + 1] = imageData.data[sourceOffset + 1]
      cropped.data[targetOffset + 2] = imageData.data[sourceOffset + 2]
      cropped.data[targetOffset + 3] = imageData.data[sourceOffset + 3]
    }
  }

  return cropped
}
