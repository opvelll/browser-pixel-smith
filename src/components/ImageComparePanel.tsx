import {
  Box,
  Download,
  ImagePlus,
  LassoSelect,
  LoaderCircle,
  Maximize2,
  Palette,
  Pipette,
  SquareDashedMousePointer,
  Scissors,
  Target,
  Zap,
} from 'lucide-react'
import type { DragEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  countSelectionPixels,
  createColorSelectionMask,
  getPixelColor,
  type RgbaColor,
} from '../lib/colorCutout'
import { drawImageData } from '../lib/imageData'
import {
  createExactColorMask,
  collectImagePalette,
  replaceImageColor,
  type RgbColor,
} from '../lib/palette'
import {
  createLassoSelectionMask,
  createRectangleSelectionMask,
  type ImagePoint,
} from '../lib/selectionCrop'
import type { PaletteColor } from '../types/images'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 16
const MIN_TOLERANCE = 0
const MAX_TOLERANCE = 441
type ToolMode = 'none' | 'color' | 'rectangle' | 'lasso'
type SelectionBoundarySide = 'top' | 'right' | 'bottom' | 'left'
type SelectionBoundaryEdge = {
  side: SelectionBoundarySide
  x: number
  y: number
}
type SelectionOverlayCache = {
  boundaryEdges: SelectionBoundaryEdge[]
  maskCanvas: HTMLCanvasElement
  width: number
  height: number
}
type PaletteEditState = {
  afterColor: RgbColor
  beforeColor: PaletteColor
  isPicking: boolean
  source: 'result' | 'target'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function colorLabel(color: RgbColor) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function colorsEqual(first: RgbColor, second: RgbColor) {
  return first.r === second.r && first.g === second.g && first.b === second.b
}

function paletteColorToRgb(color: PaletteColor): RgbColor {
  return { r: color.r, g: color.g, b: color.b }
}

function createSelectionBoundaryEdges(mask: Uint8Array, width: number, height: number) {
  const boundaryEdges: SelectionBoundaryEdge[] = []
  if (mask.length !== width * height) {
    return boundaryEdges
  }

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) {
      continue
    }

    const x = index % width
    const y = Math.floor(index / width)
    const top = y === 0 || !mask[index - width]
    const right = x === width - 1 || !mask[index + 1]
    const bottom = y === height - 1 || !mask[index + width]
    const left = x === 0 || !mask[index - 1]

    if (top) {
      boundaryEdges.push({ side: 'top', x, y })
    }
    if (right) {
      boundaryEdges.push({ side: 'right', x, y })
    }
    if (bottom) {
      boundaryEdges.push({ side: 'bottom', x, y })
    }
    if (left) {
      boundaryEdges.push({ side: 'left', x, y })
    }
  }

  return boundaryEdges
}

function createSelectionOverlayCache(
  mask: Uint8Array | null,
  width: number,
  height: number,
): SelectionOverlayCache | null {
  if (!mask || mask.length !== width * height) {
    return null
  }

  const boundaryEdges = createSelectionBoundaryEdges(mask, width, height)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const context = maskCanvas.getContext('2d')
  if (!context) {
    return null
  }

  const overlay = context.createImageData(width, height)
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index]) {
      continue
    }

    const offset = index * 4
    overlay.data[offset] = 14
    overlay.data[offset + 1] = 165
    overlay.data[offset + 2] = 233
    overlay.data[offset + 3] = 42
  }
  context.putImageData(overlay, 0, 0)

  return { boundaryEdges, maskCanvas, width, height }
}

function appendBoundaryEdge(context: CanvasRenderingContext2D, edge: SelectionBoundaryEdge) {
  if (edge.side === 'top') {
    context.moveTo(edge.x, edge.y)
    context.lineTo(edge.x + 1, edge.y)
    return
  }
  if (edge.side === 'right') {
    context.moveTo(edge.x + 1, edge.y)
    context.lineTo(edge.x + 1, edge.y + 1)
    return
  }
  if (edge.side === 'bottom') {
    context.moveTo(edge.x + 1, edge.y + 1)
    context.lineTo(edge.x, edge.y + 1)
    return
  }

  context.moveTo(edge.x, edge.y + 1)
  context.lineTo(edge.x, edge.y)
}

function getBoundaryEdgeMarchPosition(edge: SelectionBoundaryEdge) {
  return edge.side === 'top' || edge.side === 'bottom' ? edge.x : edge.y
}

