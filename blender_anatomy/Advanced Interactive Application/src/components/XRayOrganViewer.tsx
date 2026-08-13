import { useEffect, useRef } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js"
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
  viewMode?: "interior" | "exterior"
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

const anatomyPaths: Record<string, { exterior: string[]; interior: string[] }> = {
  heart: {
    exterior: ["M78 40 C112 8 160 22 164 82 C170 140 114 172 96 190 C78 166 28 140 32 84 C34 40 58 24 78 40", "M86 34 C84 18 98 10 116 14 C132 18 140 34 136 54"],
    interior: ["M96 42 L96 174", "M62 88 C84 72 110 72 132 88", "M70 122 C88 108 108 108 126 122", "M56 62 C70 94 64 128 48 154"],
  },
  brain: {
    exterior: ["M44 106 C20 86 28 48 62 34 C84 4 136 22 146 54 C178 62 180 116 148 132 C124 154 72 148 44 106"],
    interior: ["M58 94 C80 74 112 72 138 92", "M78 112 C88 96 110 96 120 112 C110 126 88 126 78 112", "M95 60 C110 76 118 92 116 112", "M48 74 C72 78 92 84 116 104"],
  },
  lungs: {
    exterior: ["M88 54 C52 38 28 72 34 132 C40 180 74 178 92 140", "M108 54 C144 38 168 72 162 132 C156 180 122 178 104 140"],
    interior: ["M98 24 L98 78", "M98 78 C78 88 62 104 52 132", "M98 78 C118 88 134 104 144 132", "M72 110 L50 96 M72 110 L52 124 M124 110 L146 96 M124 110 L144 124"],
  },
  kidneys: {
    exterior: ["M76 42 C42 46 34 98 56 136 C76 170 116 152 106 112 C94 82 112 48 76 42", "M126 42 C160 46 168 98 146 136 C126 170 86 152 96 112 C108 82 90 48 126 42"],
    interior: ["M72 70 C60 94 64 120 82 140", "M130 70 C142 94 138 120 120 140", "M102 84 C86 100 86 122 102 138 C118 122 118 100 102 84", "M102 138 L102 184"],
  },
  liver: {
    exterior: ["M30 86 C58 42 142 48 174 76 C166 124 118 152 54 136 C32 128 20 108 30 86"],
    interior: ["M64 96 C92 76 122 76 150 94", "M78 118 C106 96 130 106 146 130", "M58 76 C78 96 84 118 80 140", "M116 74 C108 104 106 130 116 146"],
  },
  pancreas: {
    exterior: ["M34 112 C56 72 98 86 124 94 C152 102 168 90 176 112 C154 136 112 134 80 128 C58 124 42 130 34 112"],
    interior: ["M54 112 C84 104 112 108 150 116", "M78 96 L84 126 M104 98 L108 130 M132 100 L136 126", "M48 122 C74 142 122 142 160 124"],
  },
  intestine: {
    exterior: ["M56 54 C30 80 42 130 82 126 C120 122 116 72 84 82 C54 92 68 150 118 150 C162 150 174 92 132 62"],
    interior: ["M52 82 C78 68 104 98 82 116 C58 134 96 158 130 132", "M66 92 L82 104 L66 116 M100 96 L116 108 L100 120", "M54 146 C84 164 126 164 154 142"],
  },
  skeleton: {
    exterior: ["M98 24 L98 174", "M54 74 L142 74", "M78 174 L66 212 M118 174 L130 212", "M76 106 L52 154 M120 106 L144 154"],
    interior: ["M76 70 L120 70 M82 92 L114 92 M78 114 L120 114", "M88 136 C104 126 118 138 106 154 C94 170 78 154 88 136", "M70 184 L126 184"],
  },
}

