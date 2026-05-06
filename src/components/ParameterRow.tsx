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
      className={`group relative grid items-center gap-2 px-2 py-1.5 text-xs ${
        isPrimary ? 'grid-cols-[74px_minmax(0,1fr)_58px]' : 'grid-cols-[92px_minmax(0,1fr)]'
      }`}
      title={field.description}
    >
      <span className="truncate text-[11px] font-medium text-zinc-600">{field.label}</span>
      {isPrimary ? (
        <input
          className="h-1.5 min-w-0 accent-zinc-950"
          max={field.max}
          min={field.min}
          step={field.step}
          title={field.description}
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
        title={field.description}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span
        className="pointer-events-none absolute left-2 top-[calc(100%-2px)] z-20 hidden max-w-[240px] rounded-sm border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] leading-4 text-white shadow-lg group-hover:block group-focus-within:block"
        role="tooltip"
      >
        {field.description}
      </span>
    </label>
  )
}
