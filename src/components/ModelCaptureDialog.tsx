import { Camera, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { IconButton } from './IconButton'

const CAPTURE_SIZE = 1024
const DEFAULT_FOCAL_LENGTH = 120
const MIN_FOCAL_LENGTH = 24
const MAX_FOCAL_LENGTH = 200
const ROTATION_SNAP_RADIANS = Math.PI / 8
const MODEL_PADDING = 1.35

type ProjectionMode = 'perspective' | 'orthographic'
type CaptureCamera = PerspectiveCamera | OrthographicCamera
type ModelFrame = {
  maxDim: number
}
type RotationDrag = {
  pointerId: number
  startX: number
  startY: number
  startRotationX: number
  startRotationY: number
}

export function ModelCaptureDialog({
  onCapture,
  onClose,
}: {
  onCapture: (fileName: string, imageData: ImageData) => void
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const sceneRef = useRef<Scene | null>(null)
  const cameraRef = useRef<CaptureCamera | null>(null)
  const modelRef = useRef<Object3D | null>(null)
  const modelFileNameRef = useRef<string | null>(null)
  const modelFrameRef = useRef<ModelFrame | null>(null)
  const projectionModeRef = useRef<ProjectionMode>('perspective')
  const focalLengthRef = useRef(DEFAULT_FOCAL_LENGTH)
  const rotationDragRef = useRef<RotationDrag | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hasModel, setHasModel] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [modelName, setModelName] = useState<string | null>(null)
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('perspective')
  const [focalLength, setFocalLength] = useState(DEFAULT_FOCAL_LENGTH)

  const renderScene = useCallback(() => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!renderer || !scene || !camera) {
      return
    }
    renderer.render(scene, camera)
  }, [])

  const updateCamera = useCallback(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)
    const camera = createCamera(
      projectionModeRef.current,
      width / height,
      focalLengthRef.current,
      modelFrameRef.current,
    )
    cameraRef.current = camera
    renderScene()
  }, [renderScene])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }

    const scene = new Scene()
    sceneRef.current = scene

    const camera = createCamera(
      projectionModeRef.current,
      1,
      focalLengthRef.current,
      modelFrameRef.current,
    )
    cameraRef.current = camera

    const ambient = new AmbientLight(0xffffff, 1.8)
    const keyLight = new DirectionalLight(0xffffff, 2.6)
    keyLight.position.set(3, 4, 5)
    const fillLight = new DirectionalLight(0xffffff, 0.9)
    fillLight.position.set(-4, 2, 3)
    scene.add(ambient, keyLight, fillLight)

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas,
      preserveDrawingBuffer: true,
    })
    renderer.setClearColor(new Color(0x000000), 0)
    rendererRef.current = renderer

    const resize = () => {
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height, false)
      updateCamera()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      observer.disconnect()
      disposeObject(modelRef.current)
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      modelRef.current = null
      modelFrameRef.current = null
    }
  }, [onClose, updateCamera])

  useEffect(() => {
    projectionModeRef.current = projectionMode
    updateCamera()
  }, [projectionMode, updateCamera])

  useEffect(() => {
    focalLengthRef.current = focalLength
    updateCamera()
  }, [focalLength, updateCamera])

  const loadModelFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'glb' && extension !== 'gltf') {
      setError('GLB or GLTF file required')
      return
    }

    const scene = sceneRef.current
    if (!scene || !cameraRef.current) {
      setError('3D renderer is not ready')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const buffer = await file.arrayBuffer()
      const loader = new GLTFLoader()
      const gltf = await new Promise<{ scene: Group }>((resolve, reject) => {
        loader.parse(buffer, '', resolve, reject)
      })

      disposeObject(modelRef.current)
      if (modelRef.current) {
        scene.remove(modelRef.current)
      }

      const model = gltf.scene
      modelFrameRef.current = frameModel(model)
      updateCamera()
      scene.add(model)
      modelRef.current = model
      modelFileNameRef.current = captureFileName(file.name)
      setHasModel(true)
      setModelName(file.name)
      renderScene()
    } catch {
      if (!modelRef.current) {
        setHasModel(false)
        setModelName(null)
        modelFileNameRef.current = null
      }
      setError('Could not load this model. Use a self-contained GLB or embedded GLTF.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) {
      void loadModelFile(file)
    }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const model = modelRef.current
    if (!model || isLoading || event.button !== 0) {
      return
    }

    rotationDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRotationX: model.rotation.x,
      startRotationY: model.rotation.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = rotationDragRef.current
    const model = modelRef.current
    if (!drag || !model || drag.pointerId !== event.pointerId) {
      return
    }

    const nextRotationY = drag.startRotationY + (event.clientX - drag.startX) * 0.012
    const nextRotationX = drag.startRotationX + (event.clientY - drag.startY) * 0.012
    model.rotation.y = snapRadians(nextRotationY)
    model.rotation.x = snapRadians(nextRotationX)
    renderScene()
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = rotationDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    rotationDragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const captureModel = () => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    const container = containerRef.current
    const fileName = modelFileNameRef.current
    if (!renderer || !scene || !camera || !container || !modelRef.current || !fileName) {
      return
    }

    const displayWidth = Math.max(container.clientWidth, 1)
    const displayHeight = Math.max(container.clientHeight, 1)

    renderer.setPixelRatio(1)
    renderer.setSize(CAPTURE_SIZE, CAPTURE_SIZE, false)
    cameraRef.current = createCamera(
      projectionModeRef.current,
      1,
      focalLengthRef.current,
      modelFrameRef.current,
    )
    renderer.render(scene, cameraRef.current)

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = CAPTURE_SIZE
    outputCanvas.height = CAPTURE_SIZE
    const context = outputCanvas.getContext('2d', { willReadFrequently: true })
    if (!context) {
      setError('Canvas capture is not available')
      return
    }
    context.clearRect(0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    context.drawImage(renderer.domElement, 0, 0, CAPTURE_SIZE, CAPTURE_SIZE)
    const imageData = context.getImageData(0, 0, CAPTURE_SIZE, CAPTURE_SIZE)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(displayWidth, displayHeight, false)
    cameraRef.current = createCamera(
      projectionModeRef.current,
      displayWidth / displayHeight,
      focalLengthRef.current,
      modelFrameRef.current,
    )
    renderer.render(scene, cameraRef.current)

    onCapture(fileName, imageData)
  }

  return (
    <div
      aria-label="3D model capture"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white"
      role="dialog"
    >
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-white/15 px-2 py-1 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium">3D Capture</span>
          <span className="truncate text-zinc-400">
            {modelName ?? (isLoading ? 'Loading' : 'Drop GLB or GLTF')}
          </span>
          <span className="text-zinc-400">{CAPTURE_SIZE} x {CAPTURE_SIZE}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-sm border border-white/15 bg-white/5 p-0.5">
            <button
              className={`h-6 rounded-sm px-2 text-[11px] ${
                projectionMode === 'perspective'
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              }`}
              type="button"
              onClick={() => setProjectionMode('perspective')}
            >
              Perspective
            </button>
            <button
              className={`h-6 rounded-sm px-2 text-[11px] ${
                projectionMode === 'orthographic'
                  ? 'bg-white text-zinc-950'
                  : 'text-zinc-300 hover:bg-white/10 hover:text-white'
              }`}
              type="button"
              onClick={() => setProjectionMode('orthographic')}
            >
              Parallel
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-zinc-300">
            <span>Focal</span>
            <input
              aria-label="Focal length"
              className="h-6 w-28 accent-cyan-300 disabled:opacity-40"
              disabled={projectionMode === 'orthographic'}
              max={MAX_FOCAL_LENGTH}
              min={MIN_FOCAL_LENGTH}
              step={1}
              type="range"
              value={focalLength}
              onChange={(event) => setFocalLength(Number(event.target.value))}
            />
            <span className="w-10 text-right tabular-nums">{focalLength}mm</span>
          </label>
          <button
            className="inline-flex h-7 items-center gap-1 rounded-sm border border-white/20 bg-white/10 px-2 text-[11px] text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasModel || isLoading}
            type="button"
            onClick={captureModel}
          >
            <Camera size={14} />
            <span>Capture</span>
          </button>
          <IconButton label="Close" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`relative min-h-0 flex-1 overflow-hidden bg-[linear-gradient(45deg,#27272a_25%,transparent_25%),linear-gradient(-45deg,#27272a_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#27272a_75%),linear-gradient(-45deg,transparent_75%,#27272a_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px] ${
          isDragging ? 'outline outline-2 outline-cyan-400 outline-offset-[-2px]' : ''
        }`}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onPointerCancel={handlePointerUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <canvas ref={canvasRef} className={`block h-full w-full ${hasModel ? 'cursor-grab' : ''}`} />
        {!hasModel ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-zinc-300">
            <Upload size={22} />
            <span>{isLoading ? 'Loading' : 'Drop GLB or GLTF'}</span>
          </div>
        ) : null}
        {error ? (
          <div className="absolute bottom-3 left-1/2 max-w-[min(520px,calc(100%-24px))] -translate-x-1/2 rounded-sm border border-red-400/40 bg-red-950/85 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function createCamera(
  projectionMode: ProjectionMode,
  aspect: number,
  focalLength: number,
  modelFrame: ModelFrame | null,
): CaptureCamera {
  const maxDim = modelFrame?.maxDim ?? 1

  if (projectionMode === 'orthographic') {
    const viewHeight = maxDim * MODEL_PADDING
    const viewWidth = viewHeight * aspect
    const camera = new OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewHeight / 2,
      -viewHeight / 2,
      Math.max(maxDim / 100, 0.01),
      maxDim * 100,
    )
    camera.position.set(0, 0, maxDim * 4)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    return camera
  }

  const camera = new PerspectiveCamera(35, aspect, 0.1, 1000)
  camera.setFocalLength(focalLength)
  const fov = (camera.fov * Math.PI) / 180
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * MODEL_PADDING
  camera.position.set(0, 0, distance)
  camera.near = Math.max(distance / 100, 0.01)
  camera.far = distance * 100
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  return camera
}

function frameModel(model: Object3D): ModelFrame {
  model.position.set(0, 0, 0)
  model.updateMatrixWorld(true)

  const box = new Box3().setFromObject(model)
  if (box.isEmpty()) {
    throw new Error('Model has no visible bounds')
  }

  const center = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  model.position.sub(center)

  const maxDim = Math.max(size.x, size.y, size.z, 1)
  return { maxDim }
}

function captureFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim() || 'model'
  return `${baseName}-3d-capture.png`
}

function disposeObject(object: Object3D | null) {
  if (!object) {
    return
  }

  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return
    }
    child.geometry.dispose()
    disposeMaterial(child.material)
  })
}

function disposeMaterial(material: Material | Material[]) {
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial)
    return
  }
  material.dispose()
}

function snapRadians(value: number) {
  return Math.round(value / ROTATION_SNAP_RADIANS) * ROTATION_SNAP_RADIANS
}
