import * as THREE from 'three';

/*
 * Superposition & Measurement's 3D scene (the version approved on its test page).
 *
 * A glass Bloch sphere (|0> up, |1> down, |+> at the front of the equator) whose state
 * is a steel arrow ending in a glowing pearl, and four steps the viewer works with
 * directly:
 *
 * 0 · The ground state: drag the arrow and an elastic tether of light pulls it back to
 *     |0>; tap the sphere to measure, and every result counts up on the |0> chip.
 * 1 · The classical limit: the Hadamard gate, drawn in light (a hologram that pours into
 *     the pearl as sparks, a beam along its axis, the path lit ahead, shockwaves on
 *     landing), takes |0> to |+>. Beside it a glass classical bit whose bead can't stop
 *     between its seats; the qubit's arrow rests wherever it is left; tap H to apply it again.
 * 2 · Infinite possibilities: the arrow sweeps the equator; grab the pearl and move it,
 *     and the pole chips read P(0) and P(1).
 * 3 · Collapse: tap the sphere to measure the state set in step 2, with its real odds;
 *     the result counts up on its pole's chip. "Prepare again" sets it up for another measurement.
 *
 * Plain three.js, so the scene stays exactly as approved; the overlay (Superposition.jsx)
 * draws the cards, buttons and hover hints from what this reports.
 */

const R = 1.7;
const CYAN = new THREE.Color('#00f2fe');
const PURPLE = new THREE.Color('#f093fb');
const GOLD = new THREE.Color('#f7b733');
const GREEN = new THREE.Color('#43e97b');
const RED = new THREE.Color('#ff4d6d');
const WHITE = new THREE.Color('#ffffff');
const UP = new THREE.Vector3(0, 1, 0);
const SEAT = 0.85;
const nH = new THREE.Vector3(1, 1, 0).normalize(); // H: half a turn about the axis between |0> and |+>

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
const damp = (k, dt) => 1 - Math.exp(-k * Math.min(dt, 0.1));
const fromAngles = (th, ph) => new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
const thetaOf = (v) => Math.acos(Math.max(-1, Math.min(1, v.y)));
const phiOf = (v) => Math.atan2(v.z, v.x);
const slerpDir = (a, b, k) => {
  const q = new THREE.Quaternion().setFromUnitVectors(a, b);
  return a.clone().applyQuaternion(new THREE.Quaternion().slerp(q, k));
};

// Each step's camera, layout and what is shown.
const LAYOUT = [
  { qx: 0, bx: -6, cam: [[2.8, 1.7, 12.6], [0, 0.1, 0]], show: { sphere: 1 } },
  { qx: 1.5, bx: -2.6, cam: [[0.8, 1.4, 11.8], [-0.4, 0.15, 0]], show: { sphere: 1, bit: 1, holo: 1 } },
  { qx: 0, bx: -6, cam: [[2.4, 1.3, 12.8], [0, 0.1, 0]], show: { sphere: 1 } },
  { qx: 0, bx: -6, cam: [[2.6, 1.0, 13.0], [0, 0.1, 0]], show: { sphere: 1, ripple: 1 } },
];

