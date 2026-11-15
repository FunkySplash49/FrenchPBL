import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GameFrame, Card, Debrief, useT, haptic } from '../kit';
import { initial, apply, aiMove, movesFrom, N, isCorner, isThrone } from './tafl/rules';
import './Tafl.css';

/*
 * Hnefatafl → "Tafl d'Alésia", on a low-poly 3D board (three.js).
 * Vercingétorix (king) + Gaul defenders in the centre, Roman attackers around: the siege as a board game.
 * Tap/click a piece then a target. Drag to orbit the camera. Keyboard: arrows move the cursor, Enter selects.
 */
const AI_DELAY = 480;
const pos = (r, c) => new THREE.Vector3(c - (N - 1) / 2, 0, r - (N - 1) / 2);
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function cssColor(el, name) { return new THREE.Color(getComputedStyle(el).getPropertyValue(name).trim()); }

function buildScene(host) {
  const col = (n) => cssColor(host, n);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(col('--ink-900'), 16, 34);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 9.5, 9.5);

  // sunset light
  scene.add(new THREE.HemisphereLight(col('--amber-300'), col('--ink-950'), 0.9));
  const sun = new THREE.DirectionalLight(col('--ember-400'), 2.4);
  sun.position.set(-9, 7, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(col('--gold-200'), 0.5);
  rim.position.set(6, 4, -8);
  scene.add(rim);

  const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, ...extra });

  // low-poly terrain around the board (Mont-Auxois style hills)
  const terrainGeo = new THREE.PlaneGeometry(44, 44, 26, 26);
  terrainGeo.rotateX(-Math.PI / 2);
  const p = terrainGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); const z = p.getZ(i); const d = Math.hypot(x, z);
    const h = d < 7.5 ? -0.6 : (Math.sin(x * 0.45) + Math.cos(z * 0.38)) * 0.6 + (d - 7.5) * 0.12 + (Math.random() - 0.5) * 0.5;
    p.setY(i, h - 0.4);
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, flat(col('--ink-700')));
  terrain.receiveShadow = true;
  scene.add(terrain);

  // a few low-poly trees and the far Roman palisade ring
  const treeMat = flat(col('--ink-800'));
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2; const r = 8.5 + Math.random() * 10;
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.5 + Math.random() * 0.4, 1.4 + Math.random(), 5), treeMat);
    tree.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
    tree.castShadow = true;
    scene.add(tree);
  }
  const wallMat = flat(col('--rome-600'));
  for (let i = 0; i < 60; i++) {
    if (i % 12 === 0) continue; // gaps
    const a = (i / 60) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.15), wallMat);
    post.position.set(Math.cos(a) * 12, -0.1, Math.sin(a) * 12);
    post.lookAt(0, 0, 0);
    post.castShadow = true;
    scene.add(post);
  }

  // board
  const board = new THREE.Group();
  scene.add(board);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.5, 0.5, 8), flat(col('--ink-900')));
  slab.position.y = -0.35; slab.rotation.y = Math.PI / 8; slab.receiveShadow = true;
  board.add(slab);
  const tiles = [];
  const tileA = flat(col('--ink-700')); const tileB = flat(col('--ink-800'));
  const tileCorner = flat(col('--gold-400'), { emissive: col('--gold-400'), emissiveIntensity: 0.15 });
  const tileThrone = flat(col('--clay-600'));
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const h = 0.16 + Math.random() * 0.04;
    const mat = isCorner(r, c) ? tileCorner : isThrone(r, c) ? tileThrone : (r + c) % 2 ? tileA : tileB;
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.94, h, 0.94), mat);
    tile.position.copy(pos(r, c)); tile.position.y = -0.1 + h / 2;
    tile.receiveShadow = true;
    tile.userData = { r, c };
    board.add(tile); tiles.push(tile);
  }

  // markers (legal moves, cursor, selection)
  const markGeo = new THREE.CircleGeometry(0.16, 12); markGeo.rotateX(-Math.PI / 2);
  const markMat = new THREE.MeshBasicMaterial({ color: col('--gold-200'), transparent: true, opacity: 0.85 });
  const cursorGeo = new THREE.RingGeometry(0.38, 0.46, 4, 1, Math.PI / 4); cursorGeo.rotateX(-Math.PI / 2);
  const cursor = new THREE.Mesh(cursorGeo, new THREE.MeshBasicMaterial({ color: col('--gold-400') }));
  cursor.visible = false; board.add(cursor);

  const materials = {
    gaul: flat(col('--gaul-600')), gaulTop: flat(col('--gaul-400')),
    rome: flat(col('--rome-600')), romeLight: flat(col('--rome-400')),
    gold: flat(col('--gold-400'), { metalness: 0.5, roughness: 0.4 }),
  };

  const makePiece = (type) => {
    const g = new THREE.Group();
    if (type === 'R') {
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.18), materials.rome);
      shield.position.y = 0.3; shield.castShadow = true; g.add(shield);
      const boss = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), materials.gold);
      boss.position.set(0, 0.32, 0.1); g.add(boss);
      const rimTop = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.2), materials.romeLight);
      rimTop.position.y = 0.62; g.add(rimTop);
    } else {
      const king = type === 'K';
      const body = new THREE.Mesh(new THREE.CylinderGeometry(king ? 0.3 : 0.26, king ? 0.36 : 0.32, king ? 0.85 : 0.5, 7), materials.gaul);
      body.position.y = king ? 0.42 : 0.25; body.castShadow = true; g.add(body);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(king ? 0.22 : 0.18, king ? 0.3 : 0.26, 0.08, 7), materials.gaulTop);
      top.position.y = king ? 0.88 : 0.53; g.add(top);
      if (king) {
        const torque = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 10, Math.PI * 1.6), materials.gold);
        torque.rotation.x = Math.PI / 2; torque.rotation.z = Math.PI * 0.7; torque.position.y = 0.72; g.add(torque);
        const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), materials.gold);
        crown.position.y = 1.05; g.add(crown);
      }
    }
    g.userData.type = type;
    return g;
  };

  return { renderer, scene, camera, board, tiles, cursor, markGeo, markMat, makePiece, dispose: () => {
    scene.traverse((o) => { o.geometry?.dispose?.(); });
    Object.values(materials).forEach((m) => m.dispose());
    [tileA, tileB, tileCorner, tileThrone, markMat, treeMat, wallMat].forEach((m) => m.dispose());
    renderer.dispose();
    renderer.domElement.remove();
  } };
}