function drawSelectionOverlay(
  canvas: HTMLCanvasElement | null,
  cache: SelectionOverlayCache | null,
  dashOffset: number,
  renderScale = 1,
) {
  if (!canvas) {
    return
  }

  const width = cache ? Math.max(1, Math.round(cache.width * renderScale)) : 1
  const height = cache ? Math.max(1, Math.round(cache.height * renderScale)) : 1
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, width, height)
  if (!cache) {
    return
  }

  const scaleX = width / cache.width
  const scaleY = height / cache.height

  context.imageSmoothingEnabled = false
  context.drawImage(cache.maskCanvas, 0, 0, width, height)
  context.setTransform(scaleX, 0, 0, scaleY, 0, 0)
  context.lineWidth = 1 / Math.max(scaleX, scaleY)
  context.lineCap = 'butt'
  context.lineJoin = 'miter'

  context.setLineDash([])

  context.beginPath()
  for (const edge of cache.boundaryEdges) {
    if (Math.floor((getBoundaryEdgeMarchPosition(edge) + dashOffset) / 4) % 2 === 0) {
      appendBoundaryEdge(context, edge)
    }
  }
  context.strokeStyle = 'rgba(24,24,27,0.95)'
  context.stroke()

  context.beginPath()
  for (const edge of cache.boundaryEdges) {
    if (Math.floor((getBoundaryEdgeMarchPosition(edge) + dashOffset) / 4) % 2 !== 0) {
      appendBoundaryEdge(context, edge)
    }
  }
  context.strokeStyle = 'rgba(255,255,255,0.95)'
  context.stroke()
}

