import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../AppContext.js';
import {
  coverCss,
  drawCoverCanvas,
  drawSpineCanvas,
  drawWoodCanvas,
  extractDominantColor,
} from '../lib/covers.js';
import { formatWatchedDate, tmdbImageUrl, toCollection } from '../types.js';
import type { CollectionItem } from '../types.js';

/**
 * The Cupboard: a Criterion-Closet-style collection room.
 *
 * A small wood-lined closet with floor-to-ceiling shelving, packed densely
 * with blu-ray cases spine-out (Criterion spine designs: dominant artwork
 * color, clean vertical type, a collection number). Occasional face-out
 * cases show their real TMDB cover art. Warm closet lighting, soft shelf
 * shadows, drifting dust motes. Hover pulls a case toward you; click pulls
 * it out and turns it so the cover faces you — like browsing the closet in
 * the videos. The closet grows with the collection.
 */

// Blu-ray case proportions in "case units" (1 unit = case height ≈ 148mm).
const CASE_H = 1;
const CASE_W = 0.87; // cover width
const CASE_D = 0.085; // spine thickness
const SPINE_PITCH = CASE_D + 0.022; // packed with a hair of gap
const FACE_PITCH = CASE_W + 0.06; // face-out case takes a cover's width
const ROW_CLEAR = 0.34; // headroom above a standing case
const ROW_H = CASE_H + ROW_CLEAR;
const BOARD_T = 0.09;

type Wall = 'back' | 'left' | 'right';
type Orientation = 'spine' | 'face';

interface Placement {
  item: CollectionItem;
  ordinal: number; // watch order, 1-based — the spine's collection number
  wall: Wall;
  row: number;
  offset: number; // along the wall from its left edge (case center)
  orientation: Orientation;
}

interface ClosetLayout {
  roomW: number;
  roomH: number;
  roomD: number;
  /** Y height the camera should frame: the eye-level cluster of cases. */
  focusY: number;
  walls: Record<Wall, { width: number; rows: number; x0: number }>;
  placements: Placement[];
}

function layoutCloset(items: CollectionItem[]): ClosetLayout {
  const roomD = 9.5; // ~1.4m deep — you stand inside
  const roomH = 15.2; // ~2.25m
  const maxRows = 9;
  // Floor-to-ceiling shelving: every wall unit runs the full height, with
  // rows for ~10 blu-rays. A small collection clusters at eye level and
  // grows outward — empty rows above and below are the room to grow.
  const rowsFit = Math.max(4, Math.min(maxRows, Math.floor((roomH - 0.55 - 0.4) / ROW_H)));
  // Eye-level row (cases sit ~1.2-1.3m up) and the fill order around it.
  const centerRow = Math.round(rowsFit * 0.6);
  const rowOrder: number[] = [];
  for (let d = 0; rowOrder.length < rowsFit; d++) {
    if (centerRow - d >= 0) rowOrder.push(centerRow - d);
    if (d > 0 && centerRow + d < rowsFit) rowOrder.push(centerRow + d);
  }
  const ordinalOf = new Map(items.map((it, i) => [it.key, i + 1]));

  // Face-out every 14th case (Criterion closets are dense spines with rare
  // featured covers).
  const isFace = (i: number) => i % 14 === 5;

  const buildWall = (
    wallItems: Array<{ item: CollectionItem; i: number }>,
    minWidth: number,
  ): { width: number; rows: number; placements: Array<Omit<Placement, 'wall'>> } => {
    // How much wall width does the run need?
    let need = 0;
    for (const { i } of wallItems) need += isFace(i) ? FACE_PITCH : SPINE_PITCH;

    let usable = Math.max(minWidth - 1.0, 2.5);
    let rowsNeeded = Math.max(1, Math.ceil(need / usable));
    if (rowsNeeded > rowsFit) {
      // Would overflow the wall: widen it instead of growing past the ceiling.
      rowsNeeded = rowsFit;
      usable = Math.max(usable, need / rowsFit);
    }
    const width = usable + 1.0;

    const placements: Array<Omit<Placement, 'wall'>> = [];
    let slot = 0; // which row in the fill order we are on
    let cursor = 0.5;
    for (const { item, i } of wallItems) {
      const face = isFace(i);
      const pitch = face ? FACE_PITCH : SPINE_PITCH;
      if (cursor + pitch > width - 0.4 && placements.length > 0) {
        slot += 1;
        cursor = 0.5;
      }
      placements.push({
        item,
        ordinal: ordinalOf.get(item.key) ?? placements.length + 1,
        row: rowOrder[Math.min(slot, rowOrder.length - 1)],
        offset: cursor + pitch / 2,
        orientation: face ? 'face' : 'spine',
      });
      cursor += pitch;
    }
    return { width, rows: rowsFit, placements };
  };

  // The back wall carries the collection until it has more than ~3 rows of
  // spines, then the side walls get shelving too.
  const useSides = items.length > 34;
  const backCountReal = useSides ? Math.round(items.length * 0.55) : items.length;
  const indexed = items.map((item, i) => ({ item, i }));
  const back = buildWall(indexed.slice(0, backCountReal), 5.6);
  const rest = indexed.slice(backCountReal);

  let left: ReturnType<typeof buildWall> | null = null;
  let right: ReturnType<typeof buildWall> | null = null;
  if (useSides && rest.length > 0) {
    const mid = Math.ceil(rest.length / 2);
    left = buildWall(rest.slice(0, mid), 4.5);
    right = buildWall(rest.slice(mid), 4.5);
  }

  const sideWidth = left?.width ?? 3.2;
  const roomW = Math.max(back.width + 2 * Math.min(sideWidth, 5.2), 7.5);

  const placements: Placement[] = [
    ...back.placements.map((p) => ({ ...p, wall: 'back' as Wall })),
    ...(left?.placements.map((p) => ({ ...p, wall: 'left' as Wall })) ?? []),
    ...(right?.placements.map((p) => ({ ...p, wall: 'right' as Wall })) ?? []),
  ];

  return {
    roomW,
    roomH,
    roomD,
    focusY: 0.55 + BOARD_T + centerRow * ROW_H + CASE_H / 2,
    walls: {
      back: { width: back.width, rows: back.rows, x0: -back.width / 2 },
      left: left ? { width: left.width, rows: left.rows, x0: -(left.width / 2) } : { width: 0, rows: 0, x0: 0 },
      right: right ? { width: right.width, rows: right.rows, x0: -(right.width / 2) } : { width: 0, rows: 0, x0: 0 },
    },
    placements,
  };
}

