export function validateImageDimensions(width: number, height: number): void {
  if (width === 0 || height === 0) {
    throw new Error('Image dimensions cannot be zero')
  }
  if (width > 10000 || height > 10000) {
    throw new Error('Image dimensions too large (max 10000x10000)')
  }
}
