"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export const ORGAN_REGISTRY = {
  brain: { glb: "Brain.glb", service: "neuro" },
  heart: { glb: "Heart_anotomy.glb", service: "cardio" },
  lungs: { glb: "lungs_-_normal_study.glb", service: "pulmonary" }
};

interface XRayOrganViewerProps {
  organ: keyof typeof ORGAN_REGISTRY;
  forecastDay: number;
  forecastSpread?: number;
  forecastSeverity?: number;
  tracking: boolean;
  visionFinding: string;
  annotationMode: boolean;
  heartRate?: number;
  riskIndex?: number;
  fusionConfidence?: number;
}

export default function XRayOrganViewer({
  organ,
  forecastDay,
  forecastSpread = 1.0,
  forecastSeverity = 0.0,
  tracking,
  visionFinding,
  annotationMode,
  heartRate = 72,
  riskIndex = 0,
  fusionConfidence = 0
}: XRayOrganViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const anatomyRef = useRef<THREE.Group | THREE.Object3D | null>(null);
  const detectionRef = useRef<THREE.Group | null>(null);
  const detectionRingRef = useRef<THREE.Mesh | null>(null);
  const localizedGlowRef = useRef<THREE.PointLight | null>(null);
  const floatingLabelRef = useRef<HTMLDivElement>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);

  const baseScaleRef = useRef<number>(1);
  const requestRef = useRef<number>(0);

  const [annotations, setAnnotations] = useState<THREE.Vector3[]>([]);

  const modelFile = ORGAN_REGISTRY[organ]?.glb;

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.01, 100);
    cameraRef.current = camera;
    camera.position.set(2, 1, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 2;
    controls.maxDistance = 9;
    controlsRef.current = controls;

    // Lights
    scene.add(new THREE.HemisphereLight(0xc4e4ff, 0x08101e, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4,5,5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 2.1);
    rim.position.set(-5,2,-4);
    scene.add(rim);
    const fill = new THREE.PointLight(0x14b8a6, 8, 12);
    fill.position.set(0,-1,3);
    scene.add(fill);

    // Detection Rings
    const detectionGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.08, 0.1, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    detectionGroup.add(ring);

    // Localized Glow (Point Light)
    const glow = new THREE.PointLight(0xf43f5e, 0, 0.5);
    detectionGroup.add(glow);
    localizedGlowRef.current = glow;

    scene.add(detectionGroup);
    detectionRingRef.current = ring;
    detectionRef.current = detectionGroup;

    // Label Element
    const label = document.createElement('div');
    label.className = 'absolute bg-slate-900/90 text-teal-300 text-[10px] px-2 py-1 rounded border border-teal-700/50 pointer-events-none opacity-0 transition-opacity z-50';
    label.style.transform = 'translate(-50%, -100%)';
    label.style.top = '0';
    label.style.left = '0';
    containerRef.current.appendChild(label);
    floatingLabelRef.current = label;

    // Handle Resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    const container = containerRef.current;
    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (rendererRef.current && container) {
        rendererRef.current.forceContextLoss();
        rendererRef.current.dispose();
        if (container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
      if (floatingLabelRef.current && container) {
        if (container.contains(floatingLabelRef.current)) {
          container.removeChild(floatingLabelRef.current);
        }
      }
    };
  }, []);

  // Handle Model Loading
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !modelFile) return;

    let active = true;
    materialsRef.current = [];

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/gltf/');
    loader.setDRACOLoader(draco);

    loader.load(`/assets/${modelFile}`, (gltf) => {
      if (!active) return;

      const anatomy = gltf.scene;

      anatomy.traverse(child => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        mesh.castShadow = mesh.receiveShadow = true;
        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();
          if (mesh.geometry.attributes.uv) mesh.geometry.computeTangents();
        }
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(material => {
          if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
            material.metalness = Math.min(material.metalness || 0, .18);
            material.roughness = Math.max(material.roughness || .45, .38);
            if (!material.userData.originalEmissive) {
              material.userData.originalEmissive = material.emissive.clone();
            }
            materialsRef.current.push(material);
            material.needsUpdate = true;
          }
        });
      });

      const box = new THREE.Box3().setFromObject(anatomy);
      anatomy.position.sub(box.getCenter(new THREE.Vector3()));

      const normalized = new THREE.Box3().setFromObject(anatomy);
      const sizeVec = normalized.getSize(new THREE.Vector3());
      baseScaleRef.current = 3.9 / Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
      anatomy.scale.setScalar(baseScaleRef.current);

      scene.add(anatomy);
      anatomyRef.current = anatomy;

      const finalBox = new THREE.Box3().setFromObject(anatomy);
      const center = finalBox.getCenter(new THREE.Vector3());
      const sizeLen = finalBox.getSize(new THREE.Vector3()).length();

      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.copy(center).add(new THREE.Vector3(sizeLen * 0.62, sizeLen * 0.18, sizeLen * 1.05));
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }

      if (detectionRef.current && detectionRingRef.current) {
        anatomy.add(detectionRef.current);
        const detBox = new THREE.Box3().setFromObject(anatomy);
        const c = detBox.getCenter(new THREE.Vector3());
        const s = detBox.getSize(new THREE.Vector3());

        const rayOrigin = new THREE.Vector3(c.x + s.x * 0.13, c.y + s.y * 0.08, c.z + s.z);
        const rayDir = new THREE.Vector3(0, 0, -1);
        const raycaster = new THREE.Raycaster(rayOrigin, rayDir);
        const hits = raycaster.intersectObject(anatomy, true);

        let worldPos = c.clone().add(new THREE.Vector3(s.x*.13, s.y*.08, s.z*.5));
        if (hits.length > 0) {
          worldPos = hits[0].point;
        }

        detectionRef.current.position.copy(anatomy.worldToLocal(worldPos));
        detectionRingRef.current.position.set(0, 0, 0);
      }
    });

    return () => {
      active = false;
      if (anatomyRef.current) {
        scene.remove(anatomyRef.current);
        anatomyRef.current.traverse(o => {
          if ((o as THREE.Mesh).isMesh) {
            const mesh = o as THREE.Mesh;
            mesh.geometry?.dispose();
            if(Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
            else mesh.material?.dispose();
          }
        });
        anatomyRef.current = null;
      }
    };
  }, [modelFile]);

  // Handle Animation Loop
  useEffect(() => {
    const animate = (t) => {
      requestRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();

      if (anatomyRef.current) {
        if (organ === 'heart' && heartRate > 0) {
          const bps = heartRate / 60;
          const pulseIntensity = 0.05 * (1 + riskIndex / 100);
          const pulse = 1 + Math.sin(t * bps * Math.PI * 0.002) * pulseIntensity;
          anatomyRef.current.scale.setScalar(baseScaleRef.current * pulse);
        } else {
          anatomyRef.current.scale.setScalar(baseScaleRef.current);
        }

        // Apply global emissive tint based on riskIndex and fusionConfidence
        materialsRef.current.forEach(mat => {
          if (mat.userData.originalEmissive) {
            // Base redness based on risk index, modulated by confidence
            const riskFactor = (riskIndex / 100) * fusionConfidence;
            const targetEmissive = mat.userData.originalEmissive.clone();
            const glowColor = new THREE.Color(0xff2222).multiplyScalar(riskFactor * 0.8);
            targetEmissive.add(glowColor);

            // Smoothly lerp towards target for smooth transitions
            mat.emissive.lerp(targetEmissive, 0.05);
          }
        });
      }

      const hasFinding = visionFinding && !/^(No finding|No tumor-positive image pattern|normal)$/i.test(visionFinding);
      const showDetection = tracking && hasFinding;

      if (detectionRef.current && detectionRingRef.current) {
        detectionRef.current.visible = showDetection;
        detectionRingRef.current.visible = showDetection;

        if (showDetection) {
          detectionRingRef.current.rotation.z = t * 0.002;

          const baseRingScale = 1 + Math.sin(t * 0.006) * 0.16;
          detectionRingRef.current.scale.setScalar(baseRingScale * forecastSpread);

          if (localizedGlowRef.current) {
            localizedGlowRef.current.intensity = forecastSeverity * 15 * (1 + Math.sin(t * 0.004) * 0.2);
            localizedGlowRef.current.distance = 0.5 * forecastSpread;
          }

          if (floatingLabelRef.current && cameraRef.current) {
            const vector = new THREE.Vector3();
            detectionRef.current.getWorldPosition(vector);
            vector.project(cameraRef.current);
            const rect = containerRef.current.getBoundingClientRect();
            const x = (vector.x * .5 + .5) * rect.width;
            const y = (-(vector.y * .5) + .5) * rect.height;
            floatingLabelRef.current.style.left = `${x}px`;
            floatingLabelRef.current.style.top = `${y - 15}px`;
            floatingLabelRef.current.style.opacity = '1';
            floatingLabelRef.current.textContent = visionFinding;
          }
        } else {
          if (floatingLabelRef.current) floatingLabelRef.current.style.opacity = '0';
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [forecastDay, tracking, visionFinding, organ, heartRate, riskIndex, fusionConfidence, forecastSpread, forecastSeverity]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full z-0 pointer-events-auto"
      style={{ cursor: annotationMode ? 'crosshair' : 'grab' }}
    />
  );
}
