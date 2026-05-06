import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { drawImageData } from '../lib/imageData'
import { clamp } from '../lib/number'
import { IconButton } from './IconButton'

export function ExpandedImageDialog({
  fileName,
  imageData,
  label,
  onClose,
}: {
  fileName: string
  imageData: ImageData
  label: string
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    drawImageData(canvasRef.current, imageData)
  }, [imageData])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const updateZoom = (nextZoom: number) => {
    setZoom(clamp(Number(nextZoom.toFixed(2)), 0.25, 8))
  }

  return (
    <div
      aria-label={`${label} expanded image`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 text-white"
      role="dialog"
    >
      <div className="flex h-10 items-center justify-between border-b border-white/15 px-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium">{label}</span>
          <span className="truncate text-zinc-400">{fileName}</span>
          <span className="text-zinc-400">
            {imageData.width} x {imageData.height}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            disabled={zoom <= 0.25}
            label="Zoom out"
            onClick={() => updateZoom(zoom / 1.25)}
          >
            <Minus size={14} />
          </IconButton>
          <button
            className="h-7 min-w-14 rounded-sm border border-white/20 bg-white/10 px-2 text-[11px] text-white hover:bg-white/20"
            title="Reset zoom"
            type="button"
            onClick={() => updateZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton
            disabled={zoom >= 8}
            label="Zoom in"
            onClick={() => updateZoom(zoom * 1.25)}
          >
            <Plus size={14} />
          </IconButton>
          <IconButton label="Reset zoom" onClick={() => updateZoom(1)}>
            <RotateCcw size={14} />
          </IconButton>
          <IconButton label="Close" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-auto bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] p-4"
        onClick={onClose}
      >
        <canvas
          ref={canvasRef}
          className="max-h-none max-w-none [image-rendering:pixelated]"
          style={{
            height: imageData.height * zoom,
            width: imageData.width * zoom,
          }}
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  )
}
