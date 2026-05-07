export type ResizeAlgorithm = 'nearestNeighbor' | 'smooth'

export type ResizeConfig = {
  scale: number
  algorithm: ResizeAlgorithm
}
