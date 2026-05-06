import type { PixelSnapperControlField } from '../config/pixelSnapperControls'

export function ParameterRow({
  field,
  isPrimary = false,
  value,
  onChange,
}: {
  field: PixelSnapperControlField
  isPrimary?: boolean
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label
      className={`grid items-center gap-2 px-2 py-1.5 text-xs ${
        isPrimary ? 'grid-cols-[74px_minmax(0,1fr)_58px]' : 'grid-cols-[92px_minmax(0,1fr)]'
      }`}
    >
      <span className="truncate text-[11px] font-medium text-zinc-600">{field.label}</span>
      {isPrimary ? (
        <input
          className="h-1.5 min-w-0 accent-zinc-950"
          max={field.max}
          min={field.min}
          step={field.step}
          type="range"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      ) : null}
      <input
        className="h-6 w-full min-w-0 rounded-sm border border-zinc-300 bg-white px-1.5 text-right text-[11px] text-zinc-900 outline-none focus:border-zinc-700"
        max={field.max}
        min={field.min}
        step={field.step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
