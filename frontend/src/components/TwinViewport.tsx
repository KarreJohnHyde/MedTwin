import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import type { FusionResult } from "../lib/inferenceClient"
import type { AnatomyDefinition, ViewMode } from "../lib/twins"
import type { VolumeData } from "../lib/volumeLoader"

export interface AnatomyLayers {
  anatomy: boolean
  vascular: boolean
  nervous: boolean
  skeletal: boolean
  roi: boolean
  forecast: boolean
}

export type CameraPreset = "anterior" | "posterior" | "lateral" | "superior"

interface TwinViewportProps {
  anatomy: AnatomyDefinition
  mode: ViewMode
  layers: AnatomyLayers
  fusion: FusionResult
  threshold: number
  forecastDay: number
  cameraPreset: CameraPreset
  cameraReset: number
  volume: VolumeData | null
  volumeSlice: number
  volumeThreshold: number
  volumeOpacity: number
}

const CENTER_BY_ANATOMY: Record<AnatomyDefinition["id"], THREE.Vector3> = {
  heart: new THREE.Vector3(0, 0.45, 0.18),
  brain: new THREE.Vector3(0, 2.05, 0),
  nervous: new THREE.Vector3(0, 0.5, 0),
  skeletal: new THREE.Vector3(0, 0.45, 0),
  lungs: new THREE.Vector3(0, 0.65, 0),
  renal: new THREE.Vector3(0, -0.25, 0),
  digestive: new THREE.Vector3(0, -0.45, 0.08),
}

const ASSET_BY_ANATOMY: Partial<Record<AnatomyDefinition["id"], string>> = {
  heart: "/anatomy-optimized/Heart-539fd5452404.glb",
  brain: "/anatomy-optimized/Brain-c133184adfc1.glb",
  lungs: "/anatomy-optimized/lungs_-_normal_study-4e328b98ac8e.glb",
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (
      !(child instanceof THREE.Mesh) &&
      !(child instanceof THREE.Line) &&
      !(child instanceof THREE.Points)
    )
      return
    child.geometry.dispose()
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    materials.forEach((material) => {
      const mapped = material as THREE.Material & { map?: THREE.Texture }
      mapped.map?.dispose()
      material.dispose()
    })
  })
}

function materialFor(color: string, mode: ViewMode, opacity = 1) {
  const xray = mode === "xray"
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: mode === "exterior" ? 0.47 : 0.62,
    metalness: mode === "mesh" ? 0.08 : 0.02,
    transparent: xray || opacity < 1,
    opacity: xray ? Math.min(opacity, 0.22) : opacity,
    depthWrite: !xray,
    wireframe: mode === "mesh",
    side: THREE.DoubleSide,
    emissive: new THREE.Color(color),
    emissiveIntensity: xray ? 0.22 : 0.02,
    clippingPlanes:
      mode === "interior"
        ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.04)]
        : [],
  })
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const item = new THREE.Mesh(geometry, material)
  item.position.set(...position)
  item.scale.set(...scale)
  item.rotation.set(...rotation)
  parent.add(item)
  return item
}

function boneBetween(
  parent: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const direction = new THREE.Vector3().subVectors(to, from)
  const length = direction.length()
  const item = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    material,
  )
  item.position.copy(from).add(to).multiplyScalar(0.5)
  item.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  )
  parent.add(item)
  return item
}

