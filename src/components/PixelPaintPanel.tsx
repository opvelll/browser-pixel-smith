import { ImagePlus, Pipette, Save, X } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getPixelColor } from '../lib/colorCutout'
import { cloneImageData, drawImageData } from '../lib/imageData'
import { collectImagePalette, type RgbColor } from '../lib/palette'
import type { HistoryEntry } from '../types/images'

const MIN_PAINT_ZOOM = 1
const MAX_PAINT_ZOOM = 32

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function colorLabel(color: RgbColor) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

function colorsEqual(first: RgbColor, second: RgbColor) {
  return first.r === second.r && first.g === second.g && first.b === second.b
}

function firstOpaqueColor(imageData: ImageData): RgbColor {
  for (let offset = 0; offset < imageData.data.length; offset += 4) {
    if (imageData.data[offset + 3] === 0) {
      continue
    }

    return {
      r: imageData.data[offset],
      g: imageData.data[offset + 1],
      b: imageData.data[offset + 2],
    }
  }

  return { r: 0, g: 0, b: 0 }
}

function getCanvasPoint(
  imageData: ImageData,
  canvas: HTMLCanvasElement | null,
  clientX: number,
  clientY: number,
) {
  if (!canvas) {
    return null
  }

  const rect = canvas.getBoundingClientRect()
  const rawX = Math.floor(((clientX - rect.left) / rect.width) * imageData.width)
  const rawY = Math.floor(((clientY - rect.top) / rect.height) * imageData.height)

  if (rawX < 0 || rawY < 0 || rawX >= imageData.width || rawY >= imageData.height) {
    return null
  }

  return { x: rawX, y: rawY }
}

function sampleColor(
  imageData: ImageData,
  canvas: HTMLCanvasElement | null,
  clientX: number,
  clientY: number,
): RgbColor | null {
  const point = getCanvasPoint(imageData, canvas, clientX, clientY)
  if (!point) {
    return null
  }

  const color = getPixelColor(imageData, point.x, point.y)
  return { r: color.r, g: color.g, b: color.b }
}

function paintPixel(imageData: ImageData, x: number, y: number, color: RgbColor) {
  const offset = (y * imageData.width + x) * 4
  if (
    imageData.data[offset] === color.r &&
    imageData.data[offset + 1] === color.g &&
    imageData.data[offset + 2] === color.b &&
    imageData.data[offset + 3] === 255
  ) {
    return imageData
  }

  const nextImageData = cloneImageData(imageData)
  nextImageData.data[offset] = color.r
  nextImageData.data[offset + 1] = color.g
  nextImageData.data[offset + 2] = color.b
  nextImageData.data[offset + 3] = 255
  return nextImageData
}

