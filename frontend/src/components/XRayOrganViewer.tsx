"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { applyAdvancedShaders } from './AdvancedShaders';
import { CellularParticleSystem } from './ParticleInteractions';

export const ORGAN_REGISTRY = {
  // Cardio-Twin category
  heart: { glb: "Heart_anotomy.glb", category: "cardio", label: "Heart Anatomy", renderMode: "pbr" as const },
  heart_interior: { glb: "interior_heart.glb", category: "cardio", label: "Interior Heart", renderMode: "pbr" as const },
  heart_exterior: { glb: "exterior_heart.glb", category: "cardio", label: "Exterior Heart", renderMode: "pbr" as const },
  // Neuro-Twin category
  brain: { glb: "Brain.glb", category: "neuro", label: "Brain", renderMode: "xray" as const },
  // Pulmo-Twin category
  lungs: { glb: "Lungs.glb", category: "pulmo", label: "Lungs", renderMode: "xray" as const },
  xray_lungs: { glb: "X-ray_lungs.glb", category: "pulmo", label: "X-Ray Lungs", renderMode: "xray" as const },
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
  const particlesRef = useRef<CellularParticleSystem | null>(null);
  
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
    
    // Scanner Pointer (Cone)
    const coneGeo = new THREE.ConeGeometry(0.04, 0.15, 16);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.9, wireframe: true });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.rotation.x = Math.PI; // point downwards
    cone.position.y = 0.2; // above the ring
    detectionGroup.add(cone);

    // Localized Glow (Point Light)
    const glow = new THREE.PointLight(0xf43f5e, 0, 0.5);
    detectionGroup.add(glow);
    localizedGlowRef.current = glow;

    scene.add(detectionGroup); 
    detectionRingRef.current = ring;
    detectionRef.current = detectionGroup;
    
    // Particle System
    const particles = new CellularParticleSystem(10000, 0xf43f5e);
    scene.add(particles.getMesh());
    particlesRef.current = particles;
    
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
        const layerName = mesh.name;

        // Determine render mode from organ registry
        const organEntry = ORGAN_REGISTRY[organ];
        const renderMode = organEntry?.renderMode || 'xray';

        if (renderMode === 'pbr') {
          // PBR Mode: Preserve original Blender materials (realistic textures/colors)
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.isMeshStandardMaterial) {
            mat.roughness = Math.max(0.3, mat.roughness);
            mat.metalness = Math.min(0.1, mat.metalness);
            mat.envMapIntensity = 0.5;
            materialsRef.current.push(mat);
          }
        } else {
          // X-Ray/Holographic Mode: Apply advanced shaders
          const advancedMaterial = applyAdvancedShaders(mesh, riskIndex > 40 ? (riskIndex - 40) / 60 : 0.0);
          
          // Overwrite specific properties for glass look
          advancedMaterial.transparent = true;
          advancedMaterial.opacity = 0.85;
          advancedMaterial.depthWrite = false;
          advancedMaterial.blending = THREE.AdditiveBlending;
          
          if (layerName.includes('vein') || layerName.includes('artery')) {
              advancedMaterial.uniforms.baseColor.value.setHex(0x3b82f6); // Blue for veins
              advancedMaterial.uniforms.pulseColor.value.setHex(0x60a5fa);
          }
          mesh.material = advancedMaterial;
          materialsRef.current.push(advancedMaterial as any);
        }

        mesh.castShadow = mesh.receiveShadow = true; 
        if (mesh.geometry) { 
          mesh.geometry.computeVertexNormals(); 
          if (mesh.geometry.attributes.uv) mesh.geometry.computeTangents(); 
        } 
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
    let lastTime = performance.now();
    
    const animate = (t: number) => {
      requestRef.current = requestAnimationFrame(animate);
      
      const deltaTime = (t - lastTime) * 0.001;
      lastTime = t;
      
      if (controlsRef.current) controlsRef.current.update();
      
      // Update particles
      if (particlesRef.current) {
        // Intensity scales with risk index
        const pIntensity = 1.0 + (riskIndex / 50.0);
        particlesRef.current.update(deltaTime, pIntensity);
      }
      
      // Update advanced shader uniforms
      if (anatomyRef.current) {
        anatomyRef.current.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.uniforms) {
            child.material.uniforms.time.value = t * 0.001;
            // Sync flow speed with heart rate
            child.material.uniforms.flowSpeed.value = heartRate / 60.0;
          }
        });
      }
      
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
      
      const hasFinding = Boolean(visionFinding && !/^(No finding|No tumor-positive image pattern|normal)$/i.test(visionFinding));
      const showDetection = Boolean(tracking && hasFinding);
      
      if (detectionRef.current && detectionRingRef.current) {
        detectionRef.current.visible = showDetection;
        detectionRingRef.current.visible = showDetection;
        
        if (showDetection) {
          detectionRingRef.current.rotation.z = t * 0.002;
          
          const baseRingScale = 1 + Math.sin(t * 0.006) * 0.16;
          detectionRingRef.current.scale.setScalar(baseRingScale * forecastSpread);

          // Animate Scanner Pointer
          if (detectionRef.current.children.length > 2) {
            const pointer = detectionRef.current.children[1]; // Cone is the second child added
            pointer.position.y = 0.2 + Math.sin(t * 0.005) * 0.05;
            pointer.rotation.y = t * 0.003;
          }

          if (localizedGlowRef.current) {
            localizedGlowRef.current.intensity = forecastSeverity * 15 * (1 + Math.sin(t * 0.004) * 0.2);
            localizedGlowRef.current.distance = 0.5 * forecastSpread;
          }

          if (floatingLabelRef.current && cameraRef.current && containerRef.current) {
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