/** World transform for a placement: position + shelf-facing rotation. */
function placementTransform(p: Placement, layout: ClosetLayout) {
  const wall = layout.walls[p.wall];
  // Shelves sit on wall rows starting 0.55 above the floor.
  const rowY = 0.55 + BOARD_T + p.row * ROW_H + CASE_H / 2;
  const along = wall.x0 + p.offset;
  // A spine-out case is rotated, so its extent along the wall normal is the
  // cover width; a face-out case is thin. Keep the case just clear of the
  // wall so it never intersects the woodwork.
  const clearSpine = CASE_W / 2 + 0.03;
  const clearFace = CASE_D / 2 + 0.03;

  if (p.wall === 'back') {
    const z = -layout.roomD / 2 + (p.orientation === 'spine' ? clearSpine : clearFace);
    return {
      position: new THREE.Vector3(along, rowY, z),
      // spine toward the room (+z): local +x -> world +z
      rotationY: p.orientation === 'spine' ? -Math.PI / 2 : 0,
      out: new THREE.Vector3(0, 0, 1),
    };
  }
  if (p.wall === 'left') {
    const x = -layout.roomW / 2 + (p.orientation === 'spine' ? clearSpine : clearFace);
    // wall runs along z; offset from the back toward the door
    const z = -layout.roomD / 2 + 0.7 + p.offset;
    return {
      position: new THREE.Vector3(x, rowY, z),
      // spine toward the room (+x): local +x -> world +x
      rotationY: p.orientation === 'spine' ? 0 : Math.PI / 2,
      out: new THREE.Vector3(1, 0, 0),
    };
  }
  const x = layout.roomW / 2 - (p.orientation === 'spine' ? clearSpine : clearFace);
  const z = -layout.roomD / 2 + 0.7 + p.offset;
  return {
    position: new THREE.Vector3(x, rowY, z),
    // spine toward the room (-x): local +x -> world -x
    rotationY: p.orientation === 'spine' ? Math.PI : -Math.PI / 2,
    out: new THREE.Vector3(-1, 0, 0),
  };
}

