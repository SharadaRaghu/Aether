import { Suspense, useMemo, useState, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import { type LayoutItem } from '../Types/LayoutItem';
import { supabase } from '../Supabase';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';

interface FurnitureProps {
  item: LayoutItem;
  roomWidth: number;
  roomDepth: number;
  onUpdate: (name: string, x: number, z: number, rotation: number) => void;
  isSelected: boolean;
  onSelect: (name: string | null) => void;
  setControlsEnabled: (enabled: boolean) => void;
}

const FurnitureModel = ({ item, roomWidth, roomDepth, onUpdate, isSelected, onSelect, setControlsEnabled }: FurnitureProps) => {
  const { data } = supabase.storage.from('models').getPublicUrl(item.model_url);
  const { scene } = useGLTF(data.publicUrl);
  
  const meshRef = useRef<THREE.Group>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { raycaster, mouse, camera } = useThree();

  const copiedScene = useMemo(() => {
    if (!scene) return new THREE.Group();
    const clone = scene.clone();
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= box.min.y; 

    const scaleX = item.width_m / size.x;
    const scaleZ = item.depth_m / size.z;
    const finalScale = Math.min(scaleX, scaleZ);

    clone.scale.set(finalScale, finalScale, finalScale);
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [scene, item.width_m, item.depth_m]);

  const clampedPosition = useMemo(() => {
    const halfRoomW = roomWidth / 2;
    const halfRoomD = roomDepth / 2;
    const margin = 0.05; 
    const halfItemW = item.width_m / 2;
    const halfItemD = item.depth_m / 2;

    const x = Math.max(-halfRoomW + halfItemW + margin, Math.min(halfRoomW - halfItemW - margin, item.x));
    const z = Math.max(-halfRoomD + halfItemD + margin, Math.min(halfRoomD - halfItemD - margin, item.z));

    return [x, 0, z] as [number, number, number];
  }, [item.x, item.z, roomWidth, roomDepth, item.width_m, item.depth_m]);

  useFrame(() => {
    if (meshRef.current && isDragging && isSelected) {
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersection);

      if (intersection) {
        onUpdate(item.name, intersection.x, intersection.z, item.rotation);
      }
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onSelect(item.name);
    setIsDragging(true);
    setControlsEnabled(false); 
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    setControlsEnabled(true); 
  };

  return (
    <group
      ref={meshRef}
      position={clampedPosition}
      rotation={[0, item.rotation, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <primitive object={copiedScene} />
      {isSelected && (
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[item.width_m, 0.02, item.depth_m]} />
          <meshStandardMaterial color="cyan" opacity={0.3} transparent />
        </mesh>
      )}
    </group>
  );
};

export default function RoomScene({ layout, width, depth, onSelectModel, selectedModel, onUpdate }: any) {
  const [controlsEnabled, setControlsEnabled] = useState(true);

  return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a1a', position: 'relative' }}>
      <Canvas camera={{ position: [0, width, depth], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        <Environment preset="city" /> 
        <ContactShadows resolution={1024} scale={width * 2} blur={2} opacity={0.4} far={10} color="#000000" />

        <mesh 
          rotation={[-Math.PI / 2, 0, 0]} 
          position={[0, -0.01, 0]}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelectModel?.(null); 
          }}
        >
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>

        <gridHelper args={[20, 20, 0x888888, 0x444444]} position={[0, -0.02, 0]} />
        <OrbitControls makeDefault enabled={controlsEnabled} />

        <Suspense fallback={null}>
          {layout.map((item: any, idx: number) => (
            <FurnitureModel 
              key={`${item.name}-${idx}`} 
              item={item} 
              roomWidth={width} 
              roomDepth={depth}
              onUpdate={onUpdate}
              isSelected={selectedModel === item.name}
              onSelect={onSelectModel}
              setControlsEnabled={setControlsEnabled}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}