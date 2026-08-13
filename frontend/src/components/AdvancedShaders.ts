import * as THREE from 'three';

export const BloodFlowShader = {
  uniforms: {
    time: { value: 0.0 },
    flowSpeed: { value: 1.5 },
    baseColor: { value: new THREE.Color(0xaa0000) },
    pulseColor: { value: new THREE.Color(0xff0000) },
    damageThreshold: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float time;
    uniform float flowSpeed;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      
      // Simulate microscopic rhythmic expansion based on heartbeat
      vec3 pos = position;
      float pulse = sin(time * flowSpeed) * 0.5 + 0.5;
      pos += normal * pulse * 0.02; 
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    uniform float time;
    uniform float flowSpeed;
    uniform vec3 baseColor;
    uniform vec3 pulseColor;
    uniform float damageThreshold;

    void main() {
      // Dynamic blood pulsing
      float pulse = sin(vUv.y * 20.0 - time * flowSpeed) * 0.5 + 0.5;
      vec3 color = mix(baseColor, pulseColor, pulse);
      
      // Fresnel effect for organ glossiness
      vec3 viewDir = normalize(-vPosition);
      float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);
      color += fresnel * 0.3;
      
      // Damage visualization (Necrosis / Ischemia)
      // If the fragment is in a damaged region (mocked by uv coordinates)
      float damageZone = step(0.6, vUv.x) * step(0.4, vUv.y);
      if (damageThreshold > 0.0 && damageZone > 0.0) {
        vec3 necrosisColor = vec3(0.1, 0.05, 0.1);
        color = mix(color, necrosisColor, damageThreshold * 0.8);
      }
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export const ElectricalImpulseShader = {
  uniforms: {
    time: { value: 0.0 },
    ecgSignal: { value: 0.0 },
    nerveColor: { value: new THREE.Color(0x00ffff) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float time;
    uniform float ecgSignal;
    uniform vec3 nerveColor;
    
    void main() {
      // Simulate electrical wavefront propagating through tissue
      float wavefront = fract(vUv.x * 5.0 - time * 2.0);
      float intensity = smoothstep(0.8, 1.0, wavefront) * ecgSignal;
      
      gl_FragColor = vec4(nerveColor * intensity, intensity);
    }
  `
};

export function applyAdvancedShaders(mesh: THREE.Mesh, damage: number = 0.0) {
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(BloodFlowShader.uniforms),
    vertexShader: BloodFlowShader.vertexShader,
    fragmentShader: BloodFlowShader.fragmentShader,
    transparent: true,
    side: THREE.DoubleSide
  });
  material.uniforms.damageThreshold.value = damage;
  mesh.material = material;
  return material;
}