export function CupboardPage() {
  const { library, libraryLoading, libraryError } = useApp();
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<CollectionItem | null>(null);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      setWebgl(Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')));
    } catch {
      setWebgl(false);
    }
  }, []);

  const collection = useMemo(() => toCollection(library), [library]);
  const layout = useMemo(() => layoutCloset(collection), [collection]);

  return (
    <div className={`page cupboard-page ${selected ? 'has-selection' : ''}`}>
      <div className="page-head">
        <h1>The Closet</h1>
        <p className="page-sub">
          {collection.length === 0
            ? 'Your closet is waiting.'
            : `${collection.length} case${collection.length === 1 ? '' : 's'} — drag to look around, hover to pull a spine, click to take it off the shelf.`}
        </p>
      </div>

      {libraryError ? <div className="alert alert-error">{libraryError}</div> : null}
      {libraryLoading && library.length === 0 ? <div className="loading">Loading collection…</div> : null}

      {collection.length === 0 && !libraryLoading ? (
        <div className="empty cupboard-empty">
          <div className="cupboard-empty-art" style={{ background: coverCss('cinphile-empty') }} />
          <p>
            Nothing on the shelf yet. <Link to="/">Mark something watched</Link> and its blu-ray
            case appears here.
          </p>
        </div>
      ) : null}

      {collection.length > 0 && webgl === false ? (
        <div className="alert alert-info">
          WebGL isn’t available in this browser — showing the flat shelf instead.
        </div>
      ) : null}

      {collection.length > 0 && webgl ? (
        <div
          className="cupboard-canvas-wrap"
          role="img"
          aria-label="Criterion-style closet with your watched movies and series as blu-ray cases"
        >
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{
              fov: 55,
              position: [0, layout.focusY + 1.8, -layout.roomD / 2 + 5.4],
              near: 0.05,
              far: 60,
            }}
            gl={{ antialias: true }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.15;
            }}
          >
            <ClosetScene layout={layout} selected={selected} onSelect={setSelected} />
          </Canvas>
        </div>
      ) : null}

      {collection.length > 0 && !webgl ? (
        <FlatShelf items={collection} onSelect={setSelected} />
      ) : null}

      {selected ? <CasePanel item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function useCanvasTexture(draw: (canvas: HTMLCanvasElement) => HTMLCanvasElement, w: number, h: number, deps: unknown[]) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function ClosetScene({
  layout,
  selected,
  onSelect,
}: {
  layout: ClosetLayout;
  selected: CollectionItem | null;
  onSelect: (item: CollectionItem | null) => void;
}) {
  const { scene } = useThree();
  const woodWarm = useCanvasTexture((c) => drawWoodCanvas(c, { tone: 'warm', seed: 'walls' }), 512, 512, []);
  const woodDark = useCanvasTexture((c) => drawWoodCanvas(c, { tone: 'dark', seed: 'shelves' }), 512, 512, []);
  const woodFloor = useCanvasTexture((c) => drawWoodCanvas(c, { tone: 'floor', plank: true, seed: 'floor' }), 512, 512, []);

  useEffect(() => {
    scene.fog = new THREE.Fog('#1a120a', 12, 26);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  const { roomW, roomH, roomD } = layout;

  const wallTexture = (t: THREE.Texture, repeatX: number, repeatY: number) => {
    const clone = t.clone();
    clone.needsUpdate = true;
    clone.wrapS = THREE.RepeatWrapping;
    clone.wrapT = THREE.RepeatWrapping;
    clone.repeat.set(repeatX, repeatY);
    return clone;
  };

  return (
    <>
      <ambientLight color="#ffdfb8" intensity={0.5} />
      <hemisphereLight color="#ffd9a8" groundColor="#2a1a0c" intensity={0.55} />
      {/* warm ceiling bulbs */}
      <pointLight
        position={[0, roomH - 1.2, -roomD / 2 + 1.6]}
        color="#ffc98a"
        intensity={40}
        distance={16}
        decay={2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />
      <pointLight position={[0, roomH - 1.2, roomD / 2 - 1.4]} color="#ffd9a8" intensity={22} distance={14} decay={2} />
      <pointLight position={[-roomW / 2 + 0.8, roomH - 1.4, 0]} color="#ffb877" intensity={12} distance={10} decay={2} />
      <pointLight position={[roomW / 2 - 0.8, roomH - 1.4, 0]} color="#ffb877" intensity={12} distance={10} decay={2} />
      {/* soft key from the door for shelf shadowing */}
      <directionalLight
        position={[0, roomH - 1.5, roomD / 2]}
        intensity={0.5}
        color="#fff1dd"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />

      <group>

        {/* floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial map={wallTexture(woodFloor, roomW / 4, roomD / 4)} roughness={0.85} />
        </mesh>
        {/* ceiling */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, roomH, 0]}>
          <planeGeometry args={[roomW, roomD]} />
          <meshStandardMaterial color="#3a2413" roughness={0.95} />
        </mesh>
        {/* back wall */}
        <mesh position={[0, roomH / 2, -roomD / 2]} receiveShadow>
          <planeGeometry args={[roomW, roomH]} />
          <meshStandardMaterial map={wallTexture(woodWarm, roomW / 5, roomH / 5)} roughness={0.9} />
        </mesh>
        {/* left / right walls */}
        <mesh rotation={[0, Math.PI / 2, 0]} position={[-roomW / 2, roomH / 2, 0]} receiveShadow>
          <planeGeometry args={[roomD, roomH]} />
          <meshStandardMaterial map={wallTexture(woodWarm, roomD / 5, roomH / 5)} roughness={0.9} />
        </mesh>
        <mesh rotation={[0, -Math.PI / 2, 0]} position={[roomW / 2, roomH / 2, 0]} receiveShadow>
          <planeGeometry args={[roomD, roomH]} />
          <meshStandardMaterial map={wallTexture(woodWarm, roomD / 5, roomH / 5)} roughness={0.9} />
        </mesh>

        <Shelving layout={layout} woodDark={woodDark} woodWarm={woodWarm} />
        <DustMotes roomW={roomW} roomH={roomH} roomD={roomD} />

        {layout.placements.map((p) => (
          <Case
            key={p.item.key}
            placement={p}
            layout={layout}
            selected={selected?.key === p.item.key}
            onSelect={() => onSelect(selected?.key === p.item.key ? null : p.item)}
          />
        ))}
      </group>

      <OrbitControls
        target={[0, layout.focusY, -layout.roomD / 2 + 0.5]}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.2}
        maxDistance={layout.roomD * 0.92}
        maxPolarAngle={Math.PI / 2 - 0.06}
      />
    </>
  );
}

function Shelving({ layout, woodDark, woodWarm }: { layout: ClosetLayout; woodDark: THREE.Texture; woodWarm: THREE.Texture }) {
  const { roomW, roomH, roomD, walls } = layout;
  const boards: React.ReactNode[] = [];
  const boardMat = (t: THREE.Texture) => {
    const clone = t.clone();
    clone.needsUpdate = true;
    clone.wrapS = THREE.RepeatWrapping;
    clone.wrapT = THREE.RepeatWrapping;
    return clone;
  };

  const build = (wall: Wall) => {
    const w = walls[wall];
    if (w.width <= 0 || w.rows <= 0) return;
    const totalH = w.rows * ROW_H + BOARD_T;
    if (totalH > roomH - 0.3) return; // safety: never poke through the ceiling
    for (let r = 0; r <= w.rows; r++) {
      const y = 0.55 + r * ROW_H + BOARD_T / 2;
      const key = `${wall}-board-${r}`;
      if (wall === 'back') {
        boards.push(
          <mesh key={key} position={[0, y, -roomD / 2 + 0.5]} castShadow receiveShadow>
            <boxGeometry args={[w.width, BOARD_T, 1.05]} />
            <meshStandardMaterial map={boardMat(woodDark)} roughness={0.7} />
          </mesh>,
        );
      } else {
        const x = wall === 'left' ? -roomW / 2 + 0.5 : roomW / 2 - 0.5;
        boards.push(
          <mesh key={key} position={[x, y, -roomD / 2 + 0.7 + w.width / 2]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w.width, BOARD_T, 1.05]} />
            <meshStandardMaterial map={boardMat(woodDark)} roughness={0.7} />
          </mesh>,
        );
      }
    }
    // vertical side supports
    for (const side of [-1, 1]) {
      const key = `${wall}-post-${side}`;
      if (wall === 'back') {
        boards.push(
          <mesh key={key} position={[side * (w.width / 2), 0.55 + totalH / 2, -roomD / 2 + 0.5]} castShadow receiveShadow>
            <boxGeometry args={[0.14, totalH, 1.0]} />
            <meshStandardMaterial map={boardMat(woodWarm)} roughness={0.75} />
          </mesh>,
        );
      } else {
        const x = wall === 'left' ? -roomW / 2 + 0.5 : roomW / 2 - 0.5;
        boards.push(
          <mesh
            key={key}
            position={[x, 0.55 + totalH / 2, -roomD / 2 + 0.7 + w.width / 2 + side * (w.width / 2)]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1.0, totalH, 0.14]} />
            <meshStandardMaterial map={boardMat(woodWarm)} roughness={0.75} />
          </mesh>,
        );
      }
    }
  };

  build('back');
  build('left');
  build('right');
  return <group>{boards}</group>;
}

