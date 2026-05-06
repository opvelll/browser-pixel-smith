import { type ChangeEvent, type DragEvent, type RefObject, useEffect, useRef, useState } from 'react'
import { defaultPixelSnapperConfig, processPixelSnap, validateImageDimensions } from './pixelSnapper'

type LoadedImage = {
  fileName: string
  imageData: ImageData
}

function App() {
  const [source, setSource] = useState<LoadedImage | null>(null)
  const [result, setResult] = useState<ImageData | null>(null)
  const [kColors, setKColors] = useState(defaultPixelSnapperConfig.kColors)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedImage, setExpandedImage] = useState<{ label: string; imageData: ImageData } | null>(null)
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (source?.imageData) {
      drawImageData(sourceCanvasRef.current, source.imageData)
    }
  }, [source])

  useEffect(() => {
    if (result) {
      drawImageData(resultCanvasRef.current, result)
    }
  }, [result])

  useEffect(() => {
    return () => {
      if (processTimerRef.current != null) {
        window.clearTimeout(processTimerRef.current)
      }
    }
  }, [])

  const runProcessing = (imageData: ImageData, nextKColors: number) => {
    if (processTimerRef.current != null) {
      window.clearTimeout(processTimerRef.current)
    }

    setResult(null)
    setIsProcessing(true)
    setError(null)

    processTimerRef.current = window.setTimeout(() => {
      processTimerRef.current = null
      try {
        setResult(processPixelSnap(imageData, { kColors: nextKColors }))
      } catch (processingError) {
        setError(errorMessage(processingError))
      } finally {
        setIsProcessing(false)
      }
    }, 0)
  }

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) {
      return
    }

    setError(null)
    setResult(null)

    try {
      const imageData = await fileToImageData(file)
      setSource({ fileName: file.name, imageData })
      runProcessing(imageData, kColors)
    } catch (loadError) {
      setSource(null)
      setError(errorMessage(loadError))
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files)
  }

  const updateKColors = (nextKColors: number) => {
    const clamped = clamp(nextKColors, 1, 256)
    setKColors(clamped)
    if (source) {
      runProcessing(source.imageData, clamped)
    }
  }

  const downloadResult = () => {
    if (!resultCanvasRef.current || !result) {
      return
    }

    resultCanvasRef.current.toBlob((blob) => {
      if (!blob) {
        setError('Failed to create PNG download')
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const baseName = source?.fileName.replace(/\.[^.]+$/, '') || 'pixel-snapped'
      link.href = url
      link.download = `${baseName}-pixel-snapped.png`
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-cyan-700">Pixel Snapper</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              Browser PNG snap tool
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3 rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm">
              <span className="text-sm font-medium text-zinc-700">k_colors</span>
              <input
                className="h-2 w-32 accent-cyan-700"
                min="1"
                max="64"
                step="1"
                type="range"
                value={kColors}
                onChange={(event) => updateKColors(Number(event.target.value))}
              />
              <input
                className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm"
                min="1"
                max="256"
                step="1"
                type="number"
                value={kColors}
                onChange={(event) => updateKColors(Number(event.target.value) || 1)}
              />
            </label>
            <button
              className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={!result || isProcessing}
              type="button"
              onClick={downloadResult}
            >
              Download PNG
            </button>
          </div>
        </header>

        <section className="grid flex-1 gap-5 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4">
            <label
              className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-white px-5 py-8 text-center shadow-sm transition ${
                isDragging ? 'border-cyan-600 ring-4 ring-cyan-100' : 'border-zinc-300 hover:border-cyan-600'
              }`}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                accept="image/*"
                className="sr-only"
                type="file"
                onChange={handleFileChange}
              />
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-800">
                Drop image
              </span>
              <span className="mt-4 text-lg font-semibold text-zinc-950">Choose or drag a PNG</span>
              <span className="mt-2 text-sm leading-6 text-zinc-600">
                Max 10000x10000. Transparent pixels stay transparent and are skipped during
                quantization.
              </span>
            </label>

            {source ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                  <dt className="font-medium text-zinc-500">File</dt>
                  <dd className="truncate text-zinc-900">{source.fileName}</dd>
                  <dt className="font-medium text-zinc-500">Input</dt>
                  <dd className="text-zinc-900">
                    {source.imageData.width} x {source.imageData.height}
                  </dd>
                  <dt className="font-medium text-zinc-500">Output</dt>
                  <dd className="text-zinc-900">
                    {result ? `${result.width} x ${result.height}` : 'Waiting'}
                  </dd>
                </dl>
              </div>
            ) : null}

            {isProcessing ? (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
                Processing image...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                {error}
              </div>
            ) : null}
          </aside>

          <section className="grid min-h-[520px] gap-5 xl:grid-cols-2">
            <CanvasPanel
              canvasRef={sourceCanvasRef}
              label="Original"
              isEmpty={!source}
              onExpand={source ? () => setExpandedImage({ label: 'Original', imageData: source.imageData }) : undefined}
            />
            <CanvasPanel
              canvasRef={resultCanvasRef}
              label="Pixel snapped"
              isEmpty={!result}
              isProcessing={isProcessing}
              onExpand={result ? () => setExpandedImage({ label: 'Pixel snapped', imageData: result }) : undefined}
            />
          </section>
        </section>
      </div>
      {expandedImage ? (
        <ExpandedImageDialog
          imageData={expandedImage.imageData}
          label={expandedImage.label}
          onClose={() => setExpandedImage(null)}
        />
      ) : null}
    </main>
  )
}

function CanvasPanel({
  canvasRef,
  label,
  isEmpty,
  isProcessing = false,
  onExpand,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  label: string
  isEmpty: boolean
  isProcessing?: boolean
  onExpand?: () => void
}) {
  return (
    <div className="flex min-h-80 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">{label}</h2>
        <div className="flex items-center gap-3">
          {isProcessing ? <span className="text-xs font-medium text-cyan-700">Working</span> : null}
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition hover:border-cyan-700 hover:text-cyan-800 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isEmpty || !onExpand}
            type="button"
            onClick={onExpand}
          >
            Expand
          </button>
        </div>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-auto bg-[linear-gradient(45deg,#f4f4f5_25%,transparent_25%),linear-gradient(-45deg,#f4f4f5_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f4f4f5_75%),linear-gradient(-45deg,transparent_75%,#f4f4f5_75%)] bg-[length:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0px] p-4">
        {isEmpty ? (
          <div className="max-w-52 text-center text-sm text-zinc-500">
            {isProcessing ? 'Rendering result...' : 'No image loaded'}
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

function ExpandedImageDialog({
  imageData,
  label,
  onClose,
}: {
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
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950/90 text-white"
      role="dialog"
    >
      <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{label}</h2>
          <p className="mt-0.5 text-xs text-zinc-300">
            {imageData.width} x {imageData.height}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="h-9 w-9 rounded-md border border-white/25 bg-white/10 text-lg font-semibold leading-none text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={zoom <= 0.25}
            title="Zoom out"
            type="button"
            onClick={() => updateZoom(zoom / 1.25)}
          >
            -
          </button>
          <button
            className="min-w-20 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            title="Reset zoom"
            type="button"
            onClick={() => updateZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="h-9 w-9 rounded-md border border-white/25 bg-white/10 text-lg font-semibold leading-none text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={zoom >= 8}
            title="Zoom in"
            type="button"
            onClick={() => updateZoom(zoom * 1.25)}
          >
            +
          </button>
          <button
            className="rounded-md border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-auto bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] p-5"
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export default App