export default function Tafl() {
  const t = useT();
  const hostRef = useRef(null);
  const three = useRef(null);
  const [mode, setMode] = useState(null); // 'G' (you play Gauls) | 'R' | 'both'
  const [state, setState] = useState(initial);
  const [sel, setSel] = useState(null);
  const [cur, setCur] = useState([4, 4]);
  const [thinking, setThinking] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const stateRef = useRef(state); stateRef.current = state;

  const human = (turn) => mode === 'both' || mode === turn;

  // ── scene lifecycle ──
  useEffect(() => {
    if (!mode) return undefined;
    const host = hostRef.current;
    let S;
    try { S = buildScene(host); } catch { setWebgl(false); return undefined; }
    three.current = { ...S, pieces: new Map(), marks: [], anim: [] };
    const { renderer, scene, camera } = S;
    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enablePan: false, enableDamping: true, minDistance: 7, maxDistance: 16, minPolarAngle: 0.35, maxPolarAngle: 1.2 });
    controls.target.set(0, 0, 0.6);
    if (mode === 'R') camera.position.set(0, 9.5, -9.5);

    const resize = () => {
      const w = host.clientWidth; const h = host.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      // keep the whole board in view on narrow (portrait phone) screens
      const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      const need = Math.max(13.4, 6.3 / Math.tan(hfov / 2));
      controls.maxDistance = need + 3; controls.minDistance = Math.min(7, need - 4);
      const dir = camera.aspect < 1
        ? new THREE.Vector3(0, 2.2, mode === 'R' ? -1 : 1).normalize()
        : camera.position.clone().sub(controls.target).normalize();
      const fit = camera.aspect < 1 ? need * 0.86 : need;
      camera.position.copy(controls.target).addScaledVector(dir, fit);
      scene.fog.near = fit + 4; scene.fog.far = fit + 24;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(host);
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(host);

    let raf; let last = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const T = three.current;
      // tween pieces toward their targets
      for (const [, m] of T.pieces) {
        const tgt = m.userData.target;
        if (tgt) {
          m.position.lerp(tgt, reduced() ? 1 : 1 - Math.pow(0.0005, dt));
          const lift = m.userData.selected ? 0.25 : 0;
          m.position.y += ((lift + Math.max(0, 0.6 * Math.sin(Math.PI * Math.min(1, m.position.distanceTo(tgt) / 2)))) - m.position.y) * 0.25;
        }
      }
      T.anim = T.anim.filter((a) => {
        a.t += dt; a.mesh.position.y = -a.t * 1.6; a.mesh.rotation.z += dt * 3;
        if (a.t > 0.6) { T.board.remove(a.mesh); return false; }
        return true;
      });
      controls.update();
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    // tap vs drag
    let down = null;
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) { down = null; return; }
      down = null;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(S.board.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && o.userData.r === undefined && o.parent) o = o.parent;
        if (o && o.userData.r !== undefined) { window.dispatchEvent(new CustomEvent('tafl-tap', { detail: [o.userData.r, o.userData.c] })); return; }
      }
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      S.dispose(); three.current = null;
    };
  }, [mode]);

  // ── sync pieces with the board state ──
  useEffect(() => {
    const T = three.current;
    if (!T) return;
    const seen = new Set();
    const b = state.board;
    // move the piece that moved (keep identity for animation)
    if (state.last) {
      const key = `${state.last.from[0]},${state.last.from[1]}`;
      const m = T.pieces.get(key);
      if (m) { T.pieces.delete(key); T.pieces.set(`${state.last.to[0]},${state.last.to[1]}`, m); }
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const p = b[r][c]; const key = `${r},${c}`;
      if (p === '.') continue;
      seen.add(key);
      let m = T.pieces.get(key);
      if (!m || m.userData.type !== p) {
        m = T.makePiece(p); m.position.copy(pos(r, c)); T.board.add(m); T.pieces.set(key, m);
      }
      m.userData.r = r; m.userData.c = c;
      m.userData.target = pos(r, c);
      m.userData.selected = sel && sel[0] === r && sel[1] === c;
    }
    for (const [key, m] of [...T.pieces]) {
      if (!seen.has(key)) { T.pieces.delete(key); T.anim.push({ mesh: m, t: 0 }); }
    }
    // legal-move markers
    T.marks.forEach((mk) => T.board.remove(mk)); T.marks = [];
    if (sel) for (const [r, c] of movesFrom(b, sel[0], sel[1])) {
      const mk = new THREE.Mesh(T.markGeo, T.markMat); mk.position.copy(pos(r, c)); mk.position.y = 0.12;
      mk.userData = { r, c }; T.board.add(mk); T.marks.push(mk);
    }
    T.cursor.position.copy(pos(cur[0], cur[1])); T.cursor.position.y = 0.13;
  }, [state, sel, cur, mode]);

  // ── input ──
  const tap = (r, c) => {
    const s = stateRef.current;
    if (s.winner || thinking || !human(s.turn)) return;
    const p = s.board[r][c];
    const mine = (s.turn === 'R' && p === 'R') || (s.turn === 'G' && (p === 'G' || p === 'K'));
    if (mine) { setSel([r, c]); setCur([r, c]); haptic('light'); return; }
    if (sel && movesFrom(s.board, sel[0], sel[1]).some(([rr, cc]) => rr === r && cc === c)) {
      const next = apply(s, { from: sel, to: [r, c] });
      setState(next); setSel(null); setCur([r, c]);
      haptic(next.captured.length ? 'success' : 'tick');
    } else { setSel(null); }
  };
  useEffect(() => {
    const h = (e) => tap(e.detail[0], e.detail[1]);
    window.addEventListener('tafl-tap', h);
    return () => window.removeEventListener('tafl-tap', h);
  });

  // ── AI turn ──
  useEffect(() => {
    if (!mode || state.winner || human(state.turn)) return undefined;
    setThinking(true);
    const id = setTimeout(() => {
      const m = aiMove(state);
      if (m) setState(apply(state, m));
      setThinking(false);
    }, AI_DELAY);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode]);

  useEffect(() => { if (state.winner) haptic(human(state.winner) ? 'success' : 'miss'); /* eslint-disable-next-line */ }, [state.winner]);

  const onKey = (e) => {
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (d) {
      e.preventDefault(); e.stopPropagation();
      setCur(([r, c]) => [Math.max(0, Math.min(N - 1, r + d[0])), Math.max(0, Math.min(N - 1, c + d[1]))]);
      if (three.current) three.current.cursor.visible = true;
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); tap(cur[0], cur[1]); }
  };

  const restart = () => { setState(initial()); setSel(null); setThinking(false); };
  const counts = state.board.flat().reduce((a, p) => { a[p] = (a[p] || 0) + 1; return a; }, {});
  const turnLabel = state.turn === 'G' ? t({ fr: 'Gaulois', en: 'Gauls' }) : 'Rome';

  return (
    <GameFrame
      kicker={{ fr: 'Jeu de plateau · inspiré du Hnefatafl · 3D', en: 'Board game · after Hnefatafl · 3D' }}
      title={{ fr: 'Tafl d’Alésia', en: 'Alésia Tafl' }}
      status={mode && (
        <>
          <span className={`gf-pill tf-turn tf-${state.turn}`}>{state.turn === 'G' ? '●' : '■'} {turnLabel}{thinking ? '…' : ''}</span>
          <span className="gf-pill">● {(counts.G || 0) + (counts.K || 0)} · ■ {counts.R || 0}</span>
        </>
      )}
      onRestart={mode ? restart : undefined}
    >
      {!mode ? (
        <Card title={{ fr: 'Le siège, en jeu de plateau', en: 'The siege as a board game' }}>
          <p>{t({ fr: 'Au centre, Vercingétorix (●, couronné) et ses guerriers. Autour, les Romains (■). Les Gaulois gagnent si le roi atteint un coin doré ; Rome gagne si elle entoure le roi sur ses 4 côtés.', en: 'In the centre, Vercingétorix (●, crowned) and his warriors. Around them, the Romans (■). The Gauls win if the king reaches a golden corner; Rome wins by surrounding the king on all 4 sides.' })}</p>
          <p className="gf-simplified">{t({ fr: 'Les pièces se déplacent comme une tour aux échecs. On capture une pièce en la prenant en sandwich. Glissez pour tourner la caméra.', en: 'Pieces move like a chess rook. Capture by sandwiching an enemy piece. Drag to turn the camera.' })}</p>
          <div className="gf-row">
            <button type="button" className="btn-primary" onClick={() => { haptic('light'); setMode('G'); }}>{t({ fr: 'Jouer les Gaulois', en: 'Play the Gauls' })}</button>
            <button type="button" className="gf-btn" onClick={() => { haptic('light'); setMode('R'); }}>{t({ fr: 'Jouer Rome', en: 'Play Rome' })}</button>
            <button type="button" className="gf-btn" onClick={() => { haptic('light'); setMode('both'); }}>{t({ fr: '2 joueurs (la classe contre vous)', en: '2 players (the class vs you)' })}</button>
          </div>
        </Card>
      ) : !webgl ? (
        <Card title={{ fr: '3D indisponible', en: '3D unavailable' }}><p>{t({ fr: 'Ce navigateur ne gère pas WebGL.', en: 'This browser does not support WebGL.' })}</p></Card>
      ) : (
        <div className="tf-wrap">
          <div
            ref={hostRef}
            className="tf-host"
            tabIndex={0}
            role="application"
            aria-label={t({ fr: 'Plateau 3D : flèches pour déplacer le curseur, Entrée pour choisir', en: '3D board: arrows move the cursor, Enter selects' })}
            onKeyDown={onKey}
          />
          {state.winner && (
            <div className="tf-overlay">
              <Card tone={human(state.winner) ? 'is-win' : ''}
                title={state.winner === 'G' ? { fr: 'Vercingétorix s’échappe !', en: 'Vercingétorix escapes!' } : { fr: 'Le roi est encerclé', en: 'The king is surrounded' }}
                action={{ fr: 'Rejouer', en: 'Play again' }} onAction={restart}>
                <p>{state.winner === 'G'
                  ? t({ fr: 'Sur le plateau, oui. En 52 av. J.-C., l’encerclement romain a tenu : Vercingétorix s’est rendu.', en: 'On the board, yes. In 52 BC the Roman ring held: Vercingétorix surrendered.' })
                  : t({ fr: 'Comme à Alésia : l’encerclement a tenu.', en: 'As at Alésia: the ring held.' })}</p>
                <Debrief
                  source={{ fr: 'Le tafl est un vrai jeu de siège, joué en Scandinavie dès l’époque viking (et peut-être inspiré d’un jeu romain, le ludus latrunculorum).', en: 'Tafl is a real siege board game, played in Scandinavia from the Viking age (perhaps inspired by a Roman game, ludus latrunculorum).' }}
                  simplified={{ fr: 'les Gaulois n’ont jamais joué au tafl, et un siège n’est pas un tour par tour : c’est une image du rapport de forces.', en: 'the Gauls never played tafl, and a siege is not turn-based: this is an image of the balance of forces.' }}
                />
              </Card>
            </div>
          )}
        </div>
      )}
    </GameFrame>
  );
}
