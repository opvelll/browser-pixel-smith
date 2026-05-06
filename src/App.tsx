import {
  Check,
  Download,
  ImagePlus,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react'
import {
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  defaultPixelSnapperConfig,
  type PixelSnapperConfig,
  processPixelSnap,
  validateImageDimensions,
} from './pixelSnapper'

type LoadedImage = {
  fileName: string
  imageData: ImageData
}

type HistoryEntry = {
  id: number
  label: string
  fileName: string
  imageData: ImageData
}

type ExpandedImage = {
  label: string
  fileName: string
  imageData: ImageData
}

const CONFIG_FIELDS: Array<{
  key: keyof PixelSnapperConfig
  label: string
  min: number
  max: number
  step: number
}> = [
  { key: 'kColors', label: 'Colors', min: 1, max: 256, step: 1 },
  { key: 'kSeed', label: 'Seed', min: 0, max: 9999, step: 1 },
  { key: 'maxKmeansIterations', label: 'K-means iter', min: 1, max: 80, step: 1 },
  { key: 'peakThresholdMultiplier', label: 'Peak threshold', min: 0.01, max: 2, step: 0.01 },
  { key: 'peakDistanceFilter', label: 'Peak distance', min: 1, max: 32, step: 1 },
  { key: 'walkerSearchWindowRatio', label: 'Search ratio', min: 0.01, max: 2, step: 0.01 },
  { key: 'walkerMinSearchWindow', label: 'Min window', min: 1, max: 32, step: 1 },
  { key: 'walkerStrengthThreshold', label: 'Strength', min: 0.01, max: 2, step: 0.01 },
  { key: 'minCutsPerAxis', label: 'Min cuts', min: 2, max: 64, step: 1 },
  { key: 'fallbackTargetSegments', label: 'Fallback cells', min: 2, max: 512, step: 1 },
  { key: 'maxStepRatio', label: 'Step ratio', min: 1, max: 8, step: 0.1 },
]

function App() {
  const [currentImage, setCurrentImage] = useState<LoadedImage | null>(null)
  const [previewImage, setPreviewImage] = useState<ImageData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [config, setConfig] = useState<PixelSnapperConfig>(defaultPixelSnapperConfig)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedImage, setExpandedImage] = useState<ExpandedImage | null>(null)
  const currentCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextHistoryIdRef = useRef(1)

  useEffect(() => {
    if (currentImage) {
      drawImageData(currentCanvasRef.current, currentImage.imageData)
    }
  }, [currentImage])

  useEffect(() => {
    if (previewImage) {
      drawImageData(previewCanvasRef.current, previewImage)
    }
  }, [previewImage])

  const pushHistory = (label: string, fileName: string, imageData: ImageData) => {
    const entry = {
      id: nextHistoryIdRef.current,
      label,
      fileName,
      imageData: cloneImageData(imageData),
    }
    nextHistoryIdRef.current += 1
    setHistory((entries) => [...entries, entry])
  }

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) {
      return
    }

    setError(null)
    setPreviewImage(null)

    try {
      const imageData = await fileToImageData(file)
      const loaded = { fileName: file.name, imageData }
      nextHistoryIdRef.current = 1
      setCurrentImage(loaded)
      setHistory([])
      pushHistory('Original', file.name, imageData)
    } catch (loadError) {
      setCurrentImage(null)
      setHistory([])
      setError(errorMessage(loadError))
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files)
  }

  const updateConfig = (key: keyof PixelSnapperConfig, rawValue: number) => {
    const field = CONFIG_FIELDS.find((candidate) => candidate.key === key)
    const min = field?.min ?? Number.NEGATIVE_INFINITY
    const max = field?.max ?? Number.POSITIVE_INFINITY
    const value = Number.isFinite(rawValue) ? clamp(rawValue, min, max) : min
    setConfig((nextConfig) => ({ ...nextConfig, [key]: value }))
  }

  const applyProcessing = () => {
    if (!currentImage || isProcessing) {
      return
    }

    setIsProcessing(true)
    setError(null)

    window.setTimeout(() => {
      try {
        const processed = processPixelSnap(currentImage.imageData, config)
        const nextLabel = `Pixel Snap #${history.length}`
        setPreviewImage(processed)
        setCurrentImage({ ...currentImage, imageData: processed })
        pushHistory(nextLabel, currentImage.fileName, processed)
      } catch (processingError) {
        setPreviewImage(null)
        setError(errorMessage(processingError))
      } finally {
        setIsProcessing(false)
      }
    }, 0)
  }

  const downloadCurrentImage = () => {
    if (!currentImage) {
      return
    }

    imageDataToBlob(currentImage.imageData, (blob) => {
      if (!blob) {
        setError('Failed to create PNG download')
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const baseName = currentImage.fileName.replace(/\.[^.]+$/, '') || 'pixel-snapped'
      link.href = url
      link.download = `${baseName}-current.png`
      link.click()
      URL.revokeObjectURL(url)
    })
  }

  const openExpanded = (label: string, fileName: string, imageData: ImageData) => {
    setExpandedImage({ label, fileName, imageData })
  }

  return (
    <main className="flex h-screen min-h-[560px] flex-col overflow-hidden bg-zinc-100 text-zinc-950">
      <input
        ref={fileInputRef}
        accept="image/*"
        className="sr-only"
        type="file"
        onChange={handleFileChange}
      />

      <section className="grid min-h-0 flex-1 grid-cols-1 border-b border-zinc-300 lg:grid-cols-[minmax(0,1fr)_286px]">
        <div className="grid min-h-0 grid-cols-1 border-r border-zinc-300 md:grid-cols-2">
          <ImageWorkspacePanel
            canvasRef={currentCanvasRef}
            fileInputRef={fileInputRef}
            image={currentImage?.imageData ?? null}
            isDragging={isDragging}
            label="Target"
            meta={currentImage ? `${currentImage.imageData.width} x ${currentImage.imageData.height}` : 'Drop image'}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onExpand={
              currentImage
                ? () => openExpanded('Target', currentImage.fileName, currentImage.imageData)
                : undefined
            }
          />
          <ImageWorkspacePanel
            canvasRef={previewCanvasRef}
            image={previewImage}
            isProcessing={isProcessing}
            label="Result"
            meta={
              previewImage
                ? `${previewImage.width} x ${previewImage.height}`
                : isProcessing
                  ? 'Processing'
                  : 'Waiting'
            }
            onExpand={
              previewImage && currentImage
                ? () => openExpanded('Result', currentImage.fileName, previewImage)
                : undefined
            }
          />
        </div>

        <aside className="flex min-h-0 flex-col bg-zinc-50 text-xs">
          <div className="flex h-9 items-center justify-between border-b border-zinc-300 px-2">
            <div className="flex items-center gap-1.5 font-medium text-zinc-800">
              <SlidersHorizontal size={14} />
              Process
            </div>
            <button
              className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!currentImage || isProcessing}
              title="Download current image"
              type="button"
              onClick={downloadCurrentImage}
            >
              <Download size={13} />
            </button>
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
                field={CONFIG_FIELDS[0]}
                isPrimary
                value={config.kColors}
                onChange={(value) => updateConfig('kColors', value)}
              />
            </div>
            <div className="divide-y divide-zinc-200">
              {CONFIG_FIELDS.slice(1).map((field) => (
                <ParameterRow
                  key={field.key}
                  field={field}
                  value={config[field.key]}
                  onChange={(value) => updateConfig(field.key, value)}
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
              disabled={!currentImage || isProcessing}
              type="button"
              onClick={applyProcessing}
            >
              <Zap size={13} />
              {isProcessing ? 'Applying' : 'Apply'}
            </button>
          </div>
        </aside>
      </section>

      <HistoryStrip
        entries={history}
        onOpen={(entry) => openExpanded(entry.label, entry.fileName, entry.imageData)}
      />

      {expandedImage ? (
        <ExpandedImageDialog
          fileName={expandedImage.fileName}
          imageData={expandedImage.imageData}
          label={expandedImage.label}
          onClose={() => setExpandedImage(null)}
        />
      ) : null}
    </main>
  )
}

function ImageWorkspacePanel({
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

function ParameterRow({
  field,
  isPrimary = false,
  value,
  onChange,
}: {
  field: (typeof CONFIG_FIELDS)[number]
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

function HistoryStrip({
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

function ExpandedImageDialog({
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

function IconButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

async function fileToImageData(file: File): Promise<ImageData> {
  if (file.size === 0) {
    throw new Error('File is empty')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file')
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('Could not decode the image file')
  })

  try {
    validateImageDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      throw new Error('Canvas is not available')
    }
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}

function drawImageData(canvas: HTMLCanvasElement | null, imageData: ImageData) {
  if (!canvas) {
    return
  }

  canvas.width = imageData.width
  canvas.height = imageData.height
  const context = canvas.getContext('2d')
  if (!context) {
    return
  }
  context.putImageData(imageData, 0, 0)
}

function imageDataToBlob(imageData: ImageData, callback: (blob: Blob | null) => void) {
  const canvas = document.createElement('canvas')
  drawImageData(canvas, imageData)
  canvas.toBlob(callback, 'image/png')
}

function cloneImageData(imageData: ImageData) {
  return new ImageData(Uint8ClampedArray.from(imageData.data), imageData.width, imageData.height)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default App
