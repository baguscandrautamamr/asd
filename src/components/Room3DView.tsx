import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Box,
  Compass,
  Grid3x3,
  Info,
  Maximize2,
  Radar,
  RotateCw,
  Server,
  Target,
  Waves,
} from 'lucide-react';
import { CalculationParams, CalculationResults, HoleScheduleItem } from '../types';
import { useI18n } from '../context/I18nContext';

export interface Room3DViewRef {
  /** PNG snapshot of the current viewport, used by the PDF report. */
  getImageBase64: () => string | undefined;
}

interface Room3DViewProps {
  params: CalculationParams;
  results: CalculationResults;
}

type ViewPreset = 'iso' | 'top' | 'front' | 'side';

interface LayerState {
  walls: boolean;
  ceiling: boolean;
  coverage: boolean;
  holes: boolean;
  racks: boolean;
  capillary: boolean;
  flow: boolean;
}

/** Every colour the scene uses, swapped wholesale when the theme flips. */
interface ScenePalette {
  background: number;
  floor: number;
  grid: number;
  gridStrong: number;
  wall: number;
  wallEdge: number;
  ceiling: number;
  rack: number;
  rackEdge: number;
  pipe: number;
  pipeEmissive: number;
  hole: number;
  holeHover: number;
  coverage: number;
  asdBody: number;
  asdFace: number;
  label: string;
  ambient: number;
  key: number;
  rim: number;
}

/**
 * Single light palette matching the app shell. Greens come from the brand,
 * while the pipe network keeps fire-alarm red because that is the colour of
 * the real CPVC material on site.
 */
const PALETTE: ScenePalette = {
  background: 0xeef2ee,
  floor: 0xd5ded5,
  grid: 0xa9b7a9,
  gridStrong: 0x7c8d7c,
  wall: 0xffffff,
  wallEdge: 0x8b9a8b,
  ceiling: 0x9fae9f,
  rack: 0xbcc8bc,
  rackEdge: 0x8b9a8b,
  pipe: 0xd5352f,
  pipeEmissive: 0x4a0d0b,
  hole: 0xffffff,
  holeHover: 0x4f8221,
  coverage: 0x4f8221,
  asdBody: 0x64748b,
  asdFace: 0x1e293b,
  label: '#26332b',
  ambient: 0xe6ece6,
  key: 0xffffff,
  rim: 0x8cbf3f,
};

/** Releases GPU memory for a subtree before it is discarded. */
function disposeSubtree(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
    const sprite = child as THREE.Sprite;
    if (sprite.isSprite && sprite.material.map) sprite.material.map.dispose();
  });
}

