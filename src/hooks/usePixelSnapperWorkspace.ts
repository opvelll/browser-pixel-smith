import { useRef, useState } from 'react'
import { PIXEL_SNAPPER_CONTROL_FIELDS } from '../config/pixelSnapperControls'
import { RESIZE_SCALE_FIELD } from '../config/resizeControls'
import { errorMessage } from '../lib/errors'
import { cloneImageData, fileToImageData, imageDataToBlob } from '../lib/imageData'
import { clamp } from '../lib/number'
import {
  defaultPixelSnapperConfig,
  type PixelSnapperConfig,
  processPixelSnap,
} from '../pixelSnapper'
import {
  defaultResizeConfig,
  processResize,
  type ResizeAlgorithm,
  type ResizeConfig,
} from '../resize'
import type { ExpandedImage, HistoryEntry, LoadedImage } from '../types/images'

export type ProcessingMethod = 'pixelSnap' | 'resize'

export function usePixelSnapperWorkspace() {
  const [currentImage, setCurrentImage] = useState<LoadedImage | null>(null)
  const [previewImage, setPreviewImage] = useState<ImageData | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [activeMethod, setActiveMethod] = useState<ProcessingMethod>('pixelSnap')
  const [pixelSnapConfig, setPixelSnapConfig] = useState<PixelSnapperConfig>(
    defaultPixelSnapperConfig,
  )
  const [resizeConfig, setResizeConfig] = useState<ResizeConfig>(defaultResizeConfig)
  const [isLoadingImage, setIsLoadingImage] = useState(false)
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
    setIsLoadingImage(true)

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
      setIsLoadingImage(false)
    }
  }

  const setImageAsTarget = (fileName: string, imageData: ImageData) => {
    const loaded = { fileName, imageData: cloneImageData(imageData) }
    nextHistoryIdRef.current = 1
    setCurrentImage(loaded)
    setPreviewImage(null)
    setError(null)
    setHistory([])
    pushHistory('Original', fileName, imageData)
  }

  const updateConfig = (key: keyof PixelSnapperConfig, rawValue: number) => {
    const field = PIXEL_SNAPPER_CONTROL_FIELDS.find((candidate) => candidate.key === key)
    const min = field?.min ?? Number.NEGATIVE_INFINITY
    const max = field?.max ?? Number.POSITIVE_INFINITY
    const value = Number.isFinite(rawValue) ? clamp(rawValue, min, max) : min
    setPixelSnapConfig((nextConfig) => ({ ...nextConfig, [key]: value }))
  }

  const updateResizeScale = (rawValue: number) => {
    const value = Number.isFinite(rawValue)
      ? clamp(rawValue, RESIZE_SCALE_FIELD.min, RESIZE_SCALE_FIELD.max)
      : RESIZE_SCALE_FIELD.min
    setResizeConfig((nextConfig) => ({ ...nextConfig, scale: value }))
  }

  const updateResizeAlgorithm = (algorithm: ResizeAlgorithm) => {
    setResizeConfig((nextConfig) => ({ ...nextConfig, algorithm }))
  }

  const resetActiveConfig = () => {
    if (activeMethod === 'pixelSnap') {
      setPixelSnapConfig(defaultPixelSnapperConfig)
      return
    }
    setResizeConfig(defaultResizeConfig)
  }

  const applyProcessing = () => {
    if (!currentImage || isProcessing) {
      return
    }

    setIsProcessing(true)
    setError(null)

    window.setTimeout(() => {
      try {
        const processed =
          activeMethod === 'pixelSnap'
            ? processPixelSnap(currentImage.imageData, pixelSnapConfig)
            : processResize(currentImage.imageData, resizeConfig)
        const methodLabel = activeMethod === 'pixelSnap' ? 'Pixel Snap' : 'Resize'
        const nextLabel = `${methodLabel} #${history.length}`
        setPreviewImage(processed)
        pushHistory(nextLabel, currentImage.fileName, processed)
      } catch (processingError) {
        setPreviewImage(null)
        setError(errorMessage(processingError))
      } finally {
        setIsProcessing(false)
      }
    }, 0)
  }

  const setResultAsTarget = () => {
    if (!currentImage || !previewImage || isProcessing) {
      return
    }

    setCurrentImage({ ...currentImage, imageData: cloneImageData(previewImage) })
    setPreviewImage(null)
    setError(null)
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
    activeMethod,
    applyProcessing,
    currentImage,
    downloadCurrentImage,
    error,
    expandedImage,
    handleFiles,
    history,
    isLoadingImage,
    isProcessing,
    openExpanded,
    pixelSnapConfig,
    previewImage,
    resetActiveConfig,
    resizeConfig,
    setExpandedImage,
    setActiveMethod,
    setImageAsTarget,
    setResultAsTarget,
    updateResizeAlgorithm,
    updateResizeScale,
    updateConfig,
  }
}