export function createSuperpositionStory(renderer, { onChange = () => {}, onHover = () => {}, onEvent = () => {} } = {}) {
  const root = new THREE.Group();
  const world = new THREE.Group(); root.add(world);
  const owned = [];
  const own = (x) => { owned.push(x); return x; };

  // a studio for the metal and glass to reflect
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#05070d');
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(7, 3, '#ffffff', 2.4, [0, 6, 4]);
  panel(4, 7, '#00f2fe', 1.7, [-7, 1, 3]);
  panel(4, 7, '#f093fb', 1.7, [7, -1, 3]);
  panel(9, 2, '#ffffff', 0.5, [0, -6, -3]);
  panel(3, 3, '#a9c1ff', 1.0, [1, 2, -7]);
  const envRT = pmrem.fromScene(envScene, 0.035);
  const environment = envRT.texture;
  envScene.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  pmrem.dispose();
  root.add(new THREE.AmbientLight('#ffffff', 0.25));
  const key = new THREE.DirectionalLight('#ffffff', 1.2); key.position.set(3, 5, 6); root.add(key);

  // ── shared looks ──
  const metal = own(new THREE.MeshStandardMaterial({ color: '#e9eef8', metalness: 1, roughness: 0.2, envMap: environment, envMapIntensity: 1.2 }));
  const glassMat = (opacity = 0.16) => own(new THREE.MeshPhysicalMaterial({ color: '#d6f1ff', metalness: 0, roughness: 0.06, transparent: true, opacity, clearcoat: 1, clearcoatRoughness: 0.08, envMap: environment, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide }));
  const additive = (color, opacity = 1) => own(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  const hidden = () => own(new THREE.MeshBasicMaterial({ visible: false }));
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return own(t);
  })();
  const glow = (color, size, parent) => {
    const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    s.scale.setScalar(size); parent.add(s); return s;
  };
  const texCache = new Map();
  function textTex(text, glowColor = '#ffffff', ink = '#ffffff') {
    const k = text + glowColor + ink;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = glowColor; g.shadowBlur = 26; g.fillStyle = ink;
    let size = 150;
    do { g.font = `800 ${size}px Inter, system-ui, sans-serif`; size -= 6; } while (g.measureText(text).width > 450 && size > 40); // fit the plate
    g.fillText(text, 256, 134);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    texCache.set(k, t); return t;
  }
  const rodGeo = own(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true));
  const capGeo = own(new THREE.SphereGeometry(1, 28, 14));
  function rod(r, mat = metal) {
    const o = new THREE.Group();
    const c = new THREE.Mesh(rodGeo, mat), a = new THREE.Mesh(capGeo, mat), b = new THREE.Mesh(capGeo, mat);
    c.scale.set(r, 1, r); a.scale.setScalar(r); b.scale.setScalar(r);
    o.add(c, a, b);
    return { obj: o, len(l) { l = Math.max(l, 1e-4); c.scale.y = l; a.position.y = l / 2; b.position.y = -l / 2; } };
  }
  // a label pinned to a model: the overlay draws it as a liquid-glass chip with
  // the label typeset in KaTeX (see chips() below); here it is just a point
  const plates = [];
  function makePlate(parent, size = 'md') {
    const g = new THREE.Object3D(); parent.add(g);
    const p = { g, tex: '', color: '#ffffff', s: 0, size, set(label, color, x, y, z, k) {
      p.tex = label; p.color = color; p.s = label ? k : 0;
      g.position.set(x, y, z);
    } };
    plates.push(p); return p;
  }

  // ── the qubit: a glass Bloch sphere, no steel on it ──
  const qubitG = new THREE.Group(); world.add(qubitG);
  const sphereG = new THREE.Group(); qubitG.add(sphereG);
  const rimMat = own(new THREE.ShaderMaterial({
    uniforms: { uTop: { value: CYAN.clone() }, uBot: { value: PURPLE.clone() }, uS: { value: 0.85 }, uFlash: { value: 0 }, uFlashC: { value: WHITE.clone() } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = normalize(position).y; gl_Position = projectionMatrix*mv; }',
    // clamped: a dot product a hair over 1 would make pow() NaN
    fragmentShader: 'uniform vec3 uTop; uniform vec3 uBot; uniform float uS; uniform float uFlash; uniform vec3 uFlashC; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(clamp(1.-abs(dot(vN,vV)),0.,1.),2.6); vec3 c = mix(uBot,uTop,smoothstep(-.9,.9,vY)); c = mix(c, uFlashC, uFlash); gl_FragColor = vec4(c, f*(uS+uFlash)); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sphereG.add(new THREE.Mesh(own(new THREE.SphereGeometry(R, 64, 40)), glassMat(0.1)), new THREE.Mesh(own(new THREE.SphereGeometry(R * 1.005, 64, 40)), rimMat));
  const lineMat = own(new THREE.LineBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
  const equatorMat = own(new THREE.LineBasicMaterial({ color: '#b6e9ff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  const circle = (r, y, rotX, mat) => {
    const pts = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    const l = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(pts)), mat); l.rotation.x = rotX; l.position.y = y; return l;
  };
  [-60, -30, 30, 60].forEach((d) => sphereG.add(circle(R * Math.cos((d * Math.PI) / 180), R * Math.sin((d * Math.PI) / 180), Math.PI / 2, lineMat)));
  sphereG.add(circle(R, 0, Math.PI / 2, equatorMat));
  for (let k = 0; k < 6; k++) { const m = circle(R, 0, 0, lineMat); m.rotation.y = (k * Math.PI) / 6; sphereG.add(m); }
  // the |0>–|1> axis: a thin line of light
  const axisLine = new THREE.Mesh(rodGeo, additive('#bfe9ff', 0.35)); axisLine.scale.set(0.008, 2 * R + 0.5, 0.008); sphereG.add(axisLine);
  // each pole: a bead of light, glowing with that outcome's odds
  const crowns = [1, -1].map((sgn) => {
    const g = new THREE.Group(); g.position.y = sgn * R; sphereG.add(g);
    const bead = new THREE.Mesh(capGeo, own(new THREE.MeshBasicMaterial({ color: sgn > 0 ? CYAN : PURPLE, toneMapped: false }))); bead.scale.setScalar(0.06);
    const halo = glow(sgn > 0 ? '#00f2fe' : '#f093fb', 1, g);
    g.add(bead);
    return { halo };
  });
  const poleLabels = [makePlate(qubitG), makePlate(qubitG)];

  // the state: a steel arrow ending in a glowing pearl
  const arrow = new THREE.Group(); qubitG.add(arrow);
  const shaft = rod(0.04); shaft.len(R - 0.3); shaft.obj.position.y = (R - 0.3) / 2; arrow.add(shaft.obj);
  const pearlMat = own(new THREE.MeshPhysicalMaterial({ color: '#00f2fe', emissive: '#00f2fe', emissiveIntensity: 0.6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, envMap: environment }));
  const pearl = new THREE.Mesh(capGeo, pearlMat); pearl.scale.setScalar(0.17); pearl.position.y = R - 0.12;
  const pearlHalo = glow('#00f2fe', 0.9, arrow); pearlHalo.position.y = R - 0.12;
  const grabRing = new THREE.Mesh(own(new THREE.TorusGeometry(0.3, 0.014, 8, 48, Math.PI * 1.5)), additive('#ffffff', 0));
  grabRing.position.y = R - 0.12;
  arrow.add(pearl, grabRing);
  const hub = new THREE.Mesh(capGeo, additive('#dff6ff', 0.9)); hub.scale.setScalar(0.06); qubitG.add(hub);
  const trail = Array.from({ length: 16 }, () => glow('#ffffff', 0.4, qubitG));
  const trailPts = [];
  // the ground state's pull: an elastic tether of light back to |0> while the arrow is dragged away
  const tether = new THREE.Mesh(rodGeo, additive('#00f2fe', 0.8)); tether.renderOrder = 4; qubitG.add(tether);
  const homeGlow = glow('#00f2fe', 0.8, qubitG); homeGlow.position.y = R - 0.12;

  // ── the Hadamard gate, drawn in light ──
  const hBeam = new THREE.Group(); qubitG.add(hBeam);
  hBeam.quaternion.setFromUnitVectors(UP, nH);
  const beamCore = new THREE.Mesh(rodGeo, additive('#ffe2a1', 0.9)); hBeam.add(beamCore);
  const beamHalo = new THREE.Mesh(rodGeo, additive('#f7b733', 0.25)); hBeam.add(beamHalo);
  const beamMotes = Array.from({ length: 10 }, () => glow('#f7b733', 0.25, hBeam));
  const HOLO_POS = nH.clone().multiplyScalar(R * 1.35 + 0.5);
  const holo = new THREE.Sprite(own(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  holo.position.copy(HOLO_POS); qubitG.add(holo);
  const holoHalo = glow('#f7b733', 1.4, qubitG); holoHalo.position.copy(HOLO_POS);
  const holoPick = new THREE.Mesh(own(new THREE.SphereGeometry(0.5, 12, 8)), hidden()); holoPick.position.copy(HOLO_POS); qubitG.add(holoPick);
  const sparks = Array.from({ length: 22 }, () => glow('#ffd27a', 0.18, qubitG));
  const pathDots = Array.from({ length: 48 }, () => glow('#ffd27a', 0.16, qubitG));
  const ringGeo = own(new THREE.TorusGeometry(1, 0.02, 8, 96));
  const waves = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(ringGeo, additive('#ffd27a', 0)); qubitG.add(m); return m; });

  // the measurement scanner, and the ripple that invites a tap
  const scanner = new THREE.Group(); qubitG.add(scanner);
  const scanRing = new THREE.Mesh(own(new THREE.TorusGeometry(R * 1.16, 0.016, 8, 120)), additive('#eafff4', 0.9)); scanRing.rotation.x = Math.PI / 2;
  const scanBand = new THREE.Mesh(own(new THREE.TorusGeometry(R * 1.16, 0.075, 10, 120)), additive(GREEN, 0.55)); scanBand.rotation.x = Math.PI / 2;
  scanner.add(scanRing, scanBand);
  const ripple = new THREE.Mesh(own(new THREE.TorusGeometry(R * 1.08, 0.02, 8, 120)), additive('#ff4d6d', 0)); ripple.rotation.x = Math.PI / 2; qubitG.add(ripple);

  // ── the classical bit: a glass capsule whose bead can only sit at 0 or at 1 ──
  const bitG = new THREE.Group(); world.add(bitG);
  const capsule = new THREE.Group(); bitG.add(capsule);
  capsule.add(new THREE.Mesh(own(new THREE.CylinderGeometry(0.42, 0.42, 1.9, 40, 1, true)), glassMat(0.14)));
  [1, -1].forEach((s) => {
    const cap = new THREE.Mesh(own(new THREE.SphereGeometry(0.42, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2)), glassMat(0.14));
    cap.position.y = s * 0.95; if (s < 0) cap.rotation.x = Math.PI; capsule.add(cap);
    const collar = new THREE.Mesh(own(new THREE.TorusGeometry(0.43, 0.012, 8, 48)), additive('#bfe9ff', 0.45)); collar.rotation.x = Math.PI / 2; collar.position.y = s * 0.95; capsule.add(collar);
    const seat = new THREE.Mesh(own(new THREE.TorusGeometry(0.27, 0.014, 8, 40)), additive(s > 0 ? CYAN : PURPLE, 0.8)); seat.rotation.x = Math.PI / 2; seat.position.y = s * SEAT; capsule.add(seat);
  });
  const railRod = rod(0.012); railRod.len(2 * SEAT); capsule.add(railRod.obj);
  const beadMat = own(new THREE.MeshPhysicalMaterial({ color: '#00f2fe', emissive: '#00f2fe', emissiveIntensity: 0.6, roughness: 0.12, clearcoat: 1, envMap: environment }));
  const bead = new THREE.Mesh(capGeo, beadMat); bead.scale.setScalar(0.24); capsule.add(bead);
  const beadHalo = glow('#00f2fe', 1, capsule);
  const jumpFlash = [glow('#ffffff', 1, capsule), glow('#ffffff', 1, capsule)];
  const bitLabels = [makePlate(bitG, 'round'), makePlate(bitG, 'round'), makePlate(bitG)];

  // a measurement's result: a spark of light that rises from its pole into the pole's chip
  const sparkPool = Array.from({ length: 12 }, () => glow('#ffffff', 0.45, qubitG));

  // ── state ──
  let step = 0, now = 0;
  const dir = UP.clone();
  let anim = null, held = null;
  let prepared = fromAngles(Math.PI / 2, 0);
  let sweepPhi = 0, sweeping = false;
  let bitY = SEAT, bitValue = 0, bitJump = -10, bitJumpFrom = SEAT;
  let collapsed = null;
  let tallies = { 0: [], 3: [] };
  const vis = { sphere: 0, bit: 0, holo: 0, ripple: 0 };
  let flash = 0, flashGold = 0, queued = 0, pull = 0, holdU = null, reduced = false;

  function startH() { anim = { kind: 'h', t0: now, dur: reduced ? 0.01 : 3.0, from: dir.clone() }; onEvent('h'); }
  function measure() {
    if (anim && anim.kind === 'measure' && step === 0) { queued++; return; }
    if (anim && anim.kind === 'to') { dir.copy(anim.to); anim = null; } // a glide still under way: finish it first
    if (anim) return;
    let r;
    if (step === 0) r = 0;
    else if (collapsed !== null) r = collapsed; // already collapsed: the same answer again
    else r = Math.random() < (1 - dir.y) / 2 ? 1 : 0;
    anim = { kind: 'measure', t0: now, dur: reduced ? 0.3 : 1.6, from: dir.clone(), r };
    onEvent('measure');
  }
  function go(n) {
    if (n < 0 || n > 3) return;
    const prev = step;
    step = n; held = null; sweeping = false; queued = 0;
    if (anim && anim.kind === 'measure') { dir.copy(anim.r ? new THREE.Vector3(0, -1, 0) : UP); anim = null; }
    if (n === 0) {
      collapsed = null;
      if (dir.distanceTo(fromAngles(Math.PI / 2, 0)) < 0.05) startH();
      else anim = { kind: 'to', t0: now, dur: 1.2, from: dir.clone(), to: UP.clone() };
    }
    if (n === 1 && prev === 0) { dir.copy(UP); startH(); }
    if (n === 1 && prev === 2) anim = { kind: 'to', t0: now, dur: 1.2, from: dir.clone(), to: fromAngles(Math.PI / 2, 0) };
    if (n === 2) {
      if (prev === 3) { collapsed = null; anim = { kind: 'to', t0: now, dur: 1.0, from: dir.clone(), to: prepared.clone(), then: 'sweep' }; }
      else { sweepPhi = phiOf(dir); anim = { kind: 'to', t0: now, dur: 1.2, from: dir.clone(), to: fromAngles(Math.PI / 2, sweepPhi), then: 'sweep' }; }
    }
    // step 3 measures the state the arrow is at, or the one it is still gliding to
    if (n === 3) { prepared = (anim && anim.kind === 'to' ? anim.to : dir).clone(); collapsed = null; }
    onChange();
  }

  // ── picking and hover hints ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pearlPick = new THREE.Mesh(own(new THREE.SphereGeometry(0.42, 12, 8)), hidden()); pearlPick.position.y = R - 0.12; arrow.add(pearlPick);
  const beadPick = new THREE.Mesh(own(new THREE.SphereGeometry(0.45, 12, 8)), hidden()); capsule.add(beadPick);
  const capsulePick = new THREE.Mesh(own(new THREE.CylinderGeometry(0.5, 0.5, 2.8, 12)), hidden()); capsule.add(capsulePick);
  const shellPick = new THREE.Mesh(own(new THREE.SphereGeometry(R * 1.05, 24, 16)), hidden()); qubitG.add(shellPick);
  let cam = null;
  const el = renderer.domElement;
  function rayFrom(e) {
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, cam);
    return raycaster;
  }
  function pick(e) {
    if (!cam) return null;
    const rc = rayFrom(e);
    const order = [];
    if (vis.sphere > 0.5) order.push(['pearl', pearlPick]);
    if (step === 1 && vis.bit > 0.5) order.push(['bead', beadPick], ['capsule', capsulePick]);
    if (step === 1 && vis.holo > 0.3) order.push(['h', holoPick]);
    if (vis.sphere > 0.5) order.push(['shell', shellPick]);
    for (const [kind, obj] of order) if (rc.intersectObject(obj, false).length) return kind;
    return null;
  }
  const sph = new THREE.Sphere(), hit = new THREE.Vector3(), center = new THREE.Vector3();
  function dirOnSphere(e) {
    const rc = rayFrom(e);
    qubitG.getWorldPosition(center);
    sph.set(center, R);
    if (!rc.ray.intersectSphere(sph, hit)) rc.ray.closestPointToPoint(center, hit);
    return hit.sub(center).normalize();
  }
  function bitYFrom(e) {
    const rc = rayFrom(e);
    const p = new THREE.Vector3(); rc.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), p);
    return Math.max(-SEAT, Math.min(SEAT, p.y - bitG.position.y));
  }

  let yaw = 0, pitch = 0, zoom = 1, orbiting = false;
  const pointers = new Map();
  const onHoverMove = (e) => {
    if (pointers.size) return;
    const k = pick(e);
    el.style.cursor = k && k !== 'capsule' ? 'pointer' : 'grab';
    onHover(e.pointerType === 'mouse' && k ? { kind: k, x: e.clientX, y: e.clientY } : null);
  };
  const onLeave = () => onHover(null);
  const onDown = (e) => {
    el.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
    const kind = pointers.size === 1 ? pick(e) : null;
    onHover(null);
    if (kind) { held = { kind, moved: false, busy: !!anim }; el.style.cursor = 'grabbing'; }
    else orbiting = true;
  };
  const onMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const p = pointers.get(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      pointers.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY });
      const [c, d] = [...pointers.values()];
      zoom = Math.min(1.6, Math.max(0.6, (zoom * before) / Math.max(1, Math.hypot(c.x - d.x, c.y - d.y))));
      return;
    }
    if (held) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 6) held.moved = true;
      if (held.moved && !held.busy) {
        const canDrag = step !== 3 || collapsed === null;
        if ((held.kind === 'pearl' || (held.kind === 'shell' && step === 2)) && canDrag) { held.kind = 'pearl'; held.dir = dirOnSphere(e); }
        if (held.kind === 'bead' || held.kind === 'capsule') { held.kind = 'bead'; bitY = bitYFrom(e); }
      }
    } else if (orbiting) {
      yaw = Math.max(-1.2, Math.min(1.2, yaw - (e.clientX - p.x) * 0.006));
      pitch = Math.max(-0.6, Math.min(0.6, pitch + (e.clientY - p.y) * 0.004));
    }
    pointers.set(e.pointerId, { ...p, x: e.clientX, y: e.clientY });
  };
  const onUp = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (held && (!held.busy || !held.moved)) {
      const k = held.kind;
      if (!held.moved) {
        // taps (a tap during a measurement in step 0 queues another)
        if ((k === 'shell' || k === 'pearl') && (step === 0 || step === 3)) measure();
        if ((k === 'bead' || k === 'capsule') && step === 1 && !held.busy) { bitJumpFrom = bitY; bitValue = 1 - bitValue; bitY = bitValue ? -SEAT : SEAT; bitJump = now; }
        if (k === 'h' && step === 1 && !anim) startH();
      } else if (held.dir || k === 'bead') {
        if (k === 'pearl' && step === 0) anim = { kind: 'spring', t0: now, dur: reduced ? 0.01 : 1.2, from: dir.clone() };
        if (k === 'pearl' && step === 1) dir.copy(held.dir);
        if (k === 'pearl' && step === 2) { dir.copy(held.dir); sweepPhi = phiOf(dir); sweeping = true; }
        if (k === 'pearl' && step === 3 && collapsed === null) { dir.copy(held.dir); prepared = dir.clone(); }
        // no in-between for the bit: it lands on the nearer seat, instantly
        if (k === 'bead') { bitJumpFrom = bitY; bitValue = bitY < 0 ? 1 : 0; bitY = bitValue ? -SEAT : SEAT; bitJump = now; }
      }
    }
    if (!pointers.size) { held = null; orbiting = false; el.style.cursor = 'grab'; }
  };
  const onWheel = (e) => { e.preventDefault(); zoom = Math.min(1.6, Math.max(0.6, zoom * (1 + e.deltaY * 0.001))); };
  el.addEventListener('pointermove', onHoverMove);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  // ── frame ──
  const camPos = new THREE.Vector3(0, 1.2, 20), camTgt = new THREE.Vector3();
  const goalPos = new THREE.Vector3(), goalTgt = new THREE.Vector3();
  const off = new THREE.Vector3(), side = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), look = new THREE.Vector3();
  const colTmp = new THREE.Color();

  function frame(dt, camera, opts = {}) {
    cam = camera;
    reduced = !!opts.reduced;
    now += dt;
    if (holdU !== null && anim) now = anim.t0 + anim.dur * holdU; // a test holding one moment
    const L = LAYOUT[step];
    for (const k of Object.keys(vis)) vis[k] += ((L.show[k] || 0) - vis[k]) * damp(reduced ? 50 : 4, dt);
    qubitG.position.x += (L.qx - qubitG.position.x) * damp(3, dt);
    bitG.position.x += (L.bx - bitG.position.x) * damp(3, dt);

    // the arrow: a scripted move, the viewer's hand, a sweep, or rest
    let trailOn = false, hU = -1;
    if (anim) {
      const u = clamp01((now - anim.t0) / anim.dur);
      if (anim.kind === 'h') { hU = u; dir.copy(anim.from).applyAxisAngle(nH, Math.PI * ease(0.3, 0.86, u)); trailOn = u > 0.28 && u < 0.92; }
      if (anim.kind === 'to') dir.copy(slerpDir(anim.from, anim.to, ease(0, 1, u)));
      if (anim.kind === 'spring') { const back = 1 - Math.exp(-6 * u) * Math.cos(9 * u); dir.copy(slerpDir(anim.from, UP, Math.min(back, 1.08))); }
      if (anim.kind === 'measure') {
        flash = Math.max(flash, u > 0.42 && u < 0.6 ? 1 : 0);
        if (step === 3) {
          const th0 = thetaOf(anim.from), ph = phiOf(anim.from), th1 = anim.r ? Math.PI : 0;
          dir.copy(fromAngles(th0 + (th1 - th0) * ease(0.45, 0.75, u), ph));
        }
      }
      if (u >= 1) {
        const wasMeasure = anim.kind === 'measure';
        if (wasMeasure) { tallies[step].push({ r: anim.r, t0: now }); if (step === 3) collapsed = anim.r; onChange(); }
        if (anim.then === 'sweep') sweeping = true;
        anim = null;
        if (wasMeasure && step === 0 && queued > 0) { queued--; measure(); }
      }
    } else if (held && held.kind === 'pearl' && held.dir) {
      if (step === 0) { const a = held.dir.angleTo(UP), lean = Math.min(a, 0.5); dir.copy(slerpDir(UP, held.dir, lean / Math.max(a, 1e-3))); }
      else dir.copy(held.dir);
    } else if (step === 2 && sweeping) { sweepPhi += dt * 0.7; dir.copy(fromAngles(thetaOf(dir), sweepPhi)); trailOn = true; }
    dir.normalize();

    // ── the qubit ──
    sphereG.scale.setScalar(Math.max(vis.sphere, 0.001));
    qubitG.visible = vis.sphere > 0.01;
    arrow.quaternion.setFromUnitVectors(UP, dir);
    arrow.scale.setScalar(Math.max(vis.sphere, 0.001));
    const P1 = (1 - dir.y) / 2;
    const col = colTmp.copy(CYAN).lerp(PURPLE, P1);
    if (hU >= 0) col.lerp(GOLD, Math.sin(Math.PI * ease(0.25, 0.95, hU)) * 0.7);
    pearlMat.color.copy(col); pearlMat.emissive.copy(col); pearlHalo.material.color.copy(col);
    const grabbable = !anim && (step !== 3 || collapsed === null);
    grabRing.material.opacity = grabbable ? 0.12 + 0.1 * Math.sin(now * 3) : 0; grabRing.rotation.z = now;
    crowns[0].halo.material.opacity = (0.2 + 0.8 * (1 - P1)) * vis.sphere; crowns[0].halo.scale.setScalar(0.5 + 1.1 * (1 - P1));
    crowns[1].halo.material.opacity = (0.2 + 0.8 * P1) * vis.sphere; crowns[1].halo.scale.setScalar(0.5 + 1.1 * P1);

    // the ground state's tether: stretched while dragged, redder the further it goes
    const tip = tmp.copy(dir).multiplyScalar(R - 0.12), home = tmp2.copy(UP).multiplyScalar(R - 0.12);
    pull += ((step === 0 && held && held.kind === 'pearl' && held.dir ? 1 : 0) - pull) * damp(10, dt);
    const stretch = tip.distanceTo(home);
    tether.visible = pull > 0.02 && stretch > 0.02;
    if (tether.visible) {
      tether.position.copy(tip).lerp(home, 0.5);
      tether.quaternion.setFromUnitVectors(UP, home.clone().sub(tip).normalize());
      const thick = 0.035 + 0.012 * Math.sin(now * 30) * pull; // it hums under the strain
      tether.scale.set(thick, stretch, thick);
      tether.material.color.copy(CYAN).lerp(RED, clamp01(stretch / 0.8)); tether.material.opacity = 0.8 * pull;
    }
    homeGlow.material.opacity = (step === 0 ? 0.25 + 0.6 * pull : 0) * vis.sphere;
    homeGlow.scale.setScalar(0.8 + 0.8 * pull);
    homeGlow.material.color.copy(tether.material.color);
    const tipNow = dir.clone().multiplyScalar(R - 0.12);

    flash *= Math.exp(-dt * 5); flashGold *= Math.exp(-dt * 3);
    rimMat.uniforms.uFlash.value = Math.max(flash * 0.8, flashGold * 0.5);
    rimMat.uniforms.uFlashC.value.copy(flashGold > flash ? GOLD : WHITE);

    // ── H in light ──
    const beam = hU >= 0 ? ease(0.05, 0.25, hU) * (1 - ease(0.9, 1, hU)) : 0;
    const idle = vis.holo * (hU >= 0 ? 0 : 1);
    hBeam.visible = beam > 0.01 || idle > 0.05;
    const beamK = Math.max(beam, idle * 0.25);
    const blen = Math.max(2 * R * 1.35 * Math.max(beam, idle), 1e-3);
    beamCore.scale.set(0.012 + 0.01 * beamK, blen, 0.012 + 0.01 * beamK); beamCore.material.opacity = 0.9 * beamK;
    beamHalo.scale.set(0.09, blen, 0.09); beamHalo.material.opacity = 0.22 * beamK * (0.8 + 0.2 * Math.sin(now * 8));
    beamMotes.forEach((m, j) => { const u = ((now * 0.6 + j / beamMotes.length) % 1) - 0.5; m.position.set(0, u * blen, 0); m.material.opacity = 0.8 * beamK * Math.sin(Math.PI * (u + 0.5)); });
    // the H hologram appears, pulses, and pours itself into the pearl as sparks
    const holoIn = hU >= 0 ? ease(0, 0.12, hU) * (1 - ease(0.22, 0.34, hU)) : idle * 0.75;
    holo.visible = holoIn > 0.01;
    const beat = 0.85 + 0.15 * Math.sin(now * 5);
    holo.material.map = textTex('H', '#f7b733', '#ffe7b0');
    holo.material.opacity = holoIn; holo.scale.set(1.1 * beat, 0.55 * beat, 1);
    holoHalo.material.opacity = holoIn * 0.7; holoHalo.scale.setScalar(1.2 + 0.3 * Math.sin(now * 4));
    sparks.forEach((s, j) => {
      const u = hU >= 0 ? clamp01((hU - 0.12 - j * 0.006) / 0.18) : 0;
      s.visible = u > 0 && u < 1;
      if (s.visible) {
        const swirl = (j / sparks.length) * Math.PI * 2 + u * 5;
        s.position.copy(HOLO_POS).lerp(tipNow, ease(0, 1, u)).add(new THREE.Vector3(Math.cos(swirl), Math.sin(swirl), Math.sin(swirl * 0.7)).multiplyScalar(0.35 * Math.sin(Math.PI * u)));
        s.material.opacity = Math.sin(Math.PI * u);
      }
    });
    // the path ahead: the arc the pearl will travel, lit before it goes
    const reveal = hU >= 0 ? ease(0.18, 0.36, hU) : 0, fade = hU >= 0 ? 1 - ease(0.86, 1, hU) : 0;
    pathDots.forEach((d, j) => {
      const k = j / (pathDots.length - 1);
      d.visible = hU >= 0 && k <= reveal && fade > 0.01;
      if (d.visible) { d.position.copy(anim.from).applyAxisAngle(nH, Math.PI * k).multiplyScalar(R - 0.12); d.material.opacity = 0.7 * fade * (0.6 + 0.4 * Math.sin(now * 10 - j * 0.6)); }
    });
    // the landing: shockwaves around the arrival point, and the rim flashes gold
    if (hU > 0.86 && hU < 0.9) flashGold = 1;
    const arrive = hU >= 0 && anim ? anim.from.clone().applyAxisAngle(nH, Math.PI) : dir;
    waves.forEach((w, j) => {
      const u = hU >= 0 ? clamp01((hU - 0.86 - j * 0.035) / 0.14) : 0;
      w.visible = u > 0 && u < 1;
      if (w.visible) {
        w.position.copy(arrive).multiplyScalar(R);
        w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), arrive);
        w.scale.setScalar(0.15 + 1.1 * u); w.material.opacity = (1 - u) * 0.9;
      }
    });

    // trail
    if (trailOn) { trailPts.unshift(tipNow.clone()); if (trailPts.length > 32) trailPts.pop(); } else if (trailPts.length) trailPts.pop();
    trail.forEach((s, i) => { const p = trailPts[i * 2]; s.visible = !!p; if (p) { s.position.copy(p); const k = 1 - i / trail.length; s.scale.setScalar(0.45 * k); s.material.opacity = 0.55 * k; s.material.color.copy(col); } });

    // scanner and ripple
    const mu = anim && anim.kind === 'measure' ? clamp01((now - anim.t0) / anim.dur) : -1;
    scanner.visible = mu >= 0 && mu < 0.95;
    if (scanner.visible) {
      const y = (R + 0.9) - (2 * R + 1.8) * ease(0, 0.95, mu);
      scanner.position.y = y;
      const w = Math.sqrt(Math.max(0, 1 - (y / (R * 1.16)) ** 2));
      scanner.scale.set(Math.max(w, 0.35), 1, Math.max(w, 0.35));
    }
    const rip = vis.ripple * (collapsed === null && !anim ? 1 : 0);
    ripple.visible = rip > 0.01;
    const rp = (now * 0.6) % 1;
    ripple.scale.setScalar(1 + rp * 0.5); ripple.material.opacity = 0.6 * (1 - rp) * rip;

    // ── the classical bit ──
    bitG.visible = vis.bit > 0.03; bitG.scale.setScalar(Math.max(vis.bit, 0.001));
    const between = held && held.kind === 'bead' && held.moved && Math.abs(bitY) < SEAT - 0.12;
    const jumpK = clamp01((now - bitJump) / 0.35);
    bead.position.y = bitY + (between ? (Math.random() - 0.5) * 0.05 : 0);
    beadMat.color.lerp(between ? RED : bitValue ? PURPLE : CYAN, damp(12, dt)); beadMat.emissive.copy(beadMat.color);
    beadHalo.position.y = bead.position.y; beadHalo.material.color.copy(beadMat.color); beadHalo.scale.setScalar(between ? 1.4 : 1);
    jumpFlash[0].position.y = bitJumpFrom; jumpFlash[1].position.y = bitY;
    jumpFlash.forEach((f) => { f.material.opacity = (1 - jumpK) * 0.9; f.scale.setScalar(0.6 + 1.2 * jumpK); });
    bitLabels[0].set('0', '#00f2fe', 0.85, SEAT, 0, vis.bit);
    bitLabels[1].set('1', '#f093fb', 0.85, -SEAT, 0, vis.bit);
    bitLabels[2].set(String.raw`\text{Classical bit}`, '#ffffff', 0, 1.85, 0, vis.bit);

    // ── results: each measurement's spark rises into its pole's chip, which counts it ──
    const list = step === 0 || step === 3 ? tallies[step] : [];
    const landed = [0, 0], landK = [0, 0];
    let used = 0;
    for (const p of list) {
      const f = (now - p.t0) / 0.9;
      if (f >= 1) { landed[p.r]++; landK[p.r] = Math.max(landK[p.r], 1 - (f - 1) / 0.7); continue; }
      if (used >= sparkPool.length) continue;
      const m = sparkPool[used++], sg = p.r ? -1 : 1;
      m.visible = true; m.material.color.copy(p.r ? PURPLE : CYAN);
      m.position.set(0, sg * (R + 0.62 * ease(0, 1, f)), 0);
      m.material.opacity = Math.sin(Math.PI * Math.min(1, f * 1.15)) * vis.sphere;
    }
    for (let i = used; i < sparkPool.length; i++) sparkPool[i].visible = false;
    [0, 1].forEach((r) => {
      const k = Math.max(0, landK[r]);
      if (k > 0) { crowns[r].halo.material.opacity += k * 0.8; crowns[r].halo.scale.multiplyScalar(1 + 0.6 * k); }
    });
    const pctT = (p) => `${Math.round(p * 100)}\\%`;
    const counting = list.length > 0;
    [0, 1].forEach((r) => {
      const ket = `\\lvert ${r}\\rangle`;
      const odds = r ? P1 : 1 - P1;
      const tex = step === 2 ? `${ket}\\;\\; ${pctT(odds)}` : counting ? `${ket} \\times ${landed[r]}` : ket;
      poleLabels[r].set(tex, r ? '#f093fb' : '#00f2fe', 0, (r ? -1 : 1) * (R + 0.62), 0, vis.sphere);
    });

    // ── camera: glide to this step's view; drift; the viewer's look-around ──
    camera.fov = camera.aspect < 1 ? 58 : 42;
    const want = Math.tan((21 * Math.PI) / 180) * 1.6 * (camera.aspect < 1 ? 0.7 : 1);
    const fit = Math.max(1, want / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect));
    camera.updateProjectionMatrix();
    goalPos.set(...L.cam[0]); goalTgt.set(...L.cam[1]);
    camPos.lerp(goalPos, damp(reduced ? 50 : 1.8, dt)); camTgt.lerp(goalTgt, damp(reduced ? 50 : 1.8, dt));
    if (!orbiting) { yaw *= 0.97; pitch *= 0.97; }
    off.copy(camPos).sub(camTgt).multiplyScalar(zoom * fit);
    if (!reduced) { off.x += Math.sin(now * 0.25) * 0.2; off.y += Math.sin(now * 0.31) * 0.1; }
    off.applyAxisAngle(UP, yaw);
    side.crossVectors(UP, off).normalize();
    off.applyAxisAngle(side, -pitch);
    camera.position.copy(camTgt).add(off);
    // `lift` (a share of the view's height): the overlay asks for the scene to sit higher, above a docked card
    const lift = off.length() * Math.tan((camera.fov * Math.PI) / 360) * (opts.lift || 0);
    camera.position.y -= lift;
    camera.lookAt(look.copy(camTgt).setY(camTgt.y - lift));
  }

  return {
    root,
    environment,
    frame,
    next() {
      if (step < 3) return go(step + 1);
      if (collapsed === null) return measure();
      // ↺ Reset State: back to the ground state, as the module has always done
      tallies = { 0: [], 3: [] };
      go(0);
    },
    prev() { go(step - 1); },
    /** A measurement, as a tap on the sphere would make (the ground state, or the prepared state). */
    measure() { if (step === 0 || step === 3) measure(); },
    prepareAgain() {
      if (step !== 3 || collapsed === null || anim) return;
      collapsed = null;
      anim = { kind: 'to', t0: now, dur: 1.0, from: dir.clone(), to: prepared.clone() };
      onChange();
    },
    /** What the cards show. */
    state() {
      const P1 = (1 - dir.y) / 2;
      const q1 = (1 - prepared.y) / 2;
      const count = (list) => { const c = [0, 0]; list.forEach((p) => { if (now >= p.t0 + 0.9) c[p.r]++; }); return c; };
      return {
        step, collapsed,
        p1: P1, theta: thetaOf(dir), phi: phiOf(dir),
        prepared1: q1,
        ground: count(tallies[0]),
        observed: count(tallies[3]),
        pulling: step === 0 && !!(held && held.kind === 'pearl' && held.dir),
        bit: bitValue,
        bitBetween: !!(held && held.kind === 'bead' && held.moved && Math.abs(bitY) < SEAT - 0.12),
      };
    },
    /** The labels pinned to the models, in client pixels, for the overlay's glass chips. */
    chips(camera) {
      const r = el.getBoundingClientRect(), v = new THREE.Vector3();
      return plates.map((p) => {
        const visible = p.s > 0.01 && !!p.tex && p.g.parent.visible;
        if (!visible) return null;
        p.g.getWorldPosition(v); v.project(camera);
        if (v.z > 1) return null;
        return { tex: p.tex, color: p.color, size: p.size, s: Math.min(1, p.s), x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      });
    },
    /** Where the sphere is on screen (for the cards' arrows), in client pixels. */
    sphereOnScreen(camera) {
      const r = el.getBoundingClientRect();
      const c = new THREE.Vector3(); qubitG.getWorldPosition(c);
      const e = c.clone().add(new THREE.Vector3(0, R, 0));
      c.project(camera); e.project(camera);
      const x = r.left + ((c.x + 1) / 2) * r.width, y = r.top + ((1 - c.y) / 2) * r.height;
      return { x, y, r: Math.abs(r.top + ((1 - e.y) / 2) * r.height - y), visible: vis.sphere > 0.5 };
    },
    // test hooks
    settle() { if (anim) now = anim.t0 + anim.dur; },
    hold(u) { holdU = u; },
    screenOf(name, camera) {
      const o = { pearl, bead, h: holo, sphere: hub }[name];
      const r = el.getBoundingClientRect();
      const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(camera);
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    dispose() {
      el.removeEventListener('pointermove', onHoverMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.style.cursor = '';
      owned.forEach((x) => x.dispose());
      texCache.forEach((x) => x.dispose());
      envRT.dispose();
    },
  };
}