/** Draws a text label into a canvas texture so it stays readable at any angle. */
function makeLabelSprite(text: string, color: string, worldHeight = 0.9): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const scale = 4;
  const fontSize = 40;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const width = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = width * (scale / 2);
  canvas.height = 64 * (scale / 2);

  const ctx2 = canvas.getContext('2d')!;
  ctx2.scale(scale / 2, scale / 2);
  ctx2.font = `700 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx2.textBaseline = 'middle';
  ctx2.fillStyle = color;
  ctx2.fillText(text, 12, 32);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  );
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(worldHeight * aspect, worldHeight, 1);
  sprite.renderOrder = 20;
  return sprite;
}

/** Straight pipe segments joined by spheres, so corners read as real elbows. */
function buildPipeRun(
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const length = from.distanceTo(to);
    if (length < 1e-4) continue;

    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 12, 1),
      material
    );
    cylinder.position.copy(from).add(to).multiplyScalar(0.5);
    cylinder.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize()
    );
    cylinder.castShadow = true;
    group.add(cylinder);
  }

  // Elbow/joint spheres at every interior vertex plus the terminating end cap.
  for (let i = 1; i < points.length; i++) {
    const isEnd = i === points.length - 1;
    const joint = new THREE.Mesh(
      new THREE.SphereGeometry(isEnd ? radius * 1.9 : radius * 1.25, 14, 10),
      material
    );
    joint.position.copy(points[i]);
    group.add(joint);
  }
  return group;
}

function polylineLength(points: THREE.Vector3[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += points[i].distanceTo(points[i + 1]);
  return total;
}

/** Position at `distance` metres along a polyline, used to animate airflow. */
function pointAtDistance(points: THREE.Vector3[], distance: number, out: THREE.Vector3) {
  let remaining = distance;
  for (let i = 0; i < points.length - 1; i++) {
    const seg = points[i].distanceTo(points[i + 1]);
    if (remaining <= seg || i === points.length - 2) {
      const ratio = seg === 0 ? 0 : Math.min(1, remaining / seg);
      out.copy(points[i]).lerp(points[i + 1], ratio);
      return out;
    }
    remaining -= seg;
  }
  out.copy(points[points.length - 1]);
  return out;
}

/**
 * A grid clipped to the room footprint. THREE.GridHelper is always square, so
 * it spills past a rectangular room and makes the floor plate hard to read.
 */
function buildRoomGrid(
  length: number,
  width: number,
  step: number,
  color: number,
  opacity: number
): THREE.LineSegments {
  const points: number[] = [];
  const ox = length / 2;
  const oz = width / 2;

  for (let x = 0; x <= length + 1e-6; x += step) {
    points.push(x - ox, 0, -oz, x - ox, 0, oz);
  }
  for (let z = 0; z <= width + 1e-6; z += step) {
    points.push(-ox, 0, z - oz, ox, 0, z - oz);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
}

/** Detector coordinates in room space — mirrors the calculator's placement. */
function detectorPosition(params: CalculationParams) {
  const offset = Math.max(0.1, Math.min(0.9, params.detectorLocation?.positionOffsetRatio ?? 0.5));
  switch (params.detectorLocation?.wall || 'west') {
    case 'north':
      return { x: params.length * offset, y: 0.4, rotation: 0 };
    case 'south':
      return { x: params.length * offset, y: params.width - 0.4, rotation: Math.PI };
    case 'east':
      return { x: params.length - 0.4, y: params.width * offset, rotation: -Math.PI / 2 };
    case 'west':
    default:
      return { x: 0.4, y: params.width * offset, rotation: Math.PI / 2 };
  }
}

interface FlowTrack {
  points: THREE.Vector3[];
  length: number;
  particles: THREE.Mesh[];
  phases: number[];
}

export const Room3DView = forwardRef<Room3DViewRef, Room3DViewProps>(
  ({ params, results }, ref) => {
    const { t, n } = useI18n();

    const mountRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const modelRef = useRef<THREE.Group | null>(null);
    const groupsRef = useRef<Record<keyof LayerState, THREE.Group> | null>(null);
    const holeMeshesRef = useRef<THREE.Mesh[]>([]);
    const flowRef = useRef<FlowTrack[]>([]);
    const hoveredMeshRef = useRef<THREE.Mesh | null>(null);

    const [hovered, setHovered] = useState<HoleScheduleItem | null>(null);
    const [autoRotate, setAutoRotate] = useState(false);
    const [webglFailed, setWebglFailed] = useState(false);
    const [layers, setLayers] = useState<LayerState>({
      walls: true,
      ceiling: true,
      coverage: true,
      holes: true,
      racks: params.roomType === 'data_center' || params.roomType === 'telecom',
      capillary: true,
      flow: true,
    });

    const toggleLayer = (key: keyof LayerState) =>
      setLayers((prev) => ({ ...prev, [key]: !prev[key] }));

    // The animation loop reads layer visibility every frame, so mirror the
    // state into a ref that the loop's closure can see without re-subscribing.
    const layersRef = useRef(layers);

    // Room dimensions drive camera framing; held in a ref so changing an
    // unrelated parameter (ACH, orifice sizing) does not yank the camera back.
    const dimsRef = useRef({ length: params.length, width: params.width, height: params.height });
    dimsRef.current = { length: params.length, width: params.width, height: params.height };

    /** Frames the whole room from a named angle. */
    const applyView = useCallback(
      (preset: ViewPreset) => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        if (!camera || !controls) return;

        const { length, width, height } = dimsRef.current;
        const span = Math.max(length, width);
        const dist = span * 0.78 + height * 1.4 + 3;

        controls.target.set(0, height * 0.45, 0);
        switch (preset) {
          case 'top':
            camera.position.set(0.001, span * 1.15 + 4, 0.001);
            break;
          case 'front':
            camera.position.set(0, height * 1.1, dist * 0.92);
            break;
          case 'side':
            camera.position.set(dist * 0.92, height * 1.1, 0);
            break;
          case 'iso':
          default:
            camera.position.set(dist * 0.68, dist * 0.52, dist * 0.78);
            break;
        }
        camera.near = 0.1;
        camera.far = dist * 8;
        camera.updateProjectionMatrix();
        controls.update();
      },
      []
    );

    // ---------------------------------------------------------------- mount
    useEffect(() => {
      const mount = mountRef.current;
      if (!mount) return;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          // Required so the PDF export can read pixels back off the canvas.
          preserveDrawingBuffer: true,
        });
      } catch {
        setWebglFailed(true);
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 520);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        45,
        (mount.clientWidth || 800) / (mount.clientHeight || 520),
        0.1,
        800
      );
      cameraRef.current = camera;

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI * 0.495; // never drop below the floor
      controls.minDistance = 3;
      controls.autoRotateSpeed = 0.7;
      controlsRef.current = controls;

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let pointerInside = false;

      const onPointerMove = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        pointerInside = true;
      };
      const onPointerLeave = () => {
        pointerInside = false;
      };
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);

      const resizeObserver = new ResizeObserver(() => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(mount);

      const clock = new THREE.Clock();
      const scratch = new THREE.Vector3();
      let frame = 0;

      const animate = () => {
        frame = requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();

        // Airflow travels from the far end of each branch back to the detector.
        if (layersRef.current.flow) {
          for (const track of flowRef.current) {
            track.particles.forEach((particle, index) => {
              const progress = (elapsed * 0.16 + track.phases[index]) % 1;
              pointAtDistance(track.points, (1 - progress) * track.length, scratch);
              particle.position.copy(scratch);
              const material = particle.material as THREE.MeshBasicMaterial;
              material.opacity = 0.25 + 0.75 * Math.sin(Math.PI * progress);
            });
          }
        }

        // Hover inspection on the sampling ports.
        if (pointerInside && holeMeshesRef.current.length > 0) {
          raycaster.setFromCamera(pointer, camera);
          const hits = raycaster.intersectObjects(holeMeshesRef.current, false);
          const hit = hits.length > 0 ? (hits[0].object as THREE.Mesh) : null;
          if (hit !== hoveredMeshRef.current) {
            if (hoveredMeshRef.current) {
              hoveredMeshRef.current.scale.setScalar(1);
              (hoveredMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
            }
            hoveredMeshRef.current = hit;
            if (hit) {
              hit.scale.setScalar(1.8);
              (hit.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4;
              setHovered(hit.userData.hole as HoleScheduleItem);
            } else {
              setHovered(null);
            }
            renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
          }
        } else if (hoveredMeshRef.current) {
          hoveredMeshRef.current.scale.setScalar(1);
          (hoveredMeshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.25;
          hoveredMeshRef.current = null;
          setHovered(null);
        }

        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      return () => {
        cancelAnimationFrame(frame);
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        controls.dispose();
        if (modelRef.current) disposeSubtree(modelRef.current);
        disposeSubtree(scene);
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        rendererRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        controlsRef.current = null;
        modelRef.current = null;
        groupsRef.current = null;
        holeMeshesRef.current = [];
        flowRef.current = [];
      };
      // Mount once: everything else is applied through the effects below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      layersRef.current = layers;
      const groups = groupsRef.current;
      if (!groups) return;
      (Object.keys(groups) as (keyof LayerState)[]).forEach((key) => {
        groups[key].visible = layers[key];
      });
    }, [layers]);

    useEffect(() => {
      if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
    }, [autoRotate]);

    // -------------------------------------------------------- build the room
    useEffect(() => {
      const scene = sceneRef.current;
      if (!scene) return;

      const palette = PALETTE;

      if (modelRef.current) {
        scene.remove(modelRef.current);
        disposeSubtree(modelRef.current);
      }
      scene.background = new THREE.Color(palette.background);
      scene.fog = new THREE.Fog(palette.background, Math.max(params.length, params.width) * 1.6, 260);

      flowRef.current = [];
      holeMeshesRef.current = [];
      hoveredMeshRef.current = null;

      const model = new THREE.Group();
      const { length, width, height } = params;
      const ox = length / 2;
      const oz = width / 2;
      /** Room coordinates (x along length, y along width, h above floor). */
      const v = (x: number, y: number, h: number) => new THREE.Vector3(x - ox, h, y - oz);

      const groups: Record<keyof LayerState, THREE.Group> = {
        walls: new THREE.Group(),
        ceiling: new THREE.Group(),
        coverage: new THREE.Group(),
        holes: new THREE.Group(),
        racks: new THREE.Group(),
        capillary: new THREE.Group(),
        flow: new THREE.Group(),
      };

      // --- lighting -------------------------------------------------------
      const hemi = new THREE.HemisphereLight(palette.key, palette.ambient, 1.05);
      model.add(hemi);

      const keyLight = new THREE.DirectionalLight(palette.key, 1.35);
      keyLight.position.set(length * 0.6, height * 3.2, width * 0.8);
      model.add(keyLight);

      const fillLight = new THREE.DirectionalLight(palette.key, 0.5);
      fillLight.position.set(-length * 0.7, height * 1.6, -width * 0.9);
      model.add(fillLight);

      // A red rim light so the pipe network reads as the hero of the scene.
      const rimLight = new THREE.PointLight(palette.rim, 18, Math.max(length, width) * 1.6, 2);
      rimLight.position.set(0, height * 0.92, 0);
      model.add(rimLight);

      // --- floor ----------------------------------------------------------
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(length, width),
        new THREE.MeshStandardMaterial({
          color: palette.floor,
          roughness: 0.95,
          metalness: 0.02,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      model.add(floor);

      const grid = buildRoomGrid(length, width, 1, palette.grid, 0.5);
      grid.position.y = 0.012;
      model.add(grid);

      const gridMajor = buildRoomGrid(length, width, 5, palette.gridStrong, 0.85);
      gridMajor.position.y = 0.014;
      model.add(gridMajor);

      // --- walls & room shell ---------------------------------------------
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(length, height, width),
        new THREE.MeshStandardMaterial({
          color: palette.wall,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.2,
          roughness: 1,
          metalness: 0,
        })
      );
      shell.position.y = height / 2;
      groups.walls.add(shell);

      const shellBox = new THREE.BoxGeometry(length, height, width);
      const shellEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(shellBox),
        new THREE.LineBasicMaterial({ color: palette.wallEdge, transparent: true, opacity: 0.95 })
      );
      shellBox.dispose();
      shellEdges.position.y = height / 2;
      groups.walls.add(shellEdges);

      const compass: [string, THREE.Vector3][] = [
        [t('plan.northWall'), v(length / 2, -1.8, 0.45)],
        [t('plan.southWall'), v(length / 2, width + 1.8, 0.45)],
        [t('plan.westWall'), v(-1.8, width / 2, 0.45)],
        [t('plan.eastWall'), v(length + 1.8, width / 2, 0.45)],
      ];
      compass.forEach(([text, position]) => {
        const sprite = makeLabelSprite(text, palette.label, 1.05);
        sprite.position.copy(position);
        groups.walls.add(sprite);
      });

      // --- ceiling grid ----------------------------------------------------
      // A 600mm module reads as a suspended acoustic ceiling grid.
      const ceilingGrid = buildRoomGrid(length, width, 1.2, palette.ceiling, 0.28);
      ceilingGrid.position.y = height;
      groups.ceiling.add(ceilingGrid);

      // --- equipment racks -------------------------------------------------
      if (params.roomType === 'data_center' || params.roomType === 'telecom') {
        const rackMaterial = new THREE.MeshStandardMaterial({
          color: palette.rack,
          roughness: 0.75,
          metalness: 0.25,
        });
        const rackHeight = Math.min(2.1, height * 0.6);
        const rackBox = new THREE.BoxGeometry(2.4, rackHeight, 0.9);
        const rackEdgeGeometry = new THREE.EdgesGeometry(rackBox);
        const rows = Math.max(2, Math.floor(width / 4));
        const perRow = Math.max(3, Math.floor(length / 3.5));

        for (let r = 0; r < rows; r++) {
          const ry = (r + 0.6) * (width / rows);
          for (let c = 0; c < perRow; c++) {
            const rx = 2.5 + c * 3.2;
            if (rx + 2.4 >= length) continue;
            const rack = new THREE.Mesh(rackBox, rackMaterial);
            rack.position.copy(v(rx + 1.2, ry + 0.45, rackHeight / 2));
            groups.racks.add(rack);

            const edges = new THREE.LineSegments(
              rackEdgeGeometry,
              new THREE.LineBasicMaterial({ color: palette.rackEdge, transparent: true, opacity: 0.6 })
            );
            edges.position.copy(rack.position);
            groups.racks.add(edges);
          }
        }
      }

      // --- pipe network ----------------------------------------------------
      const pipeY = Math.max(0.4, height - 0.18);
      const pipeMaterial = new THREE.MeshStandardMaterial({
        color: palette.pipe,
        emissive: palette.pipeEmissive,
        emissiveIntensity: 0.45,
        roughness: 0.35,
        metalness: 0.1,
      });

      const detector = detectorPosition(params);
      const detectorHeight = Math.min(
        height - 0.4,
        Math.max(0.8, params.detectorLocation?.heightFromFloor ?? 1.5)
      );

      results.branches.forEach((branch) => {
        // Riser off the detector, then the orthogonal route the calculator
        // produced. Drawing from routePoints keeps the model identical to the
        // 2D plan and to the pipe length in the schedule.
        const path = [
          v(detector.x, detector.y, detectorHeight + 0.35),
          ...branch.routePoints.map((point) => v(point.x, point.y, pipeY)),
        ];
        model.add(buildPipeRun(path, 0.075, pipeMaterial));

        const label = makeLabelSprite(
          `${branch.pipeName} · ${n(branch.lengthMeters, 1)} m`,
          palette.label,
          0.8
        );
        label.position.copy(v(branch.endPoint.x, branch.endPoint.y, pipeY + 0.55));
        model.add(label);

        // Airflow particles for this branch.
        const particles: THREE.Mesh[] = [];
        const phases: number[] = [];
        const flowGeometry = new THREE.SphereGeometry(0.075, 8, 6);
        for (let i = 0; i < 4; i++) {
          const particle = new THREE.Mesh(
            flowGeometry,
            new THREE.MeshBasicMaterial({
              color: palette.holeHover,
              transparent: true,
              opacity: 0.9,
            })
          );
          groups.flow.add(particle);
          particles.push(particle);
          phases.push(i / 4);
        }
        flowRef.current.push({
          points: path,
          length: polylineLength(path),
          particles,
          phases,
        });
      });

      // --- sampling ports & capillary drops --------------------------------
      const capillaryMaterial = new THREE.MeshStandardMaterial({
        color: palette.pipe,
        transparent: true,
        opacity: 0.65,
        roughness: 0.5,
      });
      const roseMaterial = new THREE.MeshStandardMaterial({
        color: palette.hole,
        roughness: 0.4,
        metalness: 0.3,
      });

      const dropLength = params.capillaryDropEnabled
        ? Math.min(params.capillaryTubeLength || 0.8, pipeY - 0.3)
        : 0;
      const portY = pipeY - dropLength;

      results.holes.forEach((hole) => {
        if (params.capillaryDropEnabled && dropLength > 0.05) {
          const tube = new THREE.Mesh(
            new THREE.CylinderGeometry(0.018, 0.018, dropLength, 8),
            capillaryMaterial
          );
          tube.position.copy(v(hole.x, hole.y, pipeY - dropLength / 2));
          groups.capillary.add(tube);

          const rose = new THREE.Mesh(
            new THREE.CylinderGeometry(0.075, 0.075, 0.02, 14),
            roseMaterial
          );
          rose.position.copy(v(hole.x, hole.y, portY));
          groups.capillary.add(rose);
        }

        // Orifice diameter is legible as a size difference between ports.
        const sizeFactor = 0.75 + (hole.diameterMm / 4.2) * 0.65;
        const port = new THREE.Mesh(
          new THREE.SphereGeometry(0.075 * sizeFactor, 14, 10),
          new THREE.MeshStandardMaterial({
            color: palette.hole,
            emissive: palette.holeHover,
            emissiveIntensity: 0.25,
            roughness: 0.25,
            metalness: 0.4,
          })
        );
        port.position.copy(v(hole.x, hole.y, params.capillaryDropEnabled ? portY : pipeY - 0.06));
        port.userData.hole = hole;
        groups.holes.add(port);
        holeMeshesRef.current.push(port);

        // Coverage disc sits just under the ceiling, where smoke is captured.
        const disc = new THREE.Mesh(
          new THREE.CircleGeometry(hole.coverageRadiusM, 40),
          new THREE.MeshBasicMaterial({
            color: palette.coverage,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        disc.rotation.x = -Math.PI / 2;
        disc.position.copy(v(hole.x, hole.y, portY - 0.05));
        groups.coverage.add(disc);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(hole.coverageRadiusM * 0.985, hole.coverageRadiusM, 48),
          new THREE.MeshBasicMaterial({
            color: palette.coverage,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(v(hole.x, hole.y, portY - 0.045));
        groups.coverage.add(ring);
      });

      // --- ASD detector unit -----------------------------------------------
      const asd = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.9, 0.24),
        new THREE.MeshStandardMaterial({
          color: palette.asdBody,
          roughness: 0.55,
          metalness: 0.4,
        })
      );
      asd.add(body);

      const face = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.76, 0.02),
        new THREE.MeshStandardMaterial({ color: palette.asdFace, roughness: 0.3 })
      );
      face.position.z = 0.13;
      asd.add(face);

      // Status LEDs — the visual signature of a VESDA-style unit.
      const ledColors = [0x10b981, 0x3b82f6, 0xf59e0b, 0xef4444];
      ledColors.forEach((color, index) => {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 10, 8),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 })
        );
        led.position.set(-0.165 + index * 0.11, 0.2, 0.15);
        asd.add(led);
      });

      const bargraph = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.05, 0.01),
        new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          emissive: 0x0284c7,
          emissiveIntensity: 1.2,
        })
      );
      bargraph.position.set(0, 0.03, 0.15);
      asd.add(bargraph);

      asd.position.copy(v(detector.x, detector.y, detectorHeight));
      asd.rotation.y = detector.rotation;
      model.add(asd);

      const asdLabel = makeLabelSprite(t('plan.asdUnit'), palette.label, 0.85);
      asdLabel.position.copy(v(detector.x, detector.y, detectorHeight + 0.85));
      model.add(asdLabel);

      Object.values(groups).forEach((group) => model.add(group));
      (Object.keys(groups) as (keyof LayerState)[]).forEach((key) => {
        groups[key].visible = layersRef.current[key];
      });

      groupsRef.current = groups;
      modelRef.current = model;
      scene.add(model);

      return () => {
        flowRef.current = [];
        holeMeshesRef.current = [];
        hoveredMeshRef.current = null;
      };
    }, [params, results, t, n]);

    // Re-frame whenever the room itself changes shape.
    useEffect(() => {
      applyView('iso');
    }, [params.length, params.width, params.height, applyView]);

    useImperativeHandle(ref, () => ({
      getImageBase64: () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!renderer || !scene || !camera) return undefined;
        try {
          renderer.render(scene, camera);
          return renderer.domElement.toDataURL('image/png');
        } catch {
          return undefined;
        }
      },
    }));

    const layerButtons: { key: keyof LayerState; label: string; icon: React.ReactNode }[] = [
      { key: 'walls', label: t('v3d.walls'), icon: <Box className="w-3.5 h-3.5" /> },
      { key: 'ceiling', label: t('v3d.ceiling'), icon: <Grid3x3 className="w-3.5 h-3.5" /> },
      { key: 'coverage', label: t('v3d.coverage'), icon: <Radar className="w-3.5 h-3.5" /> },
      { key: 'holes', label: t('v3d.holes'), icon: <Target className="w-3.5 h-3.5" /> },
      { key: 'capillary', label: t('v3d.capillary'), icon: <Waves className="w-3.5 h-3.5" /> },
      { key: 'flow', label: t('v3d.flow'), icon: <Compass className="w-3.5 h-3.5" /> },
    ];

    if (params.roomType === 'data_center' || params.roomType === 'telecom') {
      layerButtons.push({
        key: 'racks',
        label: t('v3d.racks'),
        icon: <Server className="w-3.5 h-3.5" />,
      });
    }

    const views: { key: ViewPreset; label: string }[] = [
      { key: 'iso', label: t('v3d.viewIso') },
      { key: 'top', label: t('v3d.viewTop') },
      { key: 'front', label: t('v3d.viewFront') },
      { key: 'side', label: t('v3d.viewSide') },
    ];

    return (
      <div className="relative w-full h-full rounded-2xl overflow-hidden border border-line bg-canvas flex flex-col select-none">
        {/* Floating toolbar */}
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
          <div className="glass rounded-xl px-3 py-2 shadow-lg pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              <span className="text-xs font-bold text-ink">{t('v3d.title')}</span>
            </div>
            <span className="text-[11px] text-ink-3 font-mono">
              {t('v3d.subtitle', {
                l: n(params.length, 1),
                w: n(params.width, 1),
                h: n(params.height, 1),
                branches: results.branches.length,
                holes: results.totalHolesCalculated,
              })}
            </span>
          </div>

          <div className="flex flex-col items-end gap-2 pointer-events-auto">
            <div className="glass rounded-xl p-1 shadow-lg flex flex-wrap items-center gap-1 justify-end max-w-[26rem]">
              {layerButtons.map((button) => (
                <button
                  key={button.key}
                  type="button"
                  onClick={() => toggleLayer(button.key)}
                  className={`px-2 py-1 text-[11px] rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
                    layers[button.key]
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-ink-3 hover:text-ink hover:bg-surface-3'
                  }`}
                >
                  {button.icon}
                  {button.label}
                </button>
              ))}
            </div>

            <div className="glass rounded-xl p-1 shadow-lg flex items-center gap-1">
              {views.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => applyView(view.key)}
                  className="px-2 py-1 text-[11px] rounded-lg font-semibold text-ink-2 hover:text-ink hover:bg-surface-3 transition-colors"
                >
                  {view.label}
                </button>
              ))}
              <span className="w-px h-4 bg-line-2 mx-0.5" />
              <button
                type="button"
                onClick={() => setAutoRotate((prev) => !prev)}
                title={t('v3d.autoRotate')}
                className={`p-1.5 rounded-lg transition-colors ${
                  autoRotate ? 'bg-brand text-white' : 'text-ink-3 hover:text-ink hover:bg-surface-3'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyView('iso')}
                title={t('v3d.resetView')}
                className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-3 transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* WebGL viewport */}
        <div ref={mountRef} className="flex-1 w-full min-h-0 cursor-grab active:cursor-grabbing" />

        {webglFailed && (
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-surface/90">
            <p className="text-sm text-ink-2 max-w-md">{t('v3d.unsupported')}</p>
          </div>
        )}

        {/* Inspection bar */}
        <div className="glass px-4 py-2.5 border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
          {hovered ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2 animate-fadeIn">
              <span className="flex items-center gap-1.5 font-bold text-info">
                <Info className="w-3.5 h-3.5" />
                {t('plan.holeTitle', { n: hovered.holeNumber, pipe: hovered.pipeName })}
              </span>
              <span>
                {t('plan.coord')}:{' '}
                <strong className="text-ink font-mono">
                  X {n(hovered.x, 2)} m · Y {n(hovered.y, 2)} m
                </strong>
              </span>
              <span>
                {t('plan.orifice')}:{' '}
                <strong className="text-warn font-mono">ø {n(hovered.diameterMm, 1)} mm</strong>
              </span>
              <span>
                {t('plan.suction')}:{' '}
                <strong className="text-ok font-mono">{n(hovered.suctionPressurePa)} Pa</strong>
              </span>
              <span>
                {t('plan.flow')}:{' '}
                <strong className="text-info font-mono">
                  {n(hovered.estimatedFlowRateLpm, 1)} L/min
                </strong>
              </span>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-ink-3">
              <Info className="w-3.5 h-3.5 text-brand" />
              {t('v3d.hint')}
            </span>
          )}

          <div className="flex items-center gap-3 text-[11px] text-ink-3 ml-auto">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 rounded bg-brand" />
              {t('v3d.legendPipe')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-ink border border-line-2" />
              {t('v3d.legendPort')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full border border-brand bg-brand/20" />
              {t('v3d.legendCoverage')}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

Room3DView.displayName = 'Room3DView';