function addSkeleton(parent: THREE.Object3D, mode: ViewMode, strong = false) {
  const group = new THREE.Group()
  const material = materialFor(
    strong ? "#f1e8d2" : "#8f9a9e",
    mode,
    strong ? 0.92 : 0.22,
  )
  mesh(
    group,
    new THREE.SphereGeometry(0.34, 20, 16),
    material,
    [0, 2.35, 0],
    [0.85, 1, 0.82],
  )
  boneBetween(
    group,
    new THREE.Vector3(0, 2.0, 0),
    new THREE.Vector3(0, -1.2, 0),
    0.055,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(-0.62, 1.55, 0),
    new THREE.Vector3(0.62, 1.55, 0),
    0.045,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(-0.57, 1.5, 0),
    new THREE.Vector3(-1.02, 0.55, 0.03),
    0.055,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(0.57, 1.5, 0),
    new THREE.Vector3(1.02, 0.55, 0.03),
    0.055,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(-1.02, 0.55, 0.03),
    new THREE.Vector3(-1.06, -0.35, 0.05),
    0.045,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(1.02, 0.55, 0.03),
    new THREE.Vector3(1.06, -0.35, 0.05),
    0.045,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(-0.22, -0.95, 0),
    new THREE.Vector3(-0.4, -2.15, 0.02),
    0.075,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(0.22, -0.95, 0),
    new THREE.Vector3(0.4, -2.15, 0.02),
    0.075,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(-0.4, -2.15, 0.02),
    new THREE.Vector3(-0.42, -3.05, 0.08),
    0.055,
    material,
  )
  boneBetween(
    group,
    new THREE.Vector3(0.4, -2.15, 0.02),
    new THREE.Vector3(0.42, -3.05, 0.08),
    0.055,
    material,
  )
  for (let index = 0; index < 7; index += 1) {
    mesh(
      group,
      new THREE.TorusGeometry(
        0.46 + index * 0.035,
        0.026,
        7,
        34,
        Math.PI * 1.65,
      ),
      material,
      [0, 1.34 - index * 0.2, -0.01],
      [1, 0.72, 1],
      [Math.PI / 2, 0, -Math.PI * 0.325],
    )
  }
  mesh(
    group,
    new THREE.TorusGeometry(0.38, 0.06, 10, 34, Math.PI),
    material,
    [0, -0.85, 0],
    [1.35, 0.82, 1],
    [Math.PI / 2, 0, 0],
  )
  parent.add(group)
}

function addNervousSystem(
  parent: THREE.Object3D,
  color: string,
  strong = false,
) {
  const group = new THREE.Group()
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: !strong,
    opacity: strong ? 0.88 : 0.3,
  })
  const points: number[] = []
  const addPath = (path: THREE.Vector3[]) => {
    for (let index = 0; index < path.length - 1; index += 1) {
      points.push(...path[index].toArray(), ...path[index + 1].toArray())
    }
  }
  addPath([
    new THREE.Vector3(0, 2.3, 0.05),
    new THREE.Vector3(0, 1.1, 0.04),
    new THREE.Vector3(0, -1.25, 0.02),
  ])
  for (let side of [-1, 1]) {
    addPath([
      new THREE.Vector3(0, 1.5, 0),
      new THREE.Vector3(0.58 * side, 1.15, 0.02),
      new THREE.Vector3(1.08 * side, 0.3, 0.05),
      new THREE.Vector3(1.12 * side, -0.36, 0.08),
    ])
    addPath([
      new THREE.Vector3(0, -0.6, 0),
      new THREE.Vector3(0.3 * side, -1.25, 0.03),
      new THREE.Vector3(0.46 * side, -2.15, 0.07),
      new THREE.Vector3(0.45 * side, -3.08, 0.1),
    ])
    for (let index = 0; index < 7; index += 1) {
      addPath([
        new THREE.Vector3(0, 1.25 - index * 0.28, 0),
        new THREE.Vector3(
          (0.42 + index * 0.035) * side,
          1.12 - index * 0.28,
          0.1,
        ),
      ])
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3))
  group.add(new THREE.LineSegments(geometry, material))
  mesh(
    group,
    new THREE.SphereGeometry(0.35, 22, 18),
    materialFor(color, "mesh", strong ? 0.48 : 0.18),
    [0, 2.25, 0],
  )
  parent.add(group)
}

function addVascular(parent: THREE.Object3D, strong = false) {
  const red = materialFor("#ff5f70", "exterior", strong ? 0.9 : 0.28)
  const cyan = materialFor("#4cc9db", "exterior", strong ? 0.82 : 0.25)
  boneBetween(
    parent,
    new THREE.Vector3(0.08, 0.72, 0.12),
    new THREE.Vector3(0.05, 1.88, 0.02),
    0.035,
    red,
  )
  boneBetween(
    parent,
    new THREE.Vector3(-0.1, 0.55, 0.08),
    new THREE.Vector3(-0.72, -0.8, 0.04),
    0.025,
    cyan,
  )
  boneBetween(
    parent,
    new THREE.Vector3(0.1, 0.55, 0.08),
    new THREE.Vector3(0.72, -0.8, 0.04),
    0.025,
    red,
  )
  for (let side of [-1, 1]) {
    boneBetween(
      parent,
      new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(0.85 * side, 0.75, 0.02),
      0.018,
      side < 0 ? cyan : red,
    )
    boneBetween(
      parent,
      new THREE.Vector3(0, -0.4, 0),
      new THREE.Vector3(0.36 * side, -2.72, 0.04),
      0.018,
      side < 0 ? cyan : red,
    )
  }
}

