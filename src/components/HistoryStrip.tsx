import { useEffect, useRef } from 'react'
import { drawImageData } from '../lib/imageData'
import type { HistoryEntry } from '../types/images'

export function HistoryStrip({
  entries,
  onOpen,
}: {
  entries: HistoryEntry[]
  onOpen: (entry: HistoryEntry) => void
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
            <HistoryThumb key={entry.id} entry={entry} index={index} onOpen={() => onOpen(entry)} />
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
}: {
  entry: HistoryEntry
  index: number
  onOpen: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    drawImageData(canvasRef.current, entry.imageData)
  }, [entry.imageData])

  return (
    <button
      className="grid h-full w-28 shrink-0 grid-rows-[1fr_auto] overflow-hidden rounded-sm border border-zinc-300 bg-white text-left hover:border-zinc-700"
      title="Expand history image"
      type="button"
      onClick={onOpen}
    >
      <div className="flex min-h-0 items-center justify-center overflow-hidden bg-[linear-gradient(45deg,#e4e4e7_25%,transparent_25%),linear-gradient(-45deg,#e4e4e7_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e7_75%),linear-gradient(-45deg,transparent_75%,#e4e4e7_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0px] p-1">
        <canvas ref={canvasRef} className="max-h-full max-w-full [image-rendering:pixelated]" />
      </div>
      <div className="border-t border-zinc-200 px-1.5 py-1">
        <div className="truncate text-[10px] font-medium text-zinc-800">
          {index + 1}. {entry.label}
        </div>
        <div className="text-[10px] text-zinc-500">
          {entry.imageData.width} x {entry.imageData.height}
        </div>
      </div>
    </button>
  )
}