function AnatomySvg({
  organ,
  viewMode,
  accent,
}: {
  organ: OrganId
  viewMode: "interior" | "exterior"
  accent: string
}) {
  const paths = anatomyPaths[organ] ?? anatomyPaths.heart
  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-70 mix-blend-screen"
      viewBox="0 0 200 220"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`core-${organ}`} cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor={accent} stopOpacity="0.2" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="108" rx="78" ry="86" fill={`url(#core-${organ})`} />
      {paths.exterior.map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          stroke={accent}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          opacity={viewMode === "exterior" ? 0.82 : 0.28}
        />
      ))}
      {paths.interior.map((path) => (
        <path
          key={path}
          d={path}
          fill="none"
          stroke={viewMode === "interior" ? "#f8fafc" : accent}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={viewMode === "interior" ? "2" : "1.1"}
          opacity={viewMode === "interior" ? 0.82 : 0.2}
        />
      ))}
    </svg>
  )
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
  viewMode = "exterior",
}: XRayOrganViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelMountRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<THREE.Object3D | null>(null)
  const baseScaleRef = useRef(1)
  const riskRef = useRef(riskIndex)
  const heartRateRef = useRef(heartRate)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const labelRendererRef = useRef<CSS2DRenderer | null>(null)
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
    
    // We will apply clipping globally or locally to materials.
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.localClippingEnabled = true // Enable clipping planes
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

    const labelRenderer = new CSS2DRenderer()
    if (labelMountRef.current) {
      labelMountRef.current.appendChild(labelRenderer.domElement)
    }

    sceneRef.current = scene
    rendererRef.current = renderer
    labelRendererRef.current = labelRenderer
    cameraRef.current = camera
    controlsRef.current = controls

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      if (width === 0 || height === 0) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      labelRenderer.setSize(width, height)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    // Add CSS2DRenderer initialization later if we want floating DOM elements.

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
      labelRenderer.render(scene, camera)
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
      if (labelMountRef.current && labelRenderer.domElement.parentNode === labelMountRef.current) {
        labelMountRef.current.removeChild(labelRenderer.domElement)
      }
      sceneRef.current = null
      rendererRef.current = null
      labelRendererRef.current = null
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
        
        // Define a clipping plane that cuts halfway through the X-axis (sagittal plane)
        // or Z-axis depending on the organ. Let's use Z-axis (coronal plane) to show interior.
        const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.1)

        model.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return
          const source = Array.isArray(child.material)
            ? child.material[0]
            : child.material
          const material = new THREE.MeshPhysicalMaterial({
            color: source instanceof THREE.MeshStandardMaterial ? source.color : new THREE.Color(accent),
            map: source instanceof THREE.MeshStandardMaterial ? source.map : null,
            roughness: 0.5,
            metalness: 0.1,
            clearcoat: 0.2,
            clippingPlanes: [clipPlane], // Add clipping plane
            side: THREE.DoubleSide // Important so interior walls render
          })
          const previous = child.material
          child.material = material
          const previousMaterials = Array.isArray(previous) ? previous : [previous]
          previousMaterials.forEach((item) => item.dispose())
          
          // Store clip plane on the mesh userdata for toggling
          child.userData.clipPlane = clipPlane
        })
        scene.add(model)
        modelRef.current = model

        // Add anatomy labels from the registry anchors.
        ORGAN_REGISTRY[organ].anchors.forEach((anchor) => {
          const div = document.createElement("div")
          div.className = "flex items-center gap-2 rounded-full border border-cyan-400/30 bg-[#07101e]/80 px-2 py-1 backdrop-blur-md transition-opacity duration-500"
          div.innerHTML = `
            <div class="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></div>
            <div class="text-[9px] font-mono text-cyan-100 uppercase tracking-wider">${anchor.name}</div>
          `
          const label = new CSS2DObject(div)
          label.position.set(
            anchor.position[0],
            anchor.position[1],
            anchor.position[2],
          )
          model.add(label)
        })

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
    // Toggle clipping plane based on viewMode
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.clipPlane) {
          const plane = child.userData.clipPlane as THREE.Plane
          // To show exterior, move plane completely out of bounds. To show interior, bring to 0.
          plane.constant = viewMode === "interior" ? 0 : 100
        }
      })
    }
  }, [viewMode])

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
      <AnatomySvg organ={organ} viewMode={viewMode} accent={accent} />
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
              SVG anatomy remains active while a GLB asset is added.
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
      
      {/* 3D Labeling Layer (HTML Overlays) */}
      <div 
        ref={labelMountRef} 
        className="pointer-events-none absolute inset-0 overflow-hidden" 
      />
    </div>
  )
}
