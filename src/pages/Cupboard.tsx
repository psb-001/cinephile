import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useApp } from '../AppContext.js';
import { coverCss } from '../lib/covers.js';
import { drawCoverCanvas } from '../lib/covers.js';
import { formatWatchedDate, tmdbImageUrl, toCollection } from '../types.js';
import type { CollectionItem } from '../types.js';

// Case + shelf proportions (blu-ray-ish, poster aspect).
const CASE_W = 0.72;
const CASE_H = 1.08;
const CASE_D = 0.09;
const GAP = 0.05;
const PER_SHELF = 12;
const BOARD_T = 0.07;
const BOARD_D = 0.6;
const SHELF_CLEAR = 0.14;
const SIDE_T = 0.09;

const rowWidth = PER_SHELF * CASE_W + (PER_SHELF - 1) * GAP;
const innerWidth = rowWidth + 0.16;
const rowHeight = CASE_H + SHELF_CLEAR + BOARD_T;

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
  const shelfCount = Math.max(1, Math.ceil(collection.length / PER_SHELF));
  const totalHeight = shelfCount * rowHeight + BOARD_T;

  return (
    <div className={`page cupboard-page ${selected ? 'has-selection' : ''}`}>
      <div className="page-head">
        <h1>Cupboard</h1>
        <p className="page-sub">
          {collection.length === 0
            ? 'Your shelf is waiting.'
            : `${collection.length} case${collection.length === 1 ? '' : 's'} on ${shelfCount === 1 ? '1 shelf' : `${shelfCount} shelves`} — drag to orbit, scroll to zoom, click a case.`}
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
          aria-label="3D cupboard shelf with your watched movies and series as blu-ray cases"
        >
          <Canvas
            shadows
            dpr={[1, 2]}
            camera={{
              fov: 42,
              position: [0, totalHeight * 0.55 + 0.6, Math.max(7.5, rowWidth * 0.72)],
              near: 0.1,
              far: 100,
            }}
            gl={{ antialias: true }}
          >
            <color attach="background" args={['#0b0e14']} />
            <fog attach="fog" args={['#0b0e14', 14, 34]} />
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[5, totalHeight + 4, 7]}
              intensity={1.15}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-left={-12}
              shadow-camera-right={12}
              shadow-camera-top={12}
              shadow-camera-bottom={-12}
            />
            <pointLight position={[0, totalHeight * 0.6, 4]} intensity={18} color="#ffd9a0" distance={14} decay={2} />

            <Bookcase shelfCount={shelfCount}>
              {collection.map((item, i) => (
                <Case
                  key={item.key}
                  item={item}
                  index={i}
                  selected={selected?.key === item.key}
                  onSelect={() => setSelected(selected?.key === item.key ? null : item)}
                />
              ))}
            </Bookcase>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
              <planeGeometry args={[80, 80]} />
              <meshStandardMaterial color="#10131a" roughness={0.95} />
            </mesh>

            <OrbitControls
              target={[0, totalHeight * 0.5, 0]}
              enableDamping
              dampingFactor={0.08}
              minDistance={1.5}
              maxDistance={30}
              maxPolarAngle={Math.PI / 2 - 0.04}
              enablePan
            />
          </Canvas>
        </div>
      ) : null}

      {collection.length > 0 && !webgl ? <FlatShelf items={collection} onSelect={setSelected} /> : null}

      {selected ? <CasePanel item={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Bookcase({ shelfCount, children }: { shelfCount: number; children: React.ReactNode }) {
  const totalHeight = shelfCount * rowHeight + BOARD_T;
  const wood = '#7a5230';
  const woodDark = '#5d3d23';

  return (
    <group>
      {/* shelf boards (bottom of each row) */}
      {Array.from({ length: shelfCount + 1 }, (_, i) => (
        <mesh key={i} castShadow receiveShadow position={[0, i * rowHeight + BOARD_T / 2, 0]}>
          <boxGeometry args={[innerWidth + SIDE_T * 2, BOARD_T, BOARD_D]} />
          <meshStandardMaterial color={i % 2 === 0 ? wood : woodDark} roughness={0.72} metalness={0.05} />
        </mesh>
      ))}
      {/* side panels */}
      {[-1, 1].map((side) => (
        <mesh key={side} castShadow receiveShadow position={[side * (innerWidth / 2 + SIDE_T / 2), totalHeight / 2, 0]}>
          <boxGeometry args={[SIDE_T, totalHeight, BOARD_D + 0.08]} />
          <meshStandardMaterial color={woodDark} roughness={0.75} metalness={0.05} />
        </mesh>
      ))}
      {/* backboard */}
      <mesh position={[0, totalHeight / 2, -BOARD_D / 2 - 0.02]} receiveShadow>
        <boxGeometry args={[innerWidth + SIDE_T * 2, totalHeight, 0.04]} />
        <meshStandardMaterial color="#4a3018" roughness={0.9} />
      </mesh>
      {/* top cap */}
      <mesh castShadow position={[0, totalHeight + 0.05, 0]}>
        <boxGeometry args={[innerWidth + SIDE_T * 2 + 0.12, 0.1, BOARD_D + 0.16]} />
        <meshStandardMaterial color={wood} roughness={0.65} metalness={0.08} />
      </mesh>
      {children}
    </group>
  );
}

function useCaseTexture(posterUrl: string | null, title: string, year: number | null) {
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
        tex.anisotropy = 4;
        setTexture(tex);
      },
      undefined,
      () => {
        /* network/404: keep the generated fallback cover */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [posterUrl, fallback]);

  return texture;
}

function Case({
  item,
  index,
  selected,
  onSelect,
}: {
  item: CollectionItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const row = Math.floor(index / PER_SHELF);
  const col = index % PER_SHELF;
  const x = -rowWidth / 2 + col * (CASE_W + GAP) + CASE_W / 2;
  const baseY = row * rowHeight + BOARD_T + CASE_H / 2;
  // tiny deterministic lean so rows don't look laser-aligned
  const jitter = useMemo(() => {
    const seed = item.key.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return ((seed % 100) / 100 - 0.5) * 0.045;
  }, [item.key]);

  const posterUrl = tmdbImageUrl(item.poster_path, 'w342');
  const texture = useCaseTexture(posterUrl, item.title, item.year);

  const coverMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0.06 }),
    [texture],
  );
  const plasticMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#14161c', roughness: 0.5, metalness: 0.25 }),
    [],
  );

  useEffect(
    () => () => {
      coverMaterial.dispose();
      plasticMaterial.dispose();
    },
    [coverMaterial, plasticMaterial],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const lift = selected ? 0.34 : hovered ? 0.16 : 0;
    const tilt = selected ? -0.22 : hovered ? -0.1 : 0;
    g.position.z = THREE.MathUtils.damp(g.position.z, lift, 8, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, tilt, 8, delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, jitter, 8, delta);
    const s = selected ? 1.06 : hovered ? 1.03 : 1;
    g.scale.x = THREE.MathUtils.damp(g.scale.x, s, 8, delta);
    g.scale.y = THREE.MathUtils.damp(g.scale.y, s, 8, delta);
    g.scale.z = THREE.MathUtils.damp(g.scale.z, s, 8, delta);
    void state;
  });

  return (
    <group position={[x, baseY, 0]}>
      <group
        ref={group}
        rotation={[0, jitter, 0]}
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
        {/* case body: front face gets the cover */}
        <mesh castShadow receiveShadow material={[plasticMaterial, plasticMaterial, plasticMaterial, plasticMaterial, coverMaterial, plasticMaterial]}>
          <boxGeometry args={[CASE_W, CASE_H, CASE_D]} />
        </mesh>
      </group>

      {hovered ? (
        <Html position={[0, CASE_H / 2 + 0.28, 0.2]} center distanceFactor={7} zIndexRange={[50, 0]}>
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
