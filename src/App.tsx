import type { ChangeEvent, DragEvent } from 'react'
import { useRef, useState } from 'react'
import { ExpandedImageDialog } from './components/ExpandedImageDialog'
import { HistoryStrip } from './components/HistoryStrip'
import { ImageComparePanel } from './components/ImageComparePanel'
import { ModelCaptureDialog } from './components/ModelCaptureDialog'
import { ProcessSidebar } from './components/ProcessSidebar'
import { usePixelSnapperWorkspace } from './hooks/usePixelSnapperWorkspace'

function App() {
  const {
    activeMethod,
    applyColorCutout,
    applySelectionCrop,
    applyProcessing,
    currentImage,
    downloadCurrentImage,
    downloadResultImage,
    downloadTargetImage,
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
    setHistoryEntryAsTarget,
    setImageAsTarget,
    setResultAsTarget,
    updateResizeAlgorithm,
    updateResizeScale,
    updateConfig,
  } = usePixelSnapperWorkspace()
  const [isDragging, setIsDragging] = useState(false)
  const [isModelCaptureOpen, setIsModelCaptureOpen] = useState(false)
  const [comparePanelResetKey, setComparePanelResetKey] = useState(0)
  const dragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetComparePanelTools = () => {
    setComparePanelResetKey((key) => key + 1)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    resetComparePanelTools()
    void handleFiles(event.dataTransfer.files)
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    resetComparePanelTools()
    void handleFiles(event.target.files).finally(() => {
      event.target.value = ''
    })
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
        <div className="h-full min-h-0">
          <ImageComparePanel
            key={comparePanelResetKey}
            fileInputRef={fileInputRef}
            isDragging={isDragging}
            isLoadingImage={isLoadingImage}
            isProcessing={isProcessing}
            resultImage={previewImage}
            targetImage={currentImage?.imageData ?? null}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={handleDrop}
            onApplyColorCutout={applyColorCutout}
            onApplySelectionCrop={applySelectionCrop}
            onDownloadResult={previewImage ? downloadResultImage : undefined}
            onDownloadTarget={currentImage ? downloadTargetImage : undefined}
            onExpandResult={
              previewImage && currentImage
                ? () => openExpanded('Result', currentImage.fileName, previewImage)
                : undefined
            }
            onExpandTarget={
              currentImage
                ? () => openExpanded('Target', currentImage.fileName, currentImage.imageData)
                : undefined
            }
            onOpen3dCapture={() => {
              resetComparePanelTools()
              setIsModelCaptureOpen(true)
            }}
            onSetResultAsTarget={
              previewImage
                ? () => {
                    resetComparePanelTools()
                    setResultAsTarget()
                  }
                : undefined
            }
          />
        </div>

        <ProcessSidebar
          activeMethod={activeMethod}
          error={error}
          hasImage={Boolean(currentImage)}
          isProcessing={isProcessing}
          pixelSnapConfig={pixelSnapConfig}
          resizeConfig={resizeConfig}
          onApply={() => {
            resetComparePanelTools()
            applyProcessing()
          }}
          onDownload={downloadCurrentImage}
          onResetConfig={resetActiveConfig}
          onSelectMethod={setActiveMethod}
          onUpdateResizeAlgorithm={updateResizeAlgorithm}
          onUpdateResizeScale={updateResizeScale}
          onUpdateConfig={updateConfig}
        />
      </section>

      <HistoryStrip
        entries={history}
        onOpen={(entry) => openExpanded(entry.label, entry.fileName, entry.imageData)}
        onSetAsTarget={(entry) => {
          resetComparePanelTools()
          setHistoryEntryAsTarget(entry)
        }}
      />

      {expandedImage ? (
        <ExpandedImageDialog
          fileName={expandedImage.fileName}
          imageData={expandedImage.imageData}
          label={expandedImage.label}
          onClose={() => setExpandedImage(null)}
        />
      ) : null}

      {isModelCaptureOpen ? (
        <ModelCaptureDialog
          onCapture={(fileName, imageData) => {
            resetComparePanelTools()
            setImageAsTarget(fileName, imageData)
            setIsModelCaptureOpen(false)
          }}
          onClose={() => setIsModelCaptureOpen(false)}
        />
      ) : null}
    </main>
  )
}

export default App