function addPrimaryAnatomy(
  parent: THREE.Object3D,
  anatomy: AnatomyDefinition,
  mode: ViewMode,
) {
  const material = materialFor(anatomy.color, mode, 0.9)
  const secondary = materialFor(anatomy.secondaryColor, mode, 0.82)
  if (anatomy.id === "heart") {
    mesh(
      parent,
      new THREE.SphereGeometry(0.58, 34, 28),
      material,
      [-0.18, 0.42, 0.08],
      [0.72, 1.04, 0.75],
      [0, 0, 0.16],
    )
    mesh(
      parent,
      new THREE.SphereGeometry(0.62, 34, 28),
      material,
      [0.18, 0.38, 0.08],
      [0.78, 1.12, 0.8],
      [0, 0, -0.14],
    )
    mesh(
      parent,
      new THREE.ConeGeometry(0.56, 1.15, 34),
      material,
      [0, -0.1, 0.08],
      [1, 1, 0.9],
      [0, 0, Math.PI],
    )
    boneBetween(
      parent,
      new THREE.Vector3(0.08, 0.86, 0),
      new THREE.Vector3(0.18, 1.55, -0.02),
      0.12,
      secondary,
    )
  } else if (anatomy.id === "brain") {
    mesh(
      parent,
      new THREE.SphereGeometry(0.72, 40, 30),
      material,
      [-0.35, 2.08, 0],
      [0.9, 0.78, 1.03],
    )
    mesh(
      parent,
      new THREE.SphereGeometry(0.72, 40, 30),
      material,
      [0.35, 2.08, 0],
      [0.9, 0.78, 1.03],
    )
    for (let index = 0; index < 5; index += 1) {
      mesh(
        parent,
        new THREE.TorusGeometry(0.48 + index * 0.035, 0.025, 7, 42),
        secondary,
        [0, 2.08 + (index - 2) * 0.16, 0.58],
        [1.25, 0.58, 1],
        [0, 0, Math.PI / 2],
      )
    }
  } else if (anatomy.id === "nervous") {
    addNervousSystem(parent, anatomy.color, true)
  } else if (anatomy.id === "skeletal") {
    addSkeleton(parent, mode, true)
  } else if (anatomy.id === "lungs") {
    mesh(
      parent,
      new THREE.SphereGeometry(0.68, 34, 28),
      material,
      [-0.48, 0.62, 0],
      [0.78, 1.42, 0.72],
    )
    mesh(
      parent,
      new THREE.SphereGeometry(0.68, 34, 28),
      material,
      [0.48, 0.62, 0],
      [0.78, 1.42, 0.72],
    )
    boneBetween(
      parent,
      new THREE.Vector3(0, 2.02, 0),
      new THREE.Vector3(0, 1.25, 0),
      0.085,
      secondary,
    )
    boneBetween(
      parent,
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(-0.4, 0.9, 0),
      0.055,
      secondary,
    )
    boneBetween(
      parent,
      new THREE.Vector3(0, 1.3, 0),
      new THREE.Vector3(0.4, 0.9, 0),
      0.055,
      secondary,
    )
  } else if (anatomy.id === "renal") {
    mesh(
      parent,
      new THREE.SphereGeometry(0.5, 32, 24),
      material,
      [-0.58, -0.2, 0],
      [0.72, 1.05, 0.6],
      [0, 0, -0.18],
    )
    mesh(
      parent,
      new THREE.SphereGeometry(0.5, 32, 24),
      material,
      [0.58, -0.2, 0],
      [0.72, 1.05, 0.6],
      [0, 0, 0.18],
    )
    boneBetween(
      parent,
      new THREE.Vector3(-0.48, -0.55, 0),
      new THREE.Vector3(-0.16, -1.55, 0),
      0.035,
      secondary,
    )
    boneBetween(
      parent,
      new THREE.Vector3(0.48, -0.55, 0),
      new THREE.Vector3(0.16, -1.55, 0),
      0.035,
      secondary,
    )
  } else {
    mesh(
      parent,
      new THREE.SphereGeometry(0.62, 32, 24),
      material,
      [-0.28, 0.12, 0.04],
      [1.05, 0.62, 0.7],
      [0, 0, -0.35],
    )
    for (let index = 0; index < 6; index += 1) {
      mesh(
        parent,
        new THREE.TorusGeometry(
          0.48 - index * 0.035,
          0.085,
          9,
          36,
          Math.PI * 1.75,
        ),
        secondary,
        [0.05, -0.34 - index * 0.18, 0],
        [1.15, 0.58, 1],
        [Math.PI / 2, 0, index % 2 ? 0.4 : -0.4],
      )
    }
  }
}

