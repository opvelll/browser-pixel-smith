import { Box, ImagePlus, LoaderCircle, Maximize2, Target, Zap } from 'lucide-react'
import type { DragEvent, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { drawImageData } from '../lib/imageData'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 16

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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
  onExpandResult?: () => void
  onExpandTarget?: () => void
  onOpen3dCapture?: () => void
  onSetResultAsTarget?: () => void
}) {
  const targetCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [divider, setDivider] = useState(50)
  const [isSliding, setIsSliding] = useState(false)
  const [zoom, setZoom] = useState(1)

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

  const updateDivider = (clientX: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    setDivider(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100))
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
                className="absolute inset-0 block [image-rendering:pixelated]"
                style={{ height: displayHeight, width: displayWidth }}
                onDoubleClick={onExpandTarget}
              />
            ) : null}
            {resultImage ? (
              <canvas
                ref={resultCanvasRef}
                className="absolute inset-0 block [image-rendering:pixelated]"
                style={{
                  clipPath: `inset(0 0 0 ${divider}%)`,
                  height: displayHeight,
                  width: displayWidth,
                }}
                onDoubleClick={onExpandResult}
              />
            ) : null}
            {targetImage && resultImage ? (
              <button
                aria-label="Adjust target result comparison"
                className="absolute inset-y-0 z-10 w-6 -translate-x-1/2 cursor-ew-resize touch-none"
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