export function ImageComparePanel({
  fileInputRef,
  isDragging = false,
  isLoadingImage = false,
  isProcessing = false,
  resultImage,
  resultPalette,
  targetImage,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onApplyColorCutout,
  onApplyPaletteColorReplace,
  onApplySelectionCrop,
  onApplyTargetPaletteColorReplace,
  onDownloadResult,
  onDownloadTarget,
  onExpandResult,
  onExpandTarget,
  onOpen3dCapture,
  onPromoteResultToTargetForPalette,
  onSetResultAsTarget,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  isDragging?: boolean
  isLoadingImage?: boolean
  isProcessing?: boolean
  resultImage: ImageData | null
  resultPalette: PaletteColor[]
  targetImage: ImageData | null
  onDragEnter?: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
  onApplyColorCutout?: (selectionMask: Uint8Array) => void
  onApplyPaletteColorReplace?: (beforeColor: RgbColor, afterColor: RgbColor) => void
  onApplySelectionCrop?: (selectionMask: Uint8Array) => void
  onApplyTargetPaletteColorReplace?: (beforeColor: RgbColor, afterColor: RgbColor) => void
  onDownloadResult?: () => void
  onDownloadTarget?: () => void
  onExpandResult?: () => void
  onExpandTarget?: () => void
  onOpen3dCapture?: () => void
  onPromoteResultToTargetForPalette?: () => void
  onSetResultAsTarget?: () => void
}) {
  const targetCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [divider, setDivider] = useState(50)
  const [isSliding, setIsSliding] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [toolMode, setToolMode] = useState<ToolMode>('none')
  const [selectedSample, setSelectedSample] = useState<{
    color: RgbaColor
    image: ImageData
  } | null>(null)
  const [manualSelection, setManualSelection] = useState<{
    image: ImageData
    mask: Uint8Array
  } | null>(null)
  const [dragStart, setDragStart] = useState<ImagePoint | null>(null)
  const [lassoPoints, setLassoPoints] = useState<ImagePoint[]>([])
  const [paletteEdit, setPaletteEdit] = useState<PaletteEditState | null>(null)
  const [isTargetPaletteOpen, setIsTargetPaletteOpen] = useState(false)
  const [tolerance, setTolerance] = useState(24)
  const selectedColor = selectedSample?.image === targetImage ? selectedSample.color : null
  const isPaletteEditing = Boolean(paletteEdit)
  const isPalettePicking = Boolean(paletteEdit?.isPicking)
  const isSelectionTool = toolMode !== 'none' || isPaletteEditing
  const isShapeSelectionTool = toolMode === 'rectangle' || toolMode === 'lasso'
  const targetPalette = useMemo(
    () => (targetImage && isTargetPaletteOpen ? collectImagePalette(targetImage) : []),
    [isTargetPaletteOpen, targetImage],
  )
  const activePalette = paletteEdit?.source === 'target' ? targetPalette : resultPalette
  const paletteEditImage = paletteEdit?.source === 'target' ? targetImage : resultImage
  const displayedResultImage = useMemo(() => {
    if (!paletteEdit) {
      return resultImage
    }

    const sourceImage = paletteEdit.source === 'target' ? targetImage : resultImage
    if (!sourceImage) {
      return resultImage
    }

    if (colorsEqual(paletteEdit.beforeColor, paletteEdit.afterColor)) {
      return paletteEdit.source === 'target' ? null : resultImage
    }

    return replaceImageColor(sourceImage, paletteEdit.beforeColor, paletteEdit.afterColor)
  }, [paletteEdit, resultImage, targetImage])
  const hasResultView = Boolean(displayedResultImage)

  const colorSelectionMask = useMemo(() => {
    if (!targetImage || !selectedColor || toolMode !== 'color') {
      return null
    }

    return createColorSelectionMask(targetImage, selectedColor, tolerance)
  }, [selectedColor, targetImage, tolerance, toolMode])
  const paletteSelectionMask = useMemo(() => {
    if (!paletteEditImage || !paletteEdit) {
      return null
    }

    return createExactColorMask(paletteEditImage, paletteEdit.beforeColor)
  }, [paletteEdit, paletteEditImage])
  const manualSelectionMask =
    manualSelection?.image === targetImage && isShapeSelectionTool ? manualSelection.mask : null
  const selectionMask = paletteSelectionMask ?? colorSelectionMask ?? manualSelectionMask
  const selectionCount = useMemo(() => countSelectionPixels(selectionMask), [selectionMask])
  const selectionImage = paletteSelectionMask ? paletteEditImage : targetImage
  const selectionOverlayCache = useMemo(() => {
    if (!selectionImage || selectionCount === 0) {
      return null
    }

    return createSelectionOverlayCache(selectionMask, selectionImage.width, selectionImage.height)
  }, [selectionCount, selectionImage, selectionMask])

  useEffect(() => {
    if (targetImage) {
      drawImageData(targetCanvasRef.current, targetImage)
    }
  }, [targetImage])

  useEffect(() => {
    if (displayedResultImage) {
      drawImageData(resultCanvasRef.current, displayedResultImage)
    }
  }, [displayedResultImage])

  useEffect(() => {
    if (!selectionOverlayCache) {
      drawSelectionOverlay(selectionCanvasRef.current, null, 0)
      return
    }

    let frameId = 0
    const startedAt = performance.now()
    const animate = (time: number) => {
      drawSelectionOverlay(
        selectionCanvasRef.current,
        selectionOverlayCache,
        ((time - startedAt) / 120) % 8,
        zoom,
      )
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [selectionOverlayCache, zoom])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isEditingControl =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement

      if (
        event.key !== 'Delete' ||
        isEditingControl ||
        toolMode !== 'color' ||
        !selectionMask ||
        selectionCount === 0
      ) {
        return
      }

      event.preventDefault()
      onApplyColorCutout?.(selectionMask)
      setSelectedSample(null)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onApplyColorCutout, selectionCount, selectionMask, toolMode])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || (!targetImage && !resultImage)) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const step = event.deltaY < 0 ? 1.1 : 1 / 1.1
      setZoom((current) => clamp(current * step, MIN_ZOOM, MAX_ZOOM))
    }

    scroller.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      scroller.removeEventListener('wheel', handleWheel)
    }
  }, [resultImage, targetImage])

  const baseWidth =
    isPaletteEditing && paletteEditImage ? paletteEditImage.width : targetImage?.width ?? resultImage?.width ?? 1
  const baseHeight =
    isPaletteEditing && paletteEditImage ? paletteEditImage.height : targetImage?.height ?? resultImage?.height ?? 1
  const displayWidth = Math.max(1, baseWidth * zoom)
  const displayHeight = Math.max(1, baseHeight * zoom)
  const targetMeta = targetImage
    ? `${targetImage.width} x ${targetImage.height}`
    : isLoadingImage
      ? 'Loading'
      : 'Drop image'
  const resultMeta = resultImage
    ? `${resultImage.width} x ${resultImage.height}`
    : displayedResultImage
      ? `${displayedResultImage.width} x ${displayedResultImage.height}`
    : isProcessing
      ? 'Processing'
      : 'Waiting'
  const selectedColorLabel = selectedColor ? colorLabel(selectedColor) : 'No color'
  const canApplyPaletteEdit =
    selectionCount > 0 &&
    Boolean(
      paletteEdit?.source === 'target' ? onApplyTargetPaletteColorReplace : onApplyPaletteColorReplace,
    )

  const clearSelectionToolState = () => {
    setToolMode('none')
    setSelectedSample(null)
    setManualSelection(null)
    setDragStart(null)
    setLassoPoints([])
  }

  const clearToolState = () => {
    clearSelectionToolState()
    setPaletteEdit(null)
    setIsTargetPaletteOpen(false)
  }

  const updateDivider = (clientX: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    setDivider(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100))
  }

  const selectTargetColor = (clientX: number, clientY: number) => {
    if (!targetImage || toolMode !== 'color') {
      return
    }

    const rect = targetCanvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    const x = Math.floor(((clientX - rect.left) / rect.width) * targetImage.width)
    const y = Math.floor(((clientY - rect.top) / rect.height) * targetImage.height)
    setSelectedSample({ color: getPixelColor(targetImage, x, y), image: targetImage })
  }

  const sampleCanvasColor = (
    imageData: ImageData | null,
    canvas: HTMLCanvasElement | null,
    clientX: number,
    clientY: number,
  ): RgbColor | null => {
    if (!imageData || !canvas) {
      return null
    }

    const rect = canvas.getBoundingClientRect()
    const rawX = Math.floor(((clientX - rect.left) / rect.width) * imageData.width)
    const rawY = Math.floor(((clientY - rect.top) / rect.height) * imageData.height)
    const color = getPixelColor(
      imageData,
      clamp(rawX, 0, imageData.width - 1),
      clamp(rawY, 0, imageData.height - 1),
    )

    return { r: color.r, g: color.g, b: color.b }
  }

  const startPaletteEdit = (color: PaletteColor, source: PaletteEditState['source']) => {
    if ((source === 'target' && !targetImage) || (source === 'result' && !resultImage)) {
      return
    }

    clearSelectionToolState()
    setPaletteEdit({
      afterColor: paletteColorToRgb(color),
      beforeColor: color,
      isPicking: false,
      source,
    })
  }

  const choosePaletteAfterColor = (color: PaletteColor) => {
    setPaletteEdit((current) =>
      current
        ? {
            ...current,
            afterColor: paletteColorToRgb(color),
            isPicking: false,
          }
        : current,
    )
  }

  const samplePaletteAfterColor = (
    imageData: ImageData | null,
    canvas: HTMLCanvasElement | null,
    clientX: number,
    clientY: number,
  ) => {
    if (!paletteEdit?.isPicking) {
      return false
    }

    const color = sampleCanvasColor(imageData, canvas, clientX, clientY)
    if (!color) {
      return false
    }

    setPaletteEdit((current) =>
      current
        ? {
            ...current,
            afterColor: color,
            isPicking: false,
          }
        : current,
    )
    return true
  }

  const applyPaletteEdit = () => {
    if (!paletteEdit) {
      return
    }

    if (paletteEdit.source === 'target') {
      onApplyTargetPaletteColorReplace?.(paletteEdit.beforeColor, paletteEdit.afterColor)
    } else {
      onApplyPaletteColorReplace?.(paletteEdit.beforeColor, paletteEdit.afterColor)
    }
    clearToolState()
  }

  const cutoutSelection = () => {
    if (!selectionMask || selectionCount === 0 || toolMode !== 'color') {
      return
    }

    onApplyColorCutout?.(selectionMask)
    clearToolState()
  }

  const cropSelection = () => {
    if (!selectionMask || selectionCount === 0 || !isShapeSelectionTool) {
      return
    }

    onApplySelectionCrop?.(selectionMask)
    clearToolState()
  }

  const getImagePoint = (clientX: number, clientY: number) => {
    if (!targetImage) {
      return null
    }

    const rect = targetCanvasRef.current?.getBoundingClientRect()
    if (!rect) {
      return null
    }

    const rawX = Math.floor(((clientX - rect.left) / rect.width) * targetImage.width)
    const rawY = Math.floor(((clientY - rect.top) / rect.height) * targetImage.height)

    return {
      x: clamp(rawX, 0, targetImage.width - 1),
      y: clamp(rawY, 0, targetImage.height - 1),
    } satisfies ImagePoint
  }

  const startShapeSelection = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!targetImage || !isShapeSelectionTool) {
      return
    }

    const point = getImagePoint(event.clientX, event.clientY)
    if (!point) {
      return
    }

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragStart(point)
    setManualSelection(null)

    if (toolMode === 'rectangle') {
      setManualSelection({
        image: targetImage,
        mask: createRectangleSelectionMask(targetImage.width, targetImage.height, point, point),
      })
      return
    }

    setLassoPoints([point])
  }

  const continueShapeSelection = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!targetImage || !dragStart || !isShapeSelectionTool) {
      return
    }

    const point = getImagePoint(event.clientX, event.clientY)
    if (!point) {
      return
    }

    if (toolMode === 'rectangle') {
      setManualSelection({
        image: targetImage,
        mask: createRectangleSelectionMask(targetImage.width, targetImage.height, dragStart, point),
      })
      return
    }

    setLassoPoints((currentPoints) => {
      const previousPoint = currentPoints[currentPoints.length - 1]
      if (previousPoint?.x === point.x && previousPoint.y === point.y) {
        return currentPoints
      }

      const nextPoints = [...currentPoints, point]
      setManualSelection({
        image: targetImage,
        mask: createLassoSelectionMask(targetImage.width, targetImage.height, nextPoints),
      })
      return nextPoints
    })
  }

  const finishShapeSelection = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!targetImage || !dragStart || !isShapeSelectionTool) {
      return
    }

    const point = getImagePoint(event.clientX, event.clientY)
    if (toolMode === 'rectangle' && point) {
      setManualSelection({
        image: targetImage,
        mask: createRectangleSelectionMask(targetImage.width, targetImage.height, dragStart, point),
      })
    }
    if (toolMode === 'lasso') {
      const finalPoints = point ? [...lassoPoints, point] : lassoPoints
      setManualSelection({
        image: targetImage,
        mask: createLassoSelectionMask(targetImage.width, targetImage.height, finalPoints),
      })
      setLassoPoints(finalPoints)
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragStart(null)
  }

  const toggleTool = (nextTool: Exclude<ToolMode, 'none'>) => {
    setToolMode((currentTool) => (currentTool === nextTool ? 'none' : nextTool))
    setPaletteEdit(null)
    setIsTargetPaletteOpen(false)
    setSelectedSample(null)
    setManualSelection(null)
    setDragStart(null)
    setLassoPoints([])
  }

  const toggleTargetPalette = () => {
    clearSelectionToolState()
    setPaletteEdit(null)
    if (resultImage && onPromoteResultToTargetForPalette) {
      onPromoteResultToTargetForPalette()
      setIsTargetPaletteOpen(true)
      return
    }
    setIsTargetPaletteOpen((current) => !current)
  }

  return (
    <div
      aria-busy={isLoadingImage}
      className="flex h-full min-h-0 flex-col border-r border-zinc-300 bg-zinc-50"
      data-testid="image-drop-workspace"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex h-8 items-center justify-between border-b border-zinc-300 px-2 text-xs">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-medium text-zinc-800">Target</span>
            <span className="truncate text-[11px] text-zinc-500">{targetMeta}</span>
          </div>
          <div className="h-3 w-px bg-zinc-300" />
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-medium text-zinc-800">Result</span>
            <span className="truncate text-[11px] text-zinc-500">{resultMeta}</span>
          </div>
          <span className="text-[11px] tabular-nums text-zinc-500">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!targetImage || !onDownloadTarget}
            title="Download target"
            type="button"
            onClick={() => {
              clearToolState()
              onDownloadTarget?.()
            }}
          >
            <Download size={13} />
          </button>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!resultImage || !onDownloadResult}
            title="Download result"
            type="button"
            onClick={() => {
              clearToolState()
              onDownloadResult?.()
            }}
          >
            <Download size={13} />
          </button>
          <button
            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 ${
              toolMode === 'color'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                : 'border-zinc-300 bg-white hover:bg-zinc-100'
            }`}
            disabled={!targetImage || !onApplyColorCutout}
            title="Color selection cutout"
            type="button"
            onClick={() => toggleTool('color')}
          >
            <Pipette size={13} />
          </button>
          <button
            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 ${
              isTargetPaletteOpen
                ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                : 'border-zinc-300 bg-white hover:bg-zinc-100'
            }`}
            disabled={!targetImage || !onApplyTargetPaletteColorReplace}
            title="Target palette edit"
            type="button"
            onClick={toggleTargetPalette}
          >
            <Palette size={13} />
          </button>
          <button
            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 ${
              toolMode === 'rectangle'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                : 'border-zinc-300 bg-white hover:bg-zinc-100'
            }`}
            disabled={!targetImage || !onApplySelectionCrop}
            title="Rectangle selection"
            type="button"
            onClick={() => toggleTool('rectangle')}
          >
            <SquareDashedMousePointer size={13} />
          </button>
          <button
            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 ${
              toolMode === 'lasso'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                : 'border-zinc-300 bg-white hover:bg-zinc-100'
            }`}
            disabled={!targetImage || !onApplySelectionCrop}
            title="Lasso selection"
            type="button"
            onClick={() => toggleTool('lasso')}
          >
            <LassoSelect size={13} />
          </button>
          {onSetResultAsTarget ? (
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!resultImage}
              title="Set result as target"
              type="button"
              onClick={() => {
                clearToolState()
                onSetResultAsTarget()
              }}
            >
              <Target size={13} />
            </button>
          ) : null}
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            title="Open image"
            type="button"
            onClick={() => {
              clearToolState()
              fileInputRef.current?.click()
            }}
          >
            <ImagePlus size={13} />
          </button>
          {onOpen3dCapture ? (
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
              title="Open 3D capture"
              type="button"
              onClick={() => {
                clearToolState()
                onOpen3dCapture()
              }}
            >
              <Box size={13} />
            </button>
          ) : null}
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!targetImage || !onExpandTarget}
            title="Expand target"
            type="button"
            onClick={() => {
              clearToolState()
              onExpandTarget?.()
            }}
          >
            <Maximize2 size={13} />
          </button>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!resultImage || !onExpandResult}
            title="Expand result"
            type="button"
            onClick={() => {
              clearToolState()
              onExpandResult?.()
            }}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
      {toolMode === 'color' ? (
        <div className="flex min-h-9 flex-wrap items-center gap-2 border-b border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-600">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-800">Color Cutout</span>
            <span>{selectedColorLabel}</span>
            {selectedColor ? (
              <span
                className="h-4 w-4 rounded-sm border border-zinc-300"
                style={{
                  backgroundColor: `rgba(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b}, ${
                    selectedColor.a / 255
                  })`,
                }}
              />
            ) : null}
          </div>
          <label className="flex min-w-[190px] flex-1 items-center gap-2">
            <span className="shrink-0">Tolerance</span>
            <input
              className="h-1.5 min-w-0 flex-1 accent-cyan-700"
              max={MAX_TOLERANCE}
              min={MIN_TOLERANCE}
              type="range"
              value={tolerance}
              onChange={(event) =>
                setTolerance(clamp(Number(event.currentTarget.value), MIN_TOLERANCE, MAX_TOLERANCE))
              }
            />
            <input
              className="h-6 w-14 rounded border border-zinc-300 px-1 text-right tabular-nums text-zinc-800"
              max={MAX_TOLERANCE}
              min={MIN_TOLERANCE}
              type="number"
              value={tolerance}
              onChange={(event) =>
                setTolerance(clamp(Number(event.currentTarget.value), MIN_TOLERANCE, MAX_TOLERANCE))
              }
            />
          </label>
          <span className="tabular-nums">{selectionCount.toLocaleString()} px</span>
          <button
            className="inline-flex h-6 items-center justify-center gap-1 rounded border border-zinc-300 bg-white px-2 font-medium text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selectionMask || selectionCount === 0 || !onApplyColorCutout}
            title="Cut out selected color"
            type="button"
            onClick={cutoutSelection}
          >
            <Scissors size={13} />
            <span>Cut out</span>
          </button>
        </div>
      ) : null}
      {isTargetPaletteOpen && targetPalette.length > 0 ? (
        <div className="flex min-h-9 items-center gap-2 border-b border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-600">
          <span className="shrink-0 font-medium text-zinc-800">
            Target Palette {targetPalette.length} colors
          </span>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5">
            {targetPalette.map((color) => (
              <button
                key={color.hex}
                className={`h-5 w-5 shrink-0 rounded-sm border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] hover:border-cyan-700 ${
                  paletteEdit?.source === 'target' && paletteEdit.beforeColor.hex === color.hex
                    ? 'border-cyan-700 ring-2 ring-cyan-200'
                    : 'border-zinc-300'
                }`}
                style={{ backgroundColor: color.hex }}
                title={`${color.hex} / ${color.count.toLocaleString()} px`}
                type="button"
                onClick={() => startPaletteEdit(color, 'target')}
              />
            ))}
          </div>
        </div>
      ) : null}
      {resultImage && resultPalette.length > 0 ? (
        <div className="flex min-h-9 items-center gap-2 border-b border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-600">
          <span className="shrink-0 font-medium text-zinc-800">
            Palette {resultPalette.length} colors
          </span>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5">
            {resultPalette.map((color) => (
              <button
                key={color.hex}
                className={`h-5 w-5 shrink-0 rounded-sm border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] hover:border-cyan-700 ${
                  paletteEdit?.source === 'result' && paletteEdit.beforeColor.hex === color.hex
                    ? 'border-cyan-700 ring-2 ring-cyan-200'
                    : 'border-zinc-300'
                }`}
                style={{ backgroundColor: color.hex }}
                title={`${color.hex} / ${color.count.toLocaleString()} px`}
                type="button"
                onClick={() => startPaletteEdit(color, 'result')}
              />
            ))}
          </div>
        </div>
      ) : null}
      {paletteEditImage && paletteEdit ? (
        <div className="flex min-h-12 flex-wrap items-center gap-3 border-b border-zinc-300 bg-zinc-100 px-2 py-2 text-[11px] text-zinc-600">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
            {activePalette
              .filter((color) => color.hex !== paletteEdit.beforeColor.hex)
              .map((color) => (
                <button
                  key={color.hex}
                  className={`h-6 w-6 shrink-0 rounded-sm border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] hover:border-cyan-700 ${
                    colorsEqual(color, paletteEdit.afterColor)
                      ? 'border-cyan-700 ring-2 ring-cyan-200'
                      : 'border-zinc-300'
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={`Use ${color.hex}`}
                  type="button"
                  onClick={() => choosePaletteAfterColor(color)}
                />
              ))}
          </div>
          <button
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border ${
              paletteEdit.isPicking
                ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'
            }`}
            title="Pick replacement color"
            type="button"
            onClick={() =>
              setPaletteEdit((current) =>
                current ? { ...current, isPicking: !current.isPicking } : current,
              )
            }
          >
            <Pipette size={13} />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-800">Before</span>
            <span
              className="h-5 w-5 rounded-sm border border-zinc-300"
              style={{ backgroundColor: paletteEdit.beforeColor.hex }}
            />
            <span className="tabular-nums">{colorLabel(paletteEdit.beforeColor)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-800">After</span>
            <span
              className="h-5 w-5 rounded-sm border border-zinc-300"
              style={{ backgroundColor: colorLabel(paletteEdit.afterColor) }}
            />
            <span className="tabular-nums">{colorLabel(paletteEdit.afterColor)}</span>
          </div>
          <span className="tabular-nums">{selectionCount.toLocaleString()} px</span>
          <button
            className="inline-flex h-7 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white px-3 font-medium text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canApplyPaletteEdit}
            title="Commit palette color replacement"
            type="button"
            onClick={applyPaletteEdit}
          >
            Commit
          </button>
        </div>
      ) : null}
      {isShapeSelectionTool ? (
        <div className="flex min-h-9 flex-wrap items-center gap-2 border-b border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-600">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-800">
              {toolMode === 'rectangle' ? 'Rectangle Selection' : 'Lasso Selection'}
            </span>
            <span>Drag over target</span>
          </div>
          <span className="tabular-nums">{selectionCount.toLocaleString()} px</span>
          <button
            className="inline-flex h-6 items-center justify-center gap-1 rounded border border-zinc-300 bg-white px-2 font-medium text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!selectionMask || selectionCount === 0 || !onApplySelectionCrop}
            title="Crop selection into target"
            type="button"
            onClick={cropSelection}
          >
            <Scissors size={13} />
            <span>Cut</span>
          </button>
        </div>
      ) : null}
      <div
        ref={scrollerRef}
        className={`relative min-h-0 flex-1 overflow-auto bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%),linear-gradient(-45deg,#e4e4e7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e7_75%),linear-gradient(-45deg,transparent_75%,#e4e4e7_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-3 ${
          isDragging ? 'outline outline-2 outline-cyan-600 outline-offset-[-2px]' : ''
        }`}
      >
        {!targetImage && !resultImage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px] text-zinc-500">
            {isLoadingImage ? (
              <>
                <LoaderCircle className="animate-spin" size={18} />
                <span>Loading</span>
              </>
            ) : (
              <>
                <ImagePlus size={18} />
                <span>Drop image</span>
              </>
            )}
          </div>
        ) : null}
        {isLoadingImage && (targetImage || resultImage) ? (
          <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm">
            <LoaderCircle className="animate-spin" size={13} />
            <span>Loading</span>
          </div>
        ) : null}
        {isProcessing && !resultImage ? (
          <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-600 shadow-sm">
            <Zap size={13} />
            <span>Processing</span>
          </div>
        ) : null}
        <div className="flex min-h-full min-w-full items-center justify-center">
          <div
            ref={viewportRef}
            className="relative shrink-0 overflow-hidden shadow-sm"
            style={{ height: displayHeight, width: displayWidth }}
          >
            {targetImage ? (
              <canvas
                ref={targetCanvasRef}
                className={`absolute inset-0 block [image-rendering:pixelated] ${
                  toolMode !== 'none' || isPalettePicking ? 'cursor-crosshair' : ''
                }`}
                style={{
                  clipPath:
                    hasResultView && (!isSelectionTool || isPalettePicking)
                      ? `inset(0 ${100 - divider}% 0 0)`
                      : undefined,
                  height: displayHeight,
                  width: displayWidth,
                }}
                onDoubleClick={onExpandTarget}
                onPointerDown={(event) => {
                  if (
                    samplePaletteAfterColor(
                      targetImage,
                      targetCanvasRef.current,
                      event.clientX,
                      event.clientY,
                    )
                  ) {
                    event.preventDefault()
                    return
                  }
                  if (toolMode === 'color') {
                    event.preventDefault()
                    selectTargetColor(event.clientX, event.clientY)
                  }
                  if (isShapeSelectionTool) {
                    startShapeSelection(event)
                  }
                }}
                onPointerMove={continueShapeSelection}
                onPointerUp={finishShapeSelection}
                onPointerCancel={finishShapeSelection}
              />
            ) : null}
            {displayedResultImage && (isPaletteEditing || !isSelectionTool) ? (
              <canvas
                ref={resultCanvasRef}
                className={`absolute inset-0 block [image-rendering:pixelated] ${
                  isPalettePicking ? 'cursor-crosshair' : isPaletteEditing ? '' : ''
                }`}
                style={{
                  clipPath: isPalettePicking
                    ? `inset(0 0 0 ${divider}%)`
                    : isPaletteEditing
                      ? undefined
                      : `inset(0 0 0 ${divider}%)`,
                  height: displayHeight,
                  width: displayWidth,
                }}
                onDoubleClick={onExpandResult}
                onPointerDown={(event) => {
                  if (
                    samplePaletteAfterColor(
                      displayedResultImage,
                      resultCanvasRef.current,
                      event.clientX,
                      event.clientY,
                    )
                  ) {
                    event.preventDefault()
                  }
                }}
              />
            ) : null}
            {selectionImage ? (
              <canvas
                ref={selectionCanvasRef}
                className="pointer-events-none absolute inset-0 z-[9] block [image-rendering:pixelated]"
                style={{ height: displayHeight, width: displayWidth }}
              />
            ) : null}
            {targetImage && hasResultView && !isSelectionTool ? (
              <button
                aria-label="Adjust target result comparison"
                className={`absolute inset-y-0 z-10 w-6 -translate-x-1/2 cursor-ew-resize touch-none ${
                  isSelectionTool ? 'pointer-events-none' : ''
                }`}
                style={{ left: `${divider}%` }}
                type="button"
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setIsSliding(true)
                  updateDivider(event.clientX)
                }}
                onPointerMove={(event) => {
                  if (isSliding) {
                    updateDivider(event.clientX)
                  }
                }}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                  setIsSliding(false)
                }}
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-cyan-500 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]" />
                <span className="absolute left-1/2 top-1/2 h-8 w-3 -translate-x-1/2 -translate-y-1/2 rounded border border-cyan-700 bg-cyan-500 shadow-sm" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
