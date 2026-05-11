import { Box, ImagePlus, Maximize2, Target, Zap } from 'lucide-react'
import type { DragEvent, RefObject } from 'react'

export function ImageWorkspacePanel({
  canvasRef,
  fileInputRef,
  image,
  isDragging = false,
  isProcessing = false,
  label,
  meta,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onExpand,
  onOpen3dCapture,
  onSetAsTarget,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  fileInputRef?: RefObject<HTMLInputElement | null>
  image: ImageData | null
  isDragging?: boolean
  isProcessing?: boolean
  label: string
  meta: string
  onDragEnter?: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave?: () => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
  onExpand?: () => void
  onOpen3dCapture?: () => void
  onSetAsTarget?: () => void
}) {
  const isEmpty = !image

  return (
    <div className="flex min-h-0 flex-col border-b border-zinc-300 bg-zinc-50 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex h-8 items-center justify-between border-b border-zinc-300 px-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium text-zinc-800">{label}</span>
          <span className="truncate text-[11px] text-zinc-500">{meta}</span>
        </div>
        <div className="flex items-center gap-1">
          {onSetAsTarget ? (
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isEmpty}
              title="Set result as target"
              type="button"
              onClick={onSetAsTarget}
            >
              <Target size={13} />
            </button>
          ) : null}
          {fileInputRef ? (
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
              title="Open image"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={13} />
            </button>
          ) : null}
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
            disabled={isEmpty || !onExpand}
            title="Expand"
            type="button"
            onClick={onExpand}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>
      <div
        className={`relative flex min-h-[240px] flex-1 items-center justify-center overflow-auto bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%),linear-gradient(-45deg,#e4e4e7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e7_75%),linear-gradient(-45deg,transparent_75%,#e4e4e7_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0px] p-3 ${
          isDragging ? 'outline outline-2 outline-cyan-600 outline-offset-[-2px]' : ''
        }`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {isEmpty ? (
          <div className="flex flex-col items-center gap-2 text-[11px] text-zinc-500">
            {isProcessing ? (
              <>
                <Zap size={18} />
                <span>Processing</span>
              </>
            ) : (
              <>
                <ImagePlus size={18} />
                <span>{fileInputRef ? 'Drop image' : 'No result'}</span>
              </>
            )}
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          className={`max-h-full max-w-full object-contain [image-rendering:pixelated] ${
            isEmpty ? 'hidden' : 'block cursor-zoom-in'
          }`}
          onClick={onExpand}
        />
      </div>
    </div>
  )
}