function markerPosition(
  anatomy: AnatomyDefinition,
  coordinate: [number, number, number],
) {
  const center = CENTER_BY_ANATOMY[anatomy.id]
  const span =
    anatomy.id === "skeletal" || anatomy.id === "nervous" ? 2.3 : 1.35
  return new THREE.Vector3(
    center.x + coordinate[0] * span,
    center.y + coordinate[1] * span,
    center.z + coordinate[2] * span,
  )
}

function addVolumeOverlay(
  parent: THREE.Object3D,
  volume: VolumeData,
  sliceIndex: number,
  threshold: number,
  opacity: number,
) {
  const [width, height, depth] = volume.dimensions
  const center = new THREE.Vector3(0, 0.25, 0)
  const longest = Math.max(width, height, depth)
  const scale = 3.8 / longest
  const eligible: number[] = []
  for (let index = 0; index < volume.values.length; index += 1) {
    if (volume.values[index] >= threshold) eligible.push(index)
  }
  const stride = Math.max(1, Math.ceil(eligible.length / 6_000))
  const positions: number[] = []
  const colors: number[] = []
  const cold = new THREE.Color("#56d5df")
  const hot = new THREE.Color("#ff9f62")
  for (let index = 0; index < eligible.length; index += stride) {
    const source = eligible[index]
    const z = Math.floor(source / (width * height))
    const rowOffset = source - z * width * height
    const y = Math.floor(rowOffset / width)
    const x = rowOffset % width
    positions.push(
      center.x + (x - width / 2) * scale,
      center.y + (height / 2 - y) * scale,
      center.z + (z - depth / 2) * scale,
    )
    const color = cold.clone().lerp(hot, volume.values[source])
    colors.push(color.r, color.g, color.b)
  }
  if (positions.length) {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    )
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
    parent.add(
      new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: Math.max(0.025, scale * 0.8),
          vertexColors: true,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      ),
    )
  }

  const activeSlice = Math.max(0, Math.min(depth - 1, sliceIndex))
  const pixels = new Uint8Array(width * height * 4)
  const sliceOffset = activeSlice * width * height
  for (let index = 0; index < width * height; index += 1) {
    const value = volume.values[sliceOffset + index]
    const target = index * 4
    pixels[target] = value >= threshold ? 255 : Math.round(value * 90)
    pixels[target + 1] = value >= threshold ? 156 : Math.round(value * 120)
    pixels[target + 2] = value >= threshold ? 82 : Math.round(value * 135)
    pixels[target + 3] = Math.round((value >= threshold ? opacity : opacity * 0.28) * 255)
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  const plane = mesh(
    parent,
    new THREE.PlaneGeometry(width * scale, height * scale),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
    [center.x, center.y, center.z + (activeSlice - depth / 2) * scale],
  )
  plane.renderOrder = 2
  const bounds = new THREE.Box3Helper(
    new THREE.Box3(
      new THREE.Vector3(
        center.x - (width * scale) / 2,
        center.y - (height * scale) / 2,
        center.z - (depth * scale) / 2,
      ),
      new THREE.Vector3(
        center.x + (width * scale) / 2,
        center.y + (height * scale) / 2,
        center.z + (depth * scale) / 2,
      ),
    ),
    new THREE.Color("#67dce5"),
  )
  parent.add(bounds)
}

function cameraPosition(preset: CameraPreset) {
  if (preset === "posterior") return new THREE.Vector3(0, 0.25, -7.2)
  if (preset === "lateral") return new THREE.Vector3(7.2, 0.25, 0)
  if (preset === "superior") return new THREE.Vector3(0, 7.2, 0.01)
  return new THREE.Vector3(0, 0.25, 7.2)
}

