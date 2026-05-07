import { Download, Expand, Grid3X3, RotateCcw, SlidersHorizontal, Zap } from 'lucide-react'
import { PIXEL_SNAPPER_CONTROL_FIELDS } from '../config/pixelSnapperControls'
import { RESIZE_SCALE_FIELD } from '../config/resizeControls'
import type { ProcessingMethod } from '../hooks/usePixelSnapperWorkspace'
import type { PixelSnapperConfig } from '../pixelSnapper'
import type { ResizeAlgorithm, ResizeConfig } from '../resize'
import { ParameterRow } from './ParameterRow'

export function ProcessSidebar({
  activeMethod,
  error,
  hasImage,
  isProcessing,
  pixelSnapConfig,
  resizeConfig,
  onApply,
  onDownload,
  onResetConfig,
  onSelectMethod,
  onUpdateResizeAlgorithm,
  onUpdateResizeScale,
  onUpdateConfig,
}: {
  activeMethod: ProcessingMethod
  error: string | null
  hasImage: boolean
  isProcessing: boolean
  pixelSnapConfig: PixelSnapperConfig
  resizeConfig: ResizeConfig
  onApply: () => void
  onDownload: () => void
  onResetConfig: () => void
  onSelectMethod: (method: ProcessingMethod) => void
  onUpdateResizeAlgorithm: (algorithm: ResizeAlgorithm) => void
  onUpdateResizeScale: (value: number) => void
  onUpdateConfig: (key: keyof PixelSnapperConfig, value: number) => void
}) {
  const [primaryField, ...secondaryFields] = PIXEL_SNAPPER_CONTROL_FIELDS
  const activeLabel = activeMethod === 'pixelSnap' ? 'Pixel Snap' : 'Resize'

  const tabClassName = (method: ProcessingMethod) =>
    `flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 text-[11px] font-medium ${
      activeMethod === method
        ? 'border-zinc-950 bg-white text-zinc-950'
        : 'border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
    }`

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
            disabled={!hasImage || isProcessing}
            title="Download current image"
            type="button"
            onClick={onDownload}
          >
            <Download size={13} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-zinc-300 bg-zinc-100 px-1 pt-1">
        <button
          className={tabClassName('pixelSnap')}
          disabled={isProcessing}
          type="button"
          onClick={() => onSelectMethod('pixelSnap')}
        >
          <Zap size={13} />
          <span className="truncate">Pixel Snap</span>
        </button>
        <button
          className={tabClassName('resize')}
          disabled={isProcessing}
          type="button"
          onClick={() => onSelectMethod('resize')}
        >
          <Expand size={13} />
          <span className="truncate">Resize</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex h-8 items-center justify-between border-b border-zinc-300 px-2">
          <span className="font-medium text-zinc-800">{activeLabel}</span>
          <button
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isProcessing}
            title={`${activeLabel} のパラメータを初期値に戻す`}
            type="button"
            onClick={onResetConfig}
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {activeMethod === 'pixelSnap' ? (
          <>
            <div className="border-b border-zinc-300 px-2 py-2">
              <ParameterRow
                field={primaryField}
                isPrimary
                value={pixelSnapConfig[primaryField.key]}
                onChange={(value) => onUpdateConfig(primaryField.key, value)}
              />
            </div>
            <div className="divide-y divide-zinc-200">
              {secondaryFields.map((field) => (
                <ParameterRow
                  key={field.key}
                  field={field}
                  value={pixelSnapConfig[field.key]}
                  onChange={(value) => onUpdateConfig(field.key, value)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="divide-y divide-zinc-200">
            <div className="px-2 py-2">
              <ParameterRow
                field={RESIZE_SCALE_FIELD}
                isPrimary
                value={resizeConfig.scale}
                onChange={onUpdateResizeScale}
              />
            </div>
            <div className="px-2 py-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-600">
                <Grid3X3 size={13} />
                Algorithm
              </div>
              <div className="grid grid-cols-2 overflow-hidden rounded-sm border border-zinc-300 bg-white">
                {[
                  ['nearestNeighbor', 'Nearest'],
                  ['smooth', 'Smooth'],
                ].map(([algorithm, label]) => (
                  <button
                    key={algorithm}
                    className={`h-7 border-r border-zinc-300 px-2 text-[11px] font-medium last:border-r-0 ${
                      resizeConfig.algorithm === algorithm
                        ? 'bg-zinc-950 text-white'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                    type="button"
                    onClick={() => onUpdateResizeAlgorithm(algorithm as ResizeAlgorithm)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
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