function Case({
  placement,
  layout,
  selected,
  onSelect,
}: {
  placement: Placement;
  layout: ClosetLayout;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const { item, ordinal } = placement;
  const { camera } = useThree();

  const { position, rotationY, out } = useMemo(
    () => placementTransform(placement, layout),
    [placement, layout],
  );

  const posterUrl = tmdbImageUrl(item.poster_path, 'w342');
  const [dominant, setDominant] = useState<string | null>(null);

  useEffect(() => {
    if (!posterUrl) return;
    let cancelled = false;
    extractDominantColor(posterUrl).then((c) => {
      if (!cancelled) setDominant(c);
    });
    return () => {
      cancelled = true;
    };
  }, [posterUrl]);

  const coverTexture = useTextureWithFallback(posterUrl, item.title, item.year);
  const spineTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 760;
    drawSpineCanvas(canvas, item.title, item.year, ordinal, dominant);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [item.title, item.year, ordinal, dominant]);
  useEffect(() => () => spineTexture.dispose(), [spineTexture]);

  const materials = useMemo(() => {
    const plastic = new THREE.MeshStandardMaterial({ color: '#191b20', roughness: 0.55, metalness: 0.2 });
    const cover = new THREE.MeshStandardMaterial({ map: coverTexture, roughness: 0.35, metalness: 0.05 });
    const spine = new THREE.MeshStandardMaterial({
      map: spineTexture,
      roughness: 0.5,
      metalness: 0.05,
      emissive: new THREE.Color('#8a5a2a'),
      emissiveIntensity: 0,
    });
    // BoxGeometry material order: +x, -x, +y, -y, +z, -z
    return { plastic, cover, spine, mats: [spine, plastic, plastic, plastic, cover, plastic] };
  }, [coverTexture, spineTexture]);
  useEffect(
    () => () => {
      materials.plastic.dispose();
      materials.cover.dispose();
      materials.spine.dispose();
    },
    [materials],
  );

  // organic jitter: a few spines lean slightly, sit a touch forward
  const jitter = useMemo(() => {
    let h = 0;
    for (const ch of item.key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return {
      lean: ((h % 100) / 100 - 0.5) * 0.14,
      forward: ((h >> 7) % 100) / 100 * 0.08,
    };
  }, [item.key]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    // The outer group holds the shelf position + facing rotation; the inner
    // group only animates the pull-out offset (along the local spine axis,
    // +x) and a small presentation rotation on top of it.
    const pull = selected ? 1.5 : hovered ? 0.45 : jitter.forward;
    g.position.x = THREE.MathUtils.damp(g.position.x, pull, 7, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, 0, 7, delta);
    g.position.z = THREE.MathUtils.damp(g.position.z, 0, 7, delta);

    // Inner rotation is a DELTA on top of the outer group's rotationY.
    let target = placement.orientation === 'spine' ? jitter.lean * 0.2 : 0;
    if (selected) {
      // turn the cover toward the camera, like taking the case off the shelf
      const dx = camera.position.x - position.x;
      const dz = camera.position.z - position.z;
      target = Math.atan2(dx, dz) - rotationY;
    }
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target, 6, delta);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, selected ? -0.06 : jitter.lean, 6, delta);

    // warm rim on the spine when hovered
    materials.spine.emissiveIntensity = THREE.MathUtils.damp(
      materials.spine.emissiveIntensity,
      hovered || selected ? 0.55 : 0,
      8,
      delta,
    );
    void state;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <mesh castShadow receiveShadow material={materials.mats}>
          <boxGeometry args={[CASE_W, CASE_H, CASE_D]} />
        </mesh>
      </group>

      {hovered && !selected ? (
        <Html position={[out.x * 0.3, CASE_H / 2 + 0.32, out.z * 0.3]} center distanceFactor={6} zIndexRange={[50, 0]}>
          <div className="case-tooltip" role="tooltip">
            <strong>{item.title}</strong>
            <span>
              {item.year ?? ''} · ★ {item.rating ?? '—'} · {formatWatchedDate(item.lastWatchedAt)}
            </span>
          </div>
        </Html>
      ) : null}
    </group>
  );
}

