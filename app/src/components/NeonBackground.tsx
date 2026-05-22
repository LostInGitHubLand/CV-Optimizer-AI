import { useRef, useEffect } from "react";
import * as THREE from "three";

export default function NeonBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.0008);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
    camera.position.z = 500;
    camera.position.y = 100;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0a0a1a, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create neon grid floor
    const gridSize = 2000;
    const gridDivisions = 50;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x06b6d4, 0x0e4a5c);
    gridHelper.position.y = -100;
    scene.add(gridHelper);

    // Create floating particles
    const particleCount = 300;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorPalette = [
      new THREE.Color(0x06b6d4),
      new THREE.Color(0xec4899),
      new THREE.Color(0xa855f7),
      new THREE.Color(0x22d3ee),
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1500;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 800 + 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1500;

      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    particles.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particles.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);

    // Create floating neon lines
    const lineCount = 20;
    const lineGroup = new THREE.Group();

    for (let i = 0; i < lineCount; i++) {
      const lineGeo = new THREE.BufferGeometry();
      const linePoints = [];
      const numPoints = 5 + Math.floor(Math.random() * 5);
      const startX = (Math.random() - 0.5) * 1000;
      const startY = Math.random() * 400;
      const startZ = (Math.random() - 0.5) * 1000;

      for (let j = 0; j < numPoints; j++) {
        linePoints.push(
          new THREE.Vector3(
            startX + j * 30 + Math.random() * 20,
            startY + Math.sin(j * 0.5) * 50,
            startZ + Math.cos(j * 0.5) * 30
          )
        );
      }

      lineGeo.setFromPoints(linePoints);
      const lineColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      const lineMat = new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: 0.4,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      lineGroup.add(line);
    }

    scene.add(lineGroup);

    // Create glowing orbs
    const orbCount = 8;
    const orbs: THREE.Mesh[] = [];

    for (let i = 0; i < orbCount; i++) {
      const orbGeo = new THREE.SphereGeometry(5 + Math.random() * 10, 16, 16);
      const orbColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      const orbMat = new THREE.MeshBasicMaterial({
        color: orbColor,
        transparent: true,
        opacity: 0.3,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(
        (Math.random() - 0.5) * 1200,
        Math.random() * 500 + 50,
        (Math.random() - 0.5) * 1200
      );
      orbs.push(orb);
      scene.add(orb);
    }

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - width / 2) * 0.3;
      mouseY = (event.clientY - height / 2) * 0.3;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Animation loop
    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.005;

      // Rotate particle system slowly
      particleSystem.rotation.y += 0.0005;
      particleSystem.rotation.x += 0.0002;

      // Float particles up and down
      const posArray = particles.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArray[i * 3 + 1] += Math.sin(time + i * 0.1) * 0.3;
      }
      particles.attributes.position.needsUpdate = true;

      // Animate orbs
      orbs.forEach((orb, i) => {
        orb.position.y += Math.sin(time * 2 + i) * 0.2;
        orb.scale.setScalar(1 + Math.sin(time + i * 0.5) * 0.1);
      });

      // Camera follow mouse gently
      camera.position.x += (mouseX - camera.position.x) * 0.02;
      camera.position.y += (-mouseY + 100 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      // Rotate line group
      lineGroup.rotation.y += 0.0003;

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
