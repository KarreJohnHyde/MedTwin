import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import type { TwinDefinition } from "../lib/twins"

interface TwinViewportProps {
  twin: TwinDefinition
  active: boolean
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((material) => material.dispose())
  })
}

export default function TwinViewport({ twin, active }: TwinViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    let frame = 0
    let model: THREE.Object3D | undefined
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.autoRotate = active
    controls.autoRotateSpeed = 0.6

    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x020617, 2.3))
    const key = new THREE.DirectionalLight(0xffffff, 3)
    key.position.set(4, 5, 5)
    scene.add(key)
    const rim = new THREE.PointLight(new THREE.Color(twin.accent), 18, 12)
    rim.position.set(-3, 1, -2)
    scene.add(rim)

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect()
      if (!width || !height) return
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(mount)
    resize()

    const loader = new GLTFLoader()
    const draco = new DRACOLoader()
    draco.setDecoderPath("/draco/gltf/")
    loader.setDRACOLoader(draco)
    setStatus("loading")
    loader.load(twin.asset, (gltf) => {
      if (disposed) {
        disposeObject(gltf.scene)
        return
      }
      model = gltf.scene
      model.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return
        const mesh = child as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        if (twin.renderMode === "xray") {
          materials.forEach((material) => {
            material.transparent = true
            material.opacity = 0.35
            material.depthWrite = false
          })
        } else {
          materials.forEach((material) => {
            const mat = material as THREE.MeshStandardMaterial
            if (mat.isMeshStandardMaterial) {
              mat.roughness = Math.max(0.4, mat.roughness ?? 0.5)
              mat.metalness = Math.min(0.2, mat.metalness ?? 0.1)
            }
          })
        }
      })
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      const scale = 3.4 / Math.max(size.x, size.y, size.z)
      model.scale.setScalar(scale)
      model.position.copy(center.multiplyScalar(-scale))
      scene.add(model)
      camera.position.set(0, 0.2, 5)
      controls.target.set(0, 0, 0)
      controls.update()
      setStatus("ready")
    }, undefined, () => setStatus("error"))

    const animate = () => {
      frame = requestAnimationFrame(animate)
      controls.autoRotate = active
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      if (model) disposeObject(model)
      draco.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [twin, active])

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_40%,rgba(30,41,59,.85),rgba(2,6,23,.15)_60%)]">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between text-[10px] font-mono tracking-[0.16em]">
        <span className="rounded bg-slate-950/70 px-2 py-1 text-slate-300">{twin.source}</span>
        <span className={status === "error" ? "text-rose-300" : "text-emerald-300"}>{status === "loading" ? "LOADING" : status === "ready" ? "READY" : "ASSET ERROR"}</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-mono text-slate-400">Drag to rotate · Scroll to zoom</div>
    </div>
  )
}