export function PixelPaintPanel({
  fileInputRef,
  history,
  targetImage,
  onClose,
  onSave,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  history: HistoryEntry[]
  targetImage: ImageData
  onClose: () => void
  onSave: (imageData: ImageData) => void
}) {
  const editCanvasRef = useRef<HTMLCanvasElement>(null)
  const referenceCanvasRef = useRef<HTMLCanvasElement>(null)
  const lastPaintPointRef = useRef<{ x: number; y: number } | null>(null)
  const [draftImage, setDraftImage] = useState(() => cloneImageData(targetImage))
  const [selectedColor, setSelectedColor] = useState<RgbColor>(() => firstOpaqueColor(targetImage))
  const [isPicking, setIsPicking] = useState(false)
  const [referenceId, setReferenceId] = useState<number | 'target'>(history[0]?.id ?? 'target')
  const [zoom, setZoom] = useState(8)

  useEffect(() => {
    drawImageData(editCanvasRef.current, draftImage)
  }, [draftImage])

  const referenceEntry = history.find((entry) => entry.id === referenceId)
  const referenceImage = referenceEntry?.imageData ?? targetImage
  const referenceLabel = referenceEntry
    ? `${referenceEntry.label} / ${referenceEntry.fileName}`
    : 'Target'

  useEffect(() => {
    drawImageData(referenceCanvasRef.current, referenceImage)
  }, [referenceImage])

  const draftPalette = useMemo(() => collectImagePalette(draftImage), [draftImage])
  const displayWidth = Math.max(1, draftImage.width * zoom)
  const displayHeight = Math.max(1, draftImage.height * zoom)
  const referenceDisplayWidth = Math.max(1, referenceImage.width * zoom)
  const referenceDisplayHeight = Math.max(1, referenceImage.height * zoom)

  const chooseColor = (color: RgbColor) => {
    setSelectedColor(color)
    setIsPicking(false)
  }

  const pickFromCanvas = (
    imageData: ImageData,
    canvas: HTMLCanvasElement | null,
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) => {
    const color = sampleColor(imageData, canvas, event.clientX, event.clientY)
    if (!color) {
      return false
    }

    chooseColor(color)
    return true
  }

  const paintFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(draftImage, editCanvasRef.current, event.clientX, event.clientY)
    if (!point) {
      return
    }

    const lastPoint = lastPaintPointRef.current
    if (lastPoint?.x === point.x && lastPoint.y === point.y) {
      return
    }

    lastPaintPointRef.current = point
    setDraftImage((currentImage) => paintPixel(currentImage, point.x, point.y, selectedColor))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-zinc-300 bg-white px-2 py-1.5 text-[11px] text-zinc-600">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-zinc-800">Pixel Paint</span>
          <span className="tabular-nums">{draftImage.width} x {draftImage.height}</span>
        </div>
        <select
          className="h-7 min-w-0 max-w-[220px] rounded border border-zinc-300 bg-white px-2 text-[11px] text-zinc-800"
          title="Reference image"
          value={referenceId}
          onChange={(event) => {
            const value = event.currentTarget.value
            setReferenceId(value === 'target' ? 'target' : Number(value))
          }}
        >
          {history.length === 0 ? <option value="target">Target</option> : null}
          {history.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label} / {entry.fileName}
            </option>
          ))}
          <option value="target">Target</option>
        </select>
        <button
          className={`inline-flex h-7 w-7 items-center justify-center rounded border ${
            isPicking
              ? 'border-cyan-600 bg-cyan-50 text-cyan-800'
              : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'
          }`}
          title="Pick color"
          type="button"
          onClick={() => setIsPicking((current) => !current)}
        >
          <Pipette size={13} />
        </button>
        <div className="flex items-center gap-1.5">
          <span
            className="h-5 w-5 rounded-sm border border-zinc-300"
            style={{ backgroundColor: colorLabel(selectedColor) }}
          />
          <span className="tabular-nums">{colorLabel(selectedColor)}</span>
        </div>
        <label className="flex min-w-[150px] items-center gap-2">
          <span>Zoom</span>
          <input
            className="h-1.5 min-w-0 flex-1 accent-cyan-700"
            max={MAX_PAINT_ZOOM}
            min={MIN_PAINT_ZOOM}
            type="range"
            value={zoom}
            onChange={(event) =>
              setZoom(clamp(Number(event.currentTarget.value), MIN_PAINT_ZOOM, MAX_PAINT_ZOOM))
            }
          />
          <span className="w-9 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            title="Open image"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={13} />
          </button>
          <button
            className="inline-flex h-7 items-center justify-center gap-1 rounded border border-zinc-300 bg-white px-2 font-medium text-zinc-800 hover:bg-zinc-100"
            title="Save pixel edit"
            type="button"
            onClick={() => onSave(cloneImageData(draftImage))}
          >
            <Save size={13} />
            <span>Save</span>
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
            title="Close pixel paint"
            type="button"
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="flex min-h-9 items-center gap-2 border-b border-zinc-300 bg-zinc-100 px-2 py-1.5 text-[11px] text-zinc-600">
        <span className="shrink-0 font-medium text-zinc-800">
          Palette {draftPalette.length} colors
        </span>
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-0.5">
          {draftPalette.map((color) => {
            const rgb = { r: color.r, g: color.g, b: color.b }
            return (
              <button
                key={color.hex}
                className={`h-5 w-5 shrink-0 rounded-sm border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] hover:border-cyan-700 ${
                  colorsEqual(rgb, selectedColor)
                    ? 'border-cyan-700 ring-2 ring-cyan-200'
                    : 'border-zinc-300'
                }`}
                style={{ backgroundColor: color.hex }}
                title={`${color.hex} / ${color.count.toLocaleString()} px`}
                type="button"
                onClick={() => chooseColor(rgb)}
              />
            )
          })}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%),linear-gradient(-45deg,#e4e4e7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e7_75%),linear-gradient(-45deg,transparent_75%,#e4e4e7_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] md:grid-cols-2">
        <div className="min-h-0 overflow-auto border-b border-zinc-300 p-3 md:border-b-0 md:border-r">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-zinc-600">
            <span className="font-medium text-zinc-800">Reference</span>
            <span className="truncate">{referenceLabel}</span>
          </div>
          <div className="flex min-h-[240px] min-w-full items-center justify-center">
            <canvas
              ref={referenceCanvasRef}
              className={`block shrink-0 shadow-sm [image-rendering:pixelated] ${
                isPicking ? 'cursor-crosshair' : ''
              }`}
              style={{ height: referenceDisplayHeight, width: referenceDisplayWidth }}
              onPointerDown={(event) => {
                if (!isPicking && !event.altKey) {
                  return
                }
                event.preventDefault()
                pickFromCanvas(referenceImage, referenceCanvasRef.current, event)
              }}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-auto p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-zinc-600">
            <span className="font-medium text-zinc-800">Edit</span>
            <span>Drag to paint</span>
          </div>
          <div className="flex min-h-[240px] min-w-full items-center justify-center">
            <canvas
              ref={editCanvasRef}
              className={`block shrink-0 shadow-sm [image-rendering:pixelated] ${
                isPicking ? 'cursor-crosshair' : 'cursor-crosshair'
              }`}
              style={{ height: displayHeight, width: displayWidth }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                if (isPicking || event.altKey) {
                  pickFromCanvas(draftImage, editCanvasRef.current, event)
                  return
                }

                paintFromEvent(event)
              }}
              onPointerMove={(event) => {
                if (event.buttons !== 1 || isPicking || event.altKey) {
                  return
                }

                paintFromEvent(event)
              }}
              onPointerUp={(event) => {
                lastPaintPointRef.current = null
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId)
                }
              }}
              onPointerCancel={() => {
                lastPaintPointRef.current = null
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
