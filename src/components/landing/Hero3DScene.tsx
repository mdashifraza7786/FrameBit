'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sparkles, Trail } from '@react-three/drei';
import * as THREE from 'three';

function OrbitingPin({
  radius,
  speed,
  offset,
  color,
  size = 0.14,
}: {
  radius: number;
  speed: number;
  offset: number;
  color: string;
  size?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed + offset;
    ref.current.position.set(
      Math.cos(t) * radius,
      Math.sin(t * 0.6) * (radius * 0.35),
      Math.sin(t) * radius
    );
  });

  return (
    <Trail width={1.4} length={4} color={color} attenuation={(t) => t * t}>
      <mesh ref={ref}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    </Trail>
  );
}

function CoreObject() {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    // Gentle continuous spin
    groupRef.current.rotation.y += delta * 0.25;
    // Subtle parallax toward pointer position
    const targetX = pointer.y * 0.25;
    const targetY = pointer.x * 0.35;
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.04;
    groupRef.current.rotation.z += (targetY * 0.3 - groupRef.current.rotation.z) * 0.04;
  });

  return (
    <group ref={groupRef}>
      <Float speed={1.6} rotationIntensity={0.5} floatIntensity={0.8}>
        <mesh castShadow>
          <icosahedronGeometry args={[1.35, 8]} />
          <MeshDistortMaterial
            color="#0d9488"
            emissive="#0d9488"
            emissiveIntensity={0.25}
            roughness={0.15}
            metalness={0.6}
            distort={0.35}
            speed={1.8}
          />
        </mesh>
      </Float>

      {/* Wireframe shell for a "frame/scan" feel */}
      <mesh scale={1.55}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color="#5eead4" wireframe transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

function Scene() {
  const pinColors = useMemo(() => ['#2dd4bf', '#22d3ee', '#f59e0b', '#a855f7'], []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 3, 4]} intensity={40} color="#2dd4bf" />
      <pointLight position={[-4, -2, -3]} intensity={25} color="#22d3ee" />
      <directionalLight position={[0, 5, 5]} intensity={0.6} color="#ffffff" />

      <CoreObject />

      {pinColors.map((color, i) => (
        <OrbitingPin
          key={color}
          radius={1.7 + i * 0.25}
          speed={0.35 + i * 0.12}
          offset={i * 1.7}
          color={color}
        />
      ))}

      <Sparkles count={70} scale={4.5} size={2} speed={0.3} color="#5eead4" opacity={0.6} />
    </>
  );
}

export default function Hero3DScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      className="!absolute inset-0"
    >
      <Scene />
    </Canvas>
  );
}
