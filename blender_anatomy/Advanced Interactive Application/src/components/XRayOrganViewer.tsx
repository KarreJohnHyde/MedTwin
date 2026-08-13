import { useEffect, useRef } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { MarkerType, OrganId } from "../lib/twins"
import { ORGAN_REGISTRY } from "../lib/twins"

export type CameraPreset = "anterior" | "posterior" | "lateral" | "superior" | "cross-section"
export interface CameraCommand {
  id: number
  action: "preset" | "reset"
  preset?: CameraPreset
}

interface XRayOrganViewerProps {
  organ: OrganId
  forecastDay: number
  finding?: string
  markerType?: MarkerType
  heartRate?: number
  riskIndex?: number
  interactive?: boolean
  command?: CameraCommand
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    materials.forEach((material) => material.dispose())
  })
}

export default function XRayOrganViewer({
  organ,
  forecastDay,
  finding = "",
  markerType = "none",
  heartRate = 72,
  riskIndex = 0,
  interactive = true,
  command,
}: XRayOrganViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const baseScaleRef = useRef(1)
  const riskRef = useRef(riskIndex)
  const heartRateRef = useRef(heartRate)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animationRef = useRef(0)
  const defaultCameraRef = useRef(new THREE.Vector3(2.8, 1.2, 4.8))
  const accent = ORGAN_REGISTRY[organ].accent
  const modelPath = ORGAN_REGISTRY[organ].glb.medium

  useEffect(() => {
    riskRef.current = riskIndex
  }, [riskIndex])

  useEffect(() => {
    heartRateRef.current = heartRate
  }, [heartRate])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050b17, 0.075)
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100)
    camera.position.set(2.8, 1.2, 4.8)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = true
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE
    controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN
    controls.minDistance = 2
    controls.maxDistance = 8
    controls.autoRotate = !interactive
    controls.autoRotateSpeed = 0.55
    controls.enabled = interactive

    scene.add(new THREE.HemisphereLight(0xb9e9ff, 0x030712, 2.6))
    const key = new THREE.DirectionalLight(0xffffff, 4.5)
    key.position.set(5, 7, 6)
    scene.add(key)
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 4)
    rim.position.set(-5, 1, -4)
    scene.add(rim)

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.006, 6, 128),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.35,
      }),
    )
    halo.rotation.x = Math.PI / 2.55
    scene.add(halo)

    const scanLine = new THREE.Mesh(
      new THREE.RingGeometry(1.28, 1.3, 96),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    )
    scanLine.rotation.x = Math.PI / 2
    scene.add(scanLine)

    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    controlsRef.current = controls

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      if (width === 0 || height === 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)

    const clock = new THREE.Clock()
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()
      controls.update()
      halo.rotation.z = elapsed * 0.12
      scanLine.position.y = Math.sin(elapsed * 0.8) * 1.1
      scanLine.material.opacity = 0.12 + Math.sin(elapsed * 1.4) * 0.05

      if (modelRef.current) {
        const beatsPerSecond = heartRateRef.current / 60
        const pulse =
          organ === "heart"
            ? 1 +
              Math.max(0, Math.sin(elapsed * beatsPerSecond * Math.PI * 2)) *
                0.018
            : 1
        modelRef.current.scale.setScalar(baseScaleRef.current * pulse)
        modelRef.current.rotation.y += 0.00045
      }
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationRef.current)
      observer.disconnect()
      controls.dispose()
      scene.remove(halo, scanLine)
      disposeObject(halo)
      disposeObject(scanLine)
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      sceneRef.current = null
      rendererRef.current = null
      cameraRef.current = null
      controlsRef.current = null
    }
  }, [accent, interactive, organ])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !modelPath) return
    let cancelled = false
    const loader = new GLTFLoader()
    loader.load(
      modelPath,
      (gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene)
          return
        }
        if (modelRef.current) {
          scene.remove(modelRef.current)
          disposeObject(modelRef.current)
        }
        const model = gltf.scene
        const bounds = new THREE.Box3().setFromObject(model)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        model.position.sub(center)
        baseScaleRef.current = 3.45 / Math.max(size.x, size.y, size.z)
        model.scale.setScalar(baseScaleRef.current)
        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return
          const source = Array.isArray(child.material)
            ? child.material[0]
            : child.material
          const material = new THREE.MeshPhysicalMaterial({
            color:
              source instanceof THREE.MeshStandardMaterial
                ? source.color
                : new THREE.Color(accent),
            map:
              source instanceof THREE.MeshStandardMaterial ? source.map : null,
            roughness: 0.42,
            metalness: 0.04,
            clearcoat: 0.35,
            emissive: new THREE.Color(accent),
            emissiveIntensity: 0.05 + riskRef.current * 0.003,
            transparent: true,
            opacity: 0.94,
          })
          const previous = child.material
          child.material = material
          const previousMaterials = Array.isArray(previous)
            ? previous
            : [previous]
          previousMaterials.forEach((item) => item.dispose())
        })
        scene.add(model)
        modelRef.current = model
        const distance = Math.max(
          3.2,
          Math.max(size.x, size.y, size.z) * baseScaleRef.current * 1.55,
        )
        defaultCameraRef.current.set(distance * 0.58, distance * 0.24, distance)
        if (cameraRef.current && controlsRef.current) {
          cameraRef.current.position.copy(defaultCameraRef.current)
          controlsRef.current.target.set(0, 0, 0)
          controlsRef.current.update()
        }
      },
      undefined,
      () => {
        modelRef.current = null
      },
    )

    return () => {
      cancelled = true
      if (modelRef.current) {
        scene.remove(modelRef.current)
        disposeObject(modelRef.current)
        modelRef.current = null
      }
    }
  }, [accent, modelPath])

  useEffect(() => {
    if (!command || !cameraRef.current || !controlsRef.current) return
    const camera = cameraRef.current
    const controls = controlsRef.current
    const distance = defaultCameraRef.current.length()
    const positions: Record<CameraPreset, [number, number, number]> = {
      anterior: [0, 0, distance],
      posterior: [0, 0, -distance],
      lateral: [distance, 0, 0],
      superior: [0, distance, 0.01],
      "cross-section": [distance * 0.72, distance * 0.42, distance * 0.72],
    }
    const next =
      command.action === "reset"
        ? defaultCameraRef.current.toArray()
        : positions[command.preset ?? "anterior"]
    camera.position.set(next[0], next[1], next[2])
    camera.up.set(0, 1, 0)
    controls.target.set(0, 0, 0)
    controls.update()
  }, [command])

  const hasFinding = Boolean(
    finding && !finding.toLowerCase().startsWith("no "),
  )

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_48%,rgba(14,116,144,0.11),transparent_42%)]">
      <div
        ref={mountRef}
        className="absolute inset-0"
        aria-label={`Interactive 3D ${ORGAN_REGISTRY[organ].shortName} model`}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/65 px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] text-slate-400 backdrop-blur-md">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
        WebGL · Day {forecastDay}
      </div>
      {!modelPath ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="max-w-56 rounded-2xl border border-dashed border-slate-600/60 bg-slate-950/65 p-5 text-center backdrop-blur-md">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-slate-700 text-xl text-slate-500">
              ◇
            </div>
            <div className="text-sm font-medium text-slate-300">
              3D asset not configured
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-slate-500">
              The registry entry remains available without fabricating anatomy.
            </div>
          </div>
        </div>
      ) : null}
      {hasFinding && markerType === "organ_level" ? (
        <div className="pointer-events-none absolute right-3 top-3 max-w-60 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-[10px] text-amber-100 backdrop-blur-md">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
          Organ-level finding
        </div>
      ) : null}
      {hasFinding && markerType === "localized" ? (
        <div className="pointer-events-none absolute left-[58%] top-[44%]">
          <div className="absolute -inset-3 animate-ping rounded-full border border-rose-400/45" />
          <div className="h-3 w-3 rounded-full border-2 border-white bg-rose-400 shadow-[0_0_18px_#fb7185]" />
        </div>
      ) : null}
    </div>
  )
}
