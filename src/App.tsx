import type { ChangeEvent, DragEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ExpandedImageDialog } from './components/ExpandedImageDialog'
import { HistoryStrip } from './components/HistoryStrip'
import { ImageWorkspacePanel } from './components/ImageWorkspacePanel'
import { ProcessSidebar } from './components/ProcessSidebar'
import { usePixelSnapperWorkspace } from './hooks/usePixelSnapperWorkspace'
import { drawImageData } from './lib/imageData'

function App() {
  const {
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
    setResultAsTarget,
    updateConfig,
  } = usePixelSnapperWorkspace()
  const [isDragging, setIsDragging] = useState(false)
  const currentCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
            onSetAsTarget={previewImage ? setResultAsTarget : undefined}
          />
        </div>

        <ProcessSidebar
          config={config}
          error={error}
          hasImage={Boolean(currentImage)}
          isProcessing={isProcessing}
          onApply={applyProcessing}
          onDownload={downloadCurrentImage}
          onResetConfig={resetConfig}
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
    </main>
  )
}

export default App
