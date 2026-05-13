import {
  Box,
  Download,
  ImagePlus,
  LoaderCircle,
  Maximize2,
  Pipette,
  Scissors,
  Target,
  Zap,
} from 'lucide-react'
import type { DragEvent, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  countSelectionPixels,
  createColorSelectionMask,
  getPixelColor,
  type RgbaColor,
} from '../lib/colorCutout'
import { drawImageData } from '../lib/imageData'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 16
const MIN_TOLERANCE = 0
const MAX_TOLERANCE = 441

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function appendSelectionOutlinePath(context: CanvasRenderingContext2D, mask: Uint8Array, width: number) {
  const height = mask.length / width

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
      context.moveTo(x, y)
      context.lineTo(x + 1, y)
    }
    if (right) {
      context.moveTo(x + 1, y)
      context.lineTo(x + 1, y + 1)
    }
    if (bottom) {
      context.moveTo(x + 1, y + 1)
      context.lineTo(x, y + 1)
    }
    if (left) {
      context.moveTo(x, y + 1)
      context.lineTo(x, y)
    }
  }
}

function drawSelectionOutline(
  canvas: HTMLCanvasElement | null,
  mask: Uint8Array | null,
  width: number,
  height: number,
  dashOffset: number,
) {
  if (!canvas) {
    return
  }

  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }

  context.clearRect(0, 0, width, height)
  if (!mask) {
    return
  }

  context.lineWidth = 1
  context.lineCap = 'square'
  context.setLineDash([])

  context.beginPath()
  appendSelectionOutlinePath(context, mask, width)
  context.strokeStyle = 'rgba(24,24,27,0.95)'
  context.stroke()

  context.beginPath()
  appendSelectionOutlinePath(context, mask, width)
  context.setLineDash([4, 4])
  context.lineDashOffset = -dashOffset
  context.strokeStyle = 'rgba(255,255,255,0.95)'
  context.stroke()
}

