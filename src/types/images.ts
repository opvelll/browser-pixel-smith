export type LoadedImage = {
  fileName: string
  imageData: ImageData
}

export type PaletteColor = {
  r: number
  g: number
  b: number
  hex: string
  count: number
}

export type HistoryEntry = {
  id: number
  label: string
  fileName: string
  imageData: ImageData
}

export type ExpandedImage = {
  label: string
  fileName: string
  imageData: ImageData
}