/** Cover texture: TMDB art when it loads, generated sleeve as the fallback. */
function useTextureWithFallback(posterUrl: string | null, title: string, year: number | null) {
  const fallback = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 540;
    drawCoverCanvas(canvas, title, year);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [title, year]);

  const [texture, setTexture] = useState<THREE.Texture>(fallback);

  useEffect(() => {
    if (!posterUrl) {
      setTexture(fallback);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      posterUrl,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        setTexture(tex);
      },
      undefined,
      () => {
        /* keep the generated fallback cover */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [posterUrl, fallback]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function DustMotes({ roomW, roomH, roomD }: { roomW: number; roomH: number; roomD: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, seeds } = useMemo(() => {
    const count = 90;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (roomW - 1);
      positions[i * 3 + 1] = Math.random() * (roomH - 1) + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (roomD - 1);
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, seeds };
  }, [roomW, roomH, roomD]);

  const sprite = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 220, 170, 0.9)');
      grad.addColorStop(1, 'rgba(255, 220, 170, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => () => sprite.dispose(), [sprite]);

  useFrame((state) => {
    const points = ref.current;
    if (!points) return;
    const attr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < seeds.length; i++) {
      attr.setY(i, attr.getY(i) + Math.sin(t * 0.4 + seeds[i]) * 0.0015 + 0.0008);
      attr.setX(i, attr.getX(i) + Math.cos(t * 0.3 + seeds[i] * 2) * 0.0012);
      if (attr.getY(i) > roomH - 0.5) attr.setY(i, 0.5);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.16}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// ---------------------------------------------------------------------------

function FlatShelf({ items, onSelect }: { items: CollectionItem[]; onSelect: (i: CollectionItem) => void }) {
  return (
    <div className="flat-shelf">
      {items.map((item) => (
        <button key={item.key} className="flat-case" onClick={() => onSelect(item)}>
          <div className="flat-case-art" style={{ background: coverCss(item.title) }}>
            <span>{item.title}</span>
          </div>
          <span className="flat-case-year">{item.year ?? ''}</span>
        </button>
      ))}
    </div>
  );
}

function CasePanel({ item, onClose }: { item: CollectionItem; onClose: () => void }) {
  const posterUrl = tmdbImageUrl(item.poster_path, 'w342');
  const [failed, setFailed] = useState(false);
  return (
    <aside className="case-panel" aria-label="Case details">
      <button className="case-panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="case-panel-art">
        {posterUrl && !failed ? (
          <img src={posterUrl} alt={item.title} onError={() => setFailed(true)} />
        ) : (
          <div className="poster-fallback" style={{ background: coverCss(item.title) }}>
            <span className="poster-fallback-title">{item.title}</span>
            {item.year ? <span className="poster-fallback-year">{item.year}</span> : null}
          </div>
        )}
      </div>
      <h2>{item.title}</h2>
      <dl className="case-panel-meta">
        <div>
          <dt>Year</dt>
          <dd>{item.year ?? '—'}</dd>
        </div>
        <div>
          <dt>{item.type === 'tv' ? 'Episodes watched' : 'Watched'}</dt>
          <dd>{item.type === 'tv' ? item.episodeCount : formatWatchedDate(item.lastWatchedAt)}</dd>
        </div>
        <div>
          <dt>{item.type === 'tv' ? 'Last watched' : 'Rating'}</dt>
          <dd>
            {item.type === 'tv'
              ? formatWatchedDate(item.lastWatchedAt)
              : item.rating
                ? `★ ${item.rating}/10`
                : '—'}
          </dd>
        </div>
        {item.type === 'tv' ? (
          <div>
            <dt>Rating</dt>
            <dd>{item.rating ? `★ ${item.rating}/10` : '—'}</dd>
          </div>
        ) : null}
      </dl>
      <Link className="btn btn-primary" to={item.type === 'movie' ? `/movie/${item.tmdb_id}` : `/tv/${item.tmdb_id}`}>
        Open details
      </Link>
    </aside>
  );
}