export function ImageComparePanel({
  fileInputRef,
  isDragging = false,
  isLoadingImage = false,
  isProcessing = false,
  resultImage,
  targetImage,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onApplyColorCutout,
  onDownloadResult,
  onDownloadTarget,
  onExpandResult,
  onExpandTarget,
  onOpen3dCapture,
  onSetResultAsTarget,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  isDragging?: boolean
  isLoadingImage?: boolean
  isProcessing?: boolean
  resultImage: ImageData | null
  targetImage: ImageData | null
  onDragEnter?: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
  onApplyColorCutout?: (selectionMask: Uint8Array) => void
  onDownloadResult?: () => void
  onDownloadTarget?: () => void
  onExpandResult?: () => void
  onExpandTarget?: () => void
  onOpen3dCapture?: () => void
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
  const [isCutoutMode, setIsCutoutMode] = useState(false)
  const [selectedSample, setSelectedSample] = useState<{
    color: RgbaColor
    image: ImageData
  } | null>(null)
  const [tolerance, setTolerance] = useState(24)
  const selectedColor = selectedSample?.image === targetImage ? selectedSample.color : null

  const selectionMask = useMemo(() => {
    if (!targetImage || !selectedColor) {
      return null
    }

    return createColorSelectionMask(targetImage, selectedColor, tolerance)
  }, [selectedColor, targetImage, tolerance])
  const selectionCount = useMemo(() => countSelectionPixels(selectionMask), [selectionMask])

  useEffect(() => {
    if (targetImage) {
      drawImageData(targetCanvasRef.current, targetImage)
    }
  }, [targetImage])

  useEffect(() => {
    if (resultImage) {
      drawImageData(resultCanvasRef.current, resultImage)
    }
  }, [resultImage])

  useEffect(() => {
    if (!targetImage || selectionCount === 0) {
      drawSelectionOutline(selectionCanvasRef.current, null, 1, 1, 0)
      return
    }

    let frameId = 0
    const startedAt = performance.now()
    const animate = (time: number) => {
      drawSelectionOutline(
        selectionCanvasRef.current,
        selectionMask,
        targetImage.width,
        targetImage.height,
        ((time - startedAt) / 120) % 8,
      )
      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [selectionCount, selectionMask, targetImage])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isEditingControl =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement

      if (event.key !== 'Delete' || isEditingControl || !selectionMask || selectionCount === 0) {
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
  }, [onApplyColorCutout, selectionCount, selectionMask])

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

  const baseWidth = targetImage?.width ?? resultImage?.width ?? 1
  const baseHeight = targetImage?.height ?? resultImage?.height ?? 1
  const displayWidth = Math.max(1, baseWidth * zoom)
  const displayHeight = Math.max(1, baseHeight * zoom)
  const targetMeta = targetImage
    ? `${targetImage.width} x ${targetImage.height}`
    : isLoadingImage
      ? 'Loading'
      : 'Drop image'
  const resultMeta = resultImage
    ? `${resultImage.width} x ${resultImage.height}`
    : isProcessing
      ? 'Processing'
      : 'Waiting'
  const selectedColorLabel = selectedColor
    ? `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})`
    : 'No color'

  const updateDivider = (clientX: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    setDivider(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100))
  }

  const selectTargetColor = (clientX: number, clientY: number) => {
    if (!targetImage || !isCutoutMode) {
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

  const cutoutSelection = () => {
    if (!selectionMask || selectionCount === 0) {
      return
    }

    onApplyColorCutout?.(selectionMask)
    setSelectedSample(null)
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
            onClick={onDownloadTarget}
          >
            <Download size={13} />
          </button>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!resultImage || !onDownloadResult}
            title="Download result"
            type="button"
            onClick={onDownloadResult}
          >
            <Download size={13} />
          </button>
          <button
            className={`inline-flex h-6 w-6 items-center justify-center rounded border text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 ${
              isCutoutMode
                ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
                : 'border-zinc-300 bg-white hover:bg-zinc-100'
            }`}
            disabled={!targetImage || !onApplyColorCutout}
            title="Color selection cutout"
            type="button"
            onClick={() => setIsCutoutMode((current) => !current)}
          >
            <Pipette size={13} />
          </button>
          {onSetResultAsTarget ? (
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!resultImage}
              title="Set result as target"
              type="button"
              onClick={onSetResultAsTarget}
            >
              <Target size={13} />
            </button>
          ) : null}
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            title="Open image"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={13} />
          </button>
          {onOpen3dCapture ? (
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
              title="Open 3D capture"
              type="button"
              onClick={onOpen3dCapture}
            >
              <Box size={13} />
            </button>
          ) : null}
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!targetImage || !onExpandTarget}
            title="Expand target"
            type="button"
            onClick={onExpandTarget}
          >
            <Maximize2 size={13} />
          </button>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!resultImage || !onExpandResult}
            title="Expand result"
            type="button"
            onClick={onExpandResult}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
      {isCutoutMode ? (
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
                  isCutoutMode ? 'cursor-crosshair' : ''
                }`}
                style={{
                  clipPath: resultImage ? `inset(0 ${100 - divider}% 0 0)` : undefined,
                  height: displayHeight,
                  width: displayWidth,
                }}
                onDoubleClick={onExpandTarget}
                onPointerDown={(event) => {
                  if (isCutoutMode) {
                    event.preventDefault()
                    selectTargetColor(event.clientX, event.clientY)
                  }
                }}
              />
            ) : null}
            {resultImage ? (
              <canvas
                ref={resultCanvasRef}
                className={`absolute inset-0 block [image-rendering:pixelated] ${
                  isCutoutMode ? 'pointer-events-none' : ''
                }`}
                style={{
                  clipPath: `inset(0 0 0 ${divider}%)`,
                  height: displayHeight,
                  width: displayWidth,
                }}
                onDoubleClick={onExpandResult}
              />
            ) : null}
            {targetImage ? (
              <canvas
                ref={selectionCanvasRef}
                className="pointer-events-none absolute inset-0 z-[9] block [image-rendering:pixelated]"
                style={{ height: displayHeight, width: displayWidth }}
              />
            ) : null}
            {targetImage && resultImage ? (
              <button
                aria-label="Adjust target result comparison"
                className={`absolute inset-y-0 z-10 w-6 -translate-x-1/2 cursor-ew-resize touch-none ${
                  isCutoutMode ? 'pointer-events-none' : ''
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
