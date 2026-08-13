import * as THREE from 'three';

export class CellularParticleSystem {
    private geometry: THREE.BufferGeometry;
    private material: THREE.ShaderMaterial;
    private points: THREE.Points;
    private particleCount: number;
    private positions: Float32Array;
    private velocities: Float32Array;
    private lifetimes: Float32Array;
    private baseColor: THREE.Color;

    constructor(particleCount: number = 2000, colorHex: number = 0x2dd4bf) {
        this.particleCount = particleCount;
        this.baseColor = new THREE.Color(colorHex);
        
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        this.lifetimes = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            this.resetParticle(i);
            // Stagger initial lifetimes so they don't all die at once
            this.lifetimes[i] = Math.random(); 
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('lifetime', new THREE.BufferAttribute(this.lifetimes, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                baseColor: { value: this.baseColor },
                pixelRatio: { value: window.devicePixelRatio }
            },
            vertexShader: `
                attribute float lifetime;
                varying float vLifetime;
                uniform float time;
                uniform float pixelRatio;
                
                void main() {
                    vLifetime = lifetime;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    // Size scales with lifetime (grows then shrinks)
                    float size = sin(lifetime * 3.14159) * 8.0 * pixelRatio;
                    gl_PointSize = size * (10.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 baseColor;
                varying float vLifetime;
                
                void main() {
                    // Make it a soft circle
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    
                    // Fade out at the edges of lifetime
                    float alpha = sin(vLifetime * 3.14159);
                    gl_FragColor = vec4(baseColor, alpha * 0.6);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(this.geometry, this.material);
    }

    private resetParticle(index: number) {
        const i3 = index * 3;
        // Spawn randomly within a spherical volume
        const radius = 0.5 + Math.random() * 0.5;
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        
        this.positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        this.positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        this.positions[i3 + 2] = radius * Math.cos(phi);
        
        // Gentle drift
        this.velocities[i3] = (Math.random() - 0.5) * 0.1;
        this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.1 + 0.05; // slight upward draft
        this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
        
        this.lifetimes[index] = 0.0;
    }

    public update(deltaTime: number, intensity: number = 1.0) {
        const positionsAttr = this.geometry.attributes.position as THREE.BufferAttribute;
        const lifetimesAttr = this.geometry.attributes.lifetime as THREE.BufferAttribute;

        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // Age particle
            this.lifetimes[i] += deltaTime * (0.2 + intensity * 0.5);
            
            if (this.lifetimes[i] >= 1.0) {
                this.resetParticle(i);
            } else {
                // Move particle
                const posArray = positionsAttr.array as Float32Array;
                posArray[i3] += this.velocities[i3] * deltaTime * intensity;
                posArray[i3 + 1] += this.velocities[i3 + 1] * deltaTime * intensity;
                posArray[i3 + 2] += this.velocities[i3 + 2] * deltaTime * intensity;
            }
        }
        
        positionsAttr.needsUpdate = true;
        lifetimesAttr.needsUpdate = true;
        this.material.uniforms.time.value += deltaTime;
    }

    public getMesh(): THREE.Points {
        return this.points;
    }
}