export default function TwinViewport({
  anatomy,
  mode,
  layers,
  fusion,
  threshold,
  forecastDay,
  cameraPreset,
  cameraReset,
  volume,
  volumeSlice,
  volumeThreshold,
  volumeOpacity,
}: TwinViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let frame = 0
    let disposed = false
    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#080c0d")
    scene.fog = new THREE.FogExp2("#080c0d", 0.05)
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100)
    camera.position.copy(cameraPosition(cameraPreset))
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: import.meta.env.VITE_VISUAL_QA === "1",
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.localClippingEnabled = true
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.enablePan = true
    controls.minDistance = 2.8
    controls.maxDistance = 13
    controls.target.set(0, 0.25, 0)
    controls.update()

    scene.add(new THREE.HemisphereLight(0xd9fcff, 0x14130f, 2.15))
    const key = new THREE.DirectionalLight(0xffffff, 3.4)
    key.position.set(3.8, 5.5, 5.5)
    scene.add(key)
    const rim = new THREE.PointLight(new THREE.Color(anatomy.color), 24, 12)
    rim.position.set(-3, 1.4, -2.2)
    scene.add(rim)
    const fill = new THREE.PointLight(
      new THREE.Color(anatomy.secondaryColor),
      12,
      10,
    )
    fill.position.set(2.5, -1, 2.5)
    scene.add(fill)

    const root = new THREE.Group()
    root.position.y =
      anatomy.id === "brain"
        ? -1.25
        : anatomy.id === "skeletal" || anatomy.id === "nervous"
          ? 0.05
          : 0
    scene.add(root)

    const grid = new THREE.GridHelper(
      14,
      42,
      new THREE.Color("#365558"),
      new THREE.Color("#182629"),
    )
    grid.position.y = -3.25
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.58
    scene.add(grid)

    const proceduralAnatomy = new THREE.Group()
    root.add(proceduralAnatomy)
    if (layers.anatomy) addPrimaryAnatomy(proceduralAnatomy, anatomy, mode)
    const assetUrl = layers.anatomy ? ASSET_BY_ANATOMY[anatomy.id] : undefined
    if (assetUrl) {
      new GLTFLoader().load(
        assetUrl,
        ({ scene: assetScene }) => {
          if (disposed) {
            disposeObject(assetScene)
            return
          }
          const bounds = new THREE.Box3().setFromObject(assetScene)
          const sourceSize = bounds.getSize(new THREE.Vector3())
          const sourceCenter = bounds.getCenter(new THREE.Vector3())
          const targetSize = anatomy.id === "lungs" ? 2.8 : 1.75
          const assetScale = targetSize / Math.max(sourceSize.x, sourceSize.y, sourceSize.z, 0.001)
          assetScene.scale.setScalar(assetScale)
          assetScene.position.copy(
            CENTER_BY_ANATOMY[anatomy.id]
              .clone()
              .sub(sourceCenter.multiplyScalar(assetScale)),
          )
          assetScene.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return
            child.castShadow = false
            child.receiveShadow = false
            const materials = Array.isArray(child.material) ? child.material : [child.material]
            materials.forEach((material) => {
              const styled = material as THREE.MeshStandardMaterial
              styled.wireframe = mode === "mesh"
              styled.transparent = mode === "xray" || styled.transparent
              if (mode === "xray") {
                styled.opacity = 0.2
                styled.depthWrite = false
              }
              styled.needsUpdate = true
            })
          })
          proceduralAnatomy.visible = false
          root.add(assetScene)
        },
        undefined,
        () => {
          proceduralAnatomy.visible = true
        },
      )
    }
    if (layers.skeletal && anatomy.id !== "skeletal")
      addSkeleton(root, mode, false)
    if (layers.nervous && anatomy.id !== "nervous")
      addNervousSystem(root, "#ffd75c", false)
    if (layers.vascular) {
      const vascularContext = new THREE.Group()
      addVascular(vascularContext, anatomy.id === "heart")
      const contextScale = anatomy.id === "lungs" ? 0.62 : 0.38
      vascularContext.scale.setScalar(contextScale)
      vascularContext.position.copy(CENTER_BY_ANATOMY[anatomy.id])
      root.add(vascularContext)
    }
    if (volume)
      addVolumeOverlay(
        root,
        volume,
        volumeSlice,
        volumeThreshold,
        volumeOpacity,
      )

    const markerMeshes: THREE.Mesh[] = []
    const pulseMaterials: THREE.MeshBasicMaterial[] = []
    if (layers.roi) {
      fusion.markers.forEach((marker, index) => {
        if (marker.probability < threshold) return
        const position = markerPosition(anatomy, marker.coordinate)
        const markerMaterial = new THREE.MeshBasicMaterial({
          color: index === 0 ? "#ffb35c" : "#f9dd74",
          transparent: true,
          opacity: 0.95,
          depthTest: false,
        })
        const point = mesh(
          root,
          new THREE.SphereGeometry(0.075, 18, 14),
          markerMaterial,
          position.toArray() as [number, number, number],
        )
        point.userData.markerId = marker.id
        markerMeshes.push(point)
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: "#ffb35c",
          transparent: true,
          opacity: 0.55,
          wireframe: true,
          depthTest: false,
        })
        const ring = mesh(
          root,
          new THREE.SphereGeometry(0.14, 14, 10),
          ringMaterial,
          position.toArray() as [number, number, number],
        )
        ring.userData.pulseIndex = index
        pulseMaterials.push(ringMaterial)
        const boxMaterial = new THREE.MeshBasicMaterial({
          color: "#ffcf70",
          transparent: true,
          opacity: 0.42,
          wireframe: true,
          depthTest: false,
        })
        mesh(
          root,
          new THREE.BoxGeometry(0.36, 0.36, 0.36),
          boxMaterial,
          position.toArray() as [number, number, number],
        )
        if (layers.forecast && index === 0) {
          const spread =
            fusion.forecast[Math.min(forecastDay, fusion.forecast.length - 1)]
              ?.spread ?? 0.2
          const spreadMaterial = new THREE.MeshBasicMaterial({
            color: "#ff6b7a",
            transparent: true,
            opacity: 0.1,
            wireframe: true,
            depthTest: false,
          })
          mesh(
            root,
            new THREE.SphereGeometry(0.18 + spread * 0.75, 24, 18),
            spreadMaterial,
            position.toArray() as [number, number, number],
          )
          pulseMaterials.push(spreadMaterial)
        }
      })
    }

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const selectMarker = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(markerMeshes, false)[0]
      setSelectedMarkerId(hit ? String(hit.object.userData.markerId) : null)
    }
    renderer.domElement.addEventListener("pointerup", selectMarker)

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

    const startedAt = performance.now()
    const animate = (time = performance.now()) => {
      frame = requestAnimationFrame(animate)
      const elapsed = (time - startedAt) / 1_000
      pulseMaterials.forEach((material, index) => {
        material.opacity = 0.18 + (Math.sin(elapsed * 2.4 + index) + 1) * 0.14
      })
      if (anatomy.id === "heart") {
        const beat = 1 + Math.max(0, Math.sin(elapsed * 5.2)) * 0.018
        root.scale.setScalar(beat)
      }
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener("pointerup", selectMarker)
      controls.dispose()
      disposeObject(root)
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [
    anatomy,
    mode,
    layers,
    fusion,
    threshold,
    forecastDay,
    cameraPreset,
    cameraReset,
    volume,
    volumeSlice,
    volumeThreshold,
    volumeOpacity,
  ])

  const selectedMarker = fusion.markers.find(
    (marker) => marker.id === selectedMarkerId,
  )

  return (
    <div
      className="twin-canvas"
      aria-label={`Interactive ${anatomy.label} model`}
    >
      <div ref={mountRef} className="twin-canvas__mount" />
      <div className="orientation-cube" aria-hidden="true">
        <span>SUP</span>
        <b>A</b>
      </div>
      <div className="canvas-scale">
        <span />
        <small>40 mm</small>
      </div>
      <div className="canvas-status">
        <i /> WEBGL LIVE <span>{mode.toUpperCase()}</span>
        {volume ? <b>VOLUME</b> : null}
      </div>
      {selectedMarker ? (
        <div className="marker-inspector">
          <button
            type="button"
            aria-label="Close marker detail"
            onClick={() => setSelectedMarkerId(null)}
          >
            x
          </button>
          <small>SPATIAL ROI</small>
          <strong>{selectedMarker.label}</strong>
          <div>
            <span>Probability</span>
            <b>{Math.round(selectedMarker.probability * 100)}%</b>
          </div>
          <div>
            <span>Confidence</span>
            <b>{Math.round(selectedMarker.confidence * 100)}%</b>
          </div>
        </div>
      ) : null}
    </div>
  )
}
