import { Camera, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { IconButton } from './IconButton'

const CAPTURE_SIZE = 1024

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
  const cameraRef = useRef<PerspectiveCamera | null>(null)
  const modelRef = useRef<Object3D | null>(null)
  const modelFileNameRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hasModel, setHasModel] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [modelName, setModelName] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) {
      return
    }

    const scene = new Scene()
    sceneRef.current = scene

    const camera = new PerspectiveCamera(35, 1, 0.1, 1000)
    camera.position.set(0, 0, 4)
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

    const renderScene = () => {
      renderer.render(scene, camera)
    }

    const resize = () => {
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderScene()
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
    }
  }, [onClose])

  const renderScene = () => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!renderer || !scene || !camera) {
      return
    }
    renderer.render(scene, camera)
  }

  const loadModelFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'glb' && extension !== 'gltf') {
      setError('GLB or GLTF file required')
      return
    }

    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!scene || !camera) {
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
      frameModel(model, camera)
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
    camera.aspect = 1
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)

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
    camera.aspect = displayWidth / displayHeight
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)

    onCapture(fileName, imageData)
  }

  return (
    <div
      aria-label="3D model capture"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white"
      role="dialog"
    >
      <div className="flex h-10 items-center justify-between border-b border-white/15 px-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-medium">3D Capture</span>
          <span className="truncate text-zinc-400">
            {modelName ?? (isLoading ? 'Loading' : 'Drop GLB or GLTF')}
          </span>
          <span className="text-zinc-400">{CAPTURE_SIZE} x {CAPTURE_SIZE}</span>
        </div>
        <div className="flex items-center gap-1">
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
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
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

function frameModel(model: Object3D, camera: PerspectiveCamera) {
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
  const fov = (camera.fov * Math.PI) / 180
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.35
  camera.position.set(0, 0, distance)
  camera.near = Math.max(distance / 100, 0.01)
  camera.far = distance * 100
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
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
