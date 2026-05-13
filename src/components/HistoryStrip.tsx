import { Maximize2, Target } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { drawImageData } from '../lib/imageData'
import type { HistoryEntry } from '../types/images'

export function HistoryStrip({
  entries,
  onOpen,
  onSetAsTarget,
}: {
  entries: HistoryEntry[]
  onOpen: (entry: HistoryEntry) => void
  onSetAsTarget: (entry: HistoryEntry) => void
}) {
  return (
    <section className="flex h-28 shrink-0 flex-col bg-zinc-50">
      <div className="flex h-7 items-center justify-between border-b border-zinc-300 px-2 text-xs">
        <span className="font-medium text-zinc-800">History</span>
        <span className="text-[11px] text-zinc-500">{entries.length} frames</span>
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-2">
        {entries.length === 0 ? (
          <div className="flex h-full items-center text-[11px] text-zinc-500">Drop image to start</div>
        ) : (
          entries.map((entry, index) => (
            <HistoryThumb
              key={entry.id}
              entry={entry}
              index={index}
              onOpen={() => onOpen(entry)}
              onSetAsTarget={() => onSetAsTarget(entry)}
            />
          ))
        )}
      </div>
    </section>
  )
}

function HistoryThumb({
  entry,
  index,
  onOpen,
  onSetAsTarget,
}: {
  entry: HistoryEntry
  index: number
  onOpen: () => void
  onSetAsTarget: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    drawImageData(canvasRef.current, entry.imageData)
  }, [entry.imageData])

  return (
    <div className="grid h-full w-28 shrink-0 grid-rows-[1fr_auto] overflow-hidden rounded-sm border border-zinc-300 bg-white text-left">
      <div className="relative min-h-0 overflow-hidden bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%),linear-gradient(-45deg,#e4e4e7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e7_75%),linear-gradient(-45deg,transparent_75%,#e4e4e7_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0px]">
        <button
          className="flex h-full w-full items-center justify-center p-1 hover:bg-zinc-950/5"
          title="Expand history image"
          type="button"
          onClick={onOpen}
        >
          <canvas ref={canvasRef} className="max-h-full max-w-full [image-rendering:pixelated]" />
        </button>
        <div className="absolute right-1 top-1 flex items-center gap-1">
          <button
            className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white/95 text-zinc-700 shadow-sm hover:bg-zinc-100"
            title="Set history image as target"
            type="button"
            onClick={onSetAsTarget}
          >
            <Target size={11} />
          </button>
          <button
            className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-300 bg-white/95 text-zinc-700 shadow-sm hover:bg-zinc-100"
            title="Expand history image"
            type="button"
            onClick={onOpen}
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>
      <div className="border-t border-zinc-200 px-1.5 py-1">
        <div className="truncate text-[10px] font-medium text-zinc-800">
          {index + 1}. {entry.label}
        </div>
        <div className="text-[10px] text-zinc-500">
          {entry.imageData.width} x {entry.imageData.height}
        </div>
      </div>
    </div>
  )
}
