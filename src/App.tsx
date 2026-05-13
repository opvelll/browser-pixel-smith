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
    applyProcessing,
    currentImage,
    downloadCurrentImage,
    error,
    expandedImage,
    handleFiles,
    history,
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
  } = usePixelSnapperWorkspace()
  const [isDragging, setIsDragging] = useState(false)
  const [isModelCaptureOpen, setIsModelCaptureOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
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
        <div className="min-h-0">
          <ImageComparePanel
            fileInputRef={fileInputRef}
            isDragging={isDragging}
            isProcessing={isProcessing}
            resultImage={previewImage}
            targetImage={currentImage?.imageData ?? null}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
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
            onOpen3dCapture={() => setIsModelCaptureOpen(true)}
            onSetResultAsTarget={previewImage ? setResultAsTarget : undefined}
          />
        </div>

        <ProcessSidebar
          activeMethod={activeMethod}
          error={error}
          hasImage={Boolean(currentImage)}
          isProcessing={isProcessing}
          pixelSnapConfig={pixelSnapConfig}
          resizeConfig={resizeConfig}
          onApply={applyProcessing}
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
