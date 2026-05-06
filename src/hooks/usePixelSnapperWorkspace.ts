import { useRef, useState } from 'react'
import { PIXEL_SNAPPER_CONTROL_FIELDS } from '../config/pixelSnapperControls'
import { errorMessage } from '../lib/errors'
import { cloneImageData, fileToImageData, imageDataToBlob } from '../lib/imageData'
import { clamp } from '../lib/number'
import {
  defaultPixelSnapperConfig,
  type PixelSnapperConfig,
  processPixelSnap,
} from '../pixelSnapper'
import type { ExpandedImage, HistoryEntry, LoadedImage } from '../types/images'

export function usePixelSnapperWorkspace() {
  const [currentImage, setCurrentImage] = useState<LoadedImage | null>(null)
  const [previewImage, setPreviewImage] = useState<ImageData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [config, setConfig] = useState<PixelSnapperConfig>(defaultPixelSnapperConfig)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedImage, setExpandedImage] = useState<ExpandedImage | null>(null)
  const nextHistoryIdRef = useRef(1)

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
    }
  }

  const updateConfig = (key: keyof PixelSnapperConfig, rawValue: number) => {
    const field = PIXEL_SNAPPER_CONTROL_FIELDS.find((candidate) => candidate.key === key)
    const min = field?.min ?? Number.NEGATIVE_INFINITY
    const max = field?.max ?? Number.POSITIVE_INFINITY
    const value = Number.isFinite(rawValue) ? clamp(rawValue, min, max) : min
    setConfig((nextConfig) => ({ ...nextConfig, [key]: value }))
  }

  const resetConfig = () => {
    setConfig(defaultPixelSnapperConfig)
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

  return {
    applyProcessing,
    config,
    currentImage,
    downloadCurrentImage,
    error,
    expandedImage,
    handleFiles,
    history,
    isProcessing,
    openExpanded,
    previewImage,
    resetConfig,
    setExpandedImage,
    updateConfig,
  }
}
