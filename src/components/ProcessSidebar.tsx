import { Check, Download, RotateCcw, SlidersHorizontal, Zap } from 'lucide-react'
import { PIXEL_SNAPPER_CONTROL_FIELDS } from '../config/pixelSnapperControls'
import type { PixelSnapperConfig } from '../pixelSnapper'
import { ParameterRow } from './ParameterRow'

export function ProcessSidebar({
  config,
  error,
  hasImage,
  isProcessing,
  onApply,
  onDownload,
  onResetConfig,
  onUpdateConfig,
}: {
  config: PixelSnapperConfig
  error: string | null
  hasImage: boolean
  isProcessing: boolean
  onApply: () => void
  onDownload: () => void
  onResetConfig: () => void
  onUpdateConfig: (key: keyof PixelSnapperConfig, value: number) => void
}) {
  const [primaryField, ...secondaryFields] = PIXEL_SNAPPER_CONTROL_FIELDS

  return (
    <aside className="flex min-h-0 flex-col bg-zinc-50 text-xs">
      <div className="flex h-9 items-center justify-between border-b border-zinc-300 px-2">
        <div className="flex items-center gap-1.5 font-medium text-zinc-800">
          <SlidersHorizontal size={14} />
          Process
        </div>
        <div className="flex items-center gap-1">
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isProcessing}
            title="パラメータを初期値に戻す"
            type="button"
            onClick={onResetConfig}
          >
            <RotateCcw size={13} />
          </button>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasImage || isProcessing}
            title="Download current image"
            type="button"
            onClick={onDownload}
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-300">
        <button
          className="flex h-8 w-full items-center justify-between bg-zinc-900 px-2 text-left font-medium text-white"
          type="button"
        >
          <span className="flex items-center gap-1.5">
            <Zap size={13} />
            Pixel Snap
          </span>
          <Check size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="border-b border-zinc-300 px-2 py-2">
          <ParameterRow
            field={primaryField}
            isPrimary
            value={config[primaryField.key]}
            onChange={(value) => onUpdateConfig(primaryField.key, value)}
          />
        </div>
        <div className="divide-y divide-zinc-200">
          {secondaryFields.map((field) => (
            <ParameterRow
              key={field.key}
              field={field}
              value={config[field.key]}
              onChange={(value) => onUpdateConfig(field.key, value)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-zinc-300 p-2">
        {error ? (
          <div className="mb-2 border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] leading-4 text-red-800">
            {error}
          </div>
        ) : null}
        <button
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-sm bg-zinc-950 px-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={!hasImage || isProcessing}
          type="button"
          onClick={onApply}
        >
          <Zap size={13} />
          {isProcessing ? 'Applying' : 'Apply'}
        </button>
      </div>
    </aside>
  )
}
