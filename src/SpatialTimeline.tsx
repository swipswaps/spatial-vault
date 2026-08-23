import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

export interface SpatialNode {
  id: string;
  title: string;
  timestamp: string;
  seconds: number;
  category: string;
}

interface Props {
  nodes: SpatialNode[];
  onSelectNode?: (node: SpatialNode) => void;
}

export function SpatialTimeline({ nodes, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef = useRef<number>(0);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const objectsRef = useRef<THREE.Mesh[]>([]);

  const handleClick = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(objectsRef.current);

    if (intersects.length > 0) {
      const idx = objectsRef.current.indexOf(intersects[0].object as THREE.Mesh);
      if (idx >= 0 && nodes[idx]) {
        onSelectNode?.(nodes[idx]);
      }
    }
  }, [nodes, onSelectNode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      1000
    );
    camera.position.set(0, 0, 20);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x6366f1, 3, 50);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xec4899, 2, 50);
    pointLight2.position.set(-10, -10, 5);
    scene.add(pointLight2);

    const geometry = new THREE.SphereGeometry(0.8, 32, 32);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.4,
    });

    const points: THREE.Vector3[] = [];
    objectsRef.current = [];

    nodes.forEach((node, i) => {
      const material = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x6366f1 : 0xec4899,
        roughness: 0.3,
        metalness: 0.7,
        emissive: i % 2 === 0 ? 0x1e1b4b : 0x4a044e,
        emissiveIntensity: 0.5,
      });

      const mesh = new THREE.Mesh(geometry, material);
      const angle = (i / Math.max(nodes.length - 1, 1)) * Math.PI * 2;
      const radius = 8;
      mesh.position.x = Math.cos(angle) * radius;
      mesh.position.y = Math.sin(angle * 2) * 3;
      mesh.position.z = Math.sin(angle) * radius * 0.5;

      mesh.userData = { node, originalScale: 1 };
      scene.add(mesh);
      objectsRef.current.push(mesh);
      points.push(mesh.position);
    });

    if (points.length > 1) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(line);
    }

    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.005;

      objectsRef.current.forEach((mesh, i) => {
        mesh.rotation.y += 0.01;
        mesh.rotation.x += 0.005;
        mesh.position.y += Math.sin(time + i) * 0.002;
      });

      const camRadius = 20;
      camera.position.x = Math.sin(time * 0.2) * camRadius;
      camera.position.z = Math.cos(time * 0.2) * camRadius;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    container.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('click', handleClick);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
    };
  }, [nodes, handleClick]);

  if (nodes.length === 0) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b'
      }}>
        No timeline data
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        cursor: 'pointer',
      }}
    />
  );
}
