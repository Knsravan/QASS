import * as THREE from 'three';

/*
 * Dirac Notation's 3D story, in four shots (the version approved on its test page).
 *
 * 1. The ket: a steel bar and angle bracket spin in and lock around a |0> pearl,
 *    then the bracket's arms swing upright into square brackets, two glass slots
 *    grow, and the pearl pours in as light: [1, 0].
 * 2. |1>: the light gathers into a pearl, swings out around the column with a trail
 *    and pours into the bottom slot: [0, 1].
 * 3. Superposition: the pearl splits in two and fills both slots halfway; the column
 *    comes apart into α|0> + β|1> and back together.
 * 4. The bra: the column folds back into the ket |ψ>; a copy flies through a green
 *    mirror, turning into ⟨ψ| with its phase dial reflected (the conjugate), and joins
 *    the ket bar to bar: ⟨ψ|ψ⟩ = 1.
 *
 * Plain three.js, so the shots stay exactly as approved: each shot sets every object
 * from its own clock, so Back, Next and Replay start any shot cleanly. The camera makes
 * one continuous move per shot; the viewer can drag to look around (it eases back) and
 * scroll or pinch to zoom. Narrow screens step back so the whole shot fits, and every
 * screen centres the scene in the space above the caption.
 */

export const SHOT_LENGTHS = [7.2, 5.4, 10.6, 11];

const CYAN = new THREE.Color('#00f2fe');
const PURPLE = new THREE.Color('#f093fb');
const PSI = new THREE.Color('#b6a8ff');
const GREEN = new THREE.Color('#43e97b');
const PHI = 0.9; // the example state's phase

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function ease(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); }
function pulse(t, at, w) { return t < at ? 0 : Math.exp(-((t - at) / w) * ((t - at) / w) * 2.5); }
const mixC = (a, b, k) => a.clone().lerp(b, k);

export function createDiracStory(renderer) {
  const root = new THREE.Group();
  const owned = []; // textures and geometries to free when the module closes
  const own = (x) => { owned.push(x); return x; };

  // A studio for the metal and glass to reflect: a soft white key above, cyan on the left, magenta on the right.
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
  const key = new THREE.DirectionalLight('#ffffff', 1.2);
  key.position.set(3, 5, 6);
  root.add(key);

  // ── Shared looks ──────────────────────────────────────────────────────────
  const metal = own(new THREE.MeshStandardMaterial({ color: '#e9eef8', metalness: 1, roughness: 0.2, envMap: environment, envMapIntensity: 1.2 }));
  const glass = own(new THREE.MeshPhysicalMaterial({ color: '#d6f1ff', metalness: 0, roughness: 0.06, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMap: environment, envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide }));

  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return own(t);
  })();
  const glow = (color, size = 1) => {
    const s = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    s.scale.setScalar(size); return s;
  };

  // Text drawn once to a texture: a symbol, and an optional small value under it ("α|0.71").
  const texCache = new Map();
  function textTex(text, glowColor = '#ffffff', ink = '#ffffff') {
    const k = text + glowColor + ink;
    if (texCache.has(k)) return texCache.get(k);
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const [main, sub] = text.split('|');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = glowColor; g.shadowBlur = ink === '#ffffff' ? 24 : 0; g.fillStyle = ink;
    g.font = `700 ${sub ? 128 : 168}px Inter, system-ui, sans-serif`;
    g.fillText(main, 256, sub ? 100 : 132);
    if (sub) { g.font = '600 66px "Fira Code", ui-monospace, monospace'; g.shadowColor = '#000000'; g.shadowBlur = 14; g.fillStyle = '#ffffff'; g.fillText(sub, 256, 200); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    texCache.set(k, t); return t;
  }

  // A polished steel rod with round ends, resizable along its length (Y).
  const rodGeo = own(new THREE.CylinderGeometry(1, 1, 1, 28, 1, true));
  const capGeo = own(new THREE.SphereGeometry(1, 28, 14));
  function rod(r) {
    const o = new THREE.Group();
    const c = new THREE.Mesh(rodGeo, metal), a = new THREE.Mesh(capGeo, metal), b = new THREE.Mesh(capGeo, metal);
    c.scale.set(r, 1, r); a.scale.setScalar(r); b.scale.setScalar(r);
    o.add(c, a, b);
    return { obj: o, len(l) { l = Math.max(l, 1e-4); c.scale.y = l; a.position.y = l / 2; b.position.y = -l / 2; } };
  }

  function roundedBox(w, h, d, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 8 });
    g.center(); return g;
  }
  const slotGeo = own(roundedBox(1.08, 1.18, 0.52, 0.14));
  const slotEdges = own(new THREE.EdgesGeometry(slotGeo, 30));
  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const planeGeo = own(new THREE.PlaneGeometry(1, 0.5));
  const sphereGeo = own(new THREE.SphereGeometry(1, 40, 20));
  const ringGeo = own(new THREE.TorusGeometry(0.5, 0.018, 10, 64));

  // ── An orb: the state, as a glowing pearl (with a phase dial for ψ) ───────
  function makeOrb(parent) {
    const g = new THREE.Group(); parent.add(g);
    const mat = own(new THREE.MeshPhysicalMaterial({ color: '#00f2fe', emissive: '#00f2fe', emissiveIntensity: 0.55, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, envMap: environment }));
    const core = new THREE.Mesh(sphereGeo, mat);
    const halo = glow('#00f2fe', 1);
    const label = new THREE.Sprite(own(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false })));
    label.renderOrder = 10;
    const dial = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, metal);
    const handPivot = new THREE.Group();
    const hand = new THREE.Mesh(boxGeo, own(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })));
    hand.scale.set(0.22, 0.035, 0.035); hand.position.x = 0.5 + 0.11;
    const tip = glow('#ffffff', 0.35); tip.position.x = 0.5 + 0.22;
    handPivot.add(hand, tip); dial.add(ring, handPivot);
    g.add(halo, core, label, dial);
    return {
      set(o) {
        if (!o || o.s < 0.002) { g.visible = false; return; }
        g.visible = true;
        g.position.set(o.x || 0, o.y || 0, o.z || 0);
        core.scale.setScalar(0.3 * o.s);
        halo.scale.setScalar(1.7 * o.s);
        mat.color.copy(o.col); mat.emissive.copy(o.col); halo.material.color.copy(o.col); halo.material.opacity = 0.7;
        if (o.label && (o.lop ?? 1) > 0.01) {
          label.visible = true; label.material.map = textTex(o.label, '#' + o.col.getHexString(), '#0a1020');
          label.material.opacity = o.lop ?? 1; label.scale.set(0.62 * o.s, 0.31 * o.s, 1);
        } else label.visible = false;
        if (o.dial !== undefined && (o.dialS ?? 0) > 0.01) {
          dial.visible = true; dial.scale.setScalar(o.dialS * o.s); handPivot.rotation.z = o.dial;
          tip.material.color.copy(o.col);
        } else dial.visible = false;
      },
    };
  }

  // ── One glass slot of a column vector: liquid light fills it to its odds ──
  function makeSlot(parent, y, color) {
    const g = new THREE.Group(); g.position.y = y; parent.add(g);
    const frame = new THREE.Mesh(slotGeo, glass);
    const edges = new THREE.LineSegments(slotEdges, own(new THREE.LineBasicMaterial({ color: '#cfe9ff', transparent: true, opacity: 0.35 })));
    const liquid = new THREE.Mesh(boxGeo, own(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.85), transparent: true, opacity: 0.92, toneMapped: false })));
    const halo = glow(color, 1);
    const digitMat = own(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    const digit = new THREE.Mesh(planeGeo, digitMat); digit.position.z = 0.29; digit.renderOrder = 5;
    g.add(halo, liquid, frame, edges, digit);
    const glowHex = '#' + new THREE.Color(color).getHexString();
    return {
      set(fill, d) {
        const f = Math.max(fill, 0);
        liquid.visible = f > 0.004;
        liquid.scale.set(0.88, Math.max(f, 0.001) * 0.98, 0.36);
        liquid.position.y = -0.49 + (f * 0.98) / 2;
        halo.position.set(0, liquid.position.y, -0.05);
        halo.scale.setScalar(0.6 + 1.6 * f); halo.material.opacity = 0.75 * f;
        if (d && d.o > 0.01) {
          const k = d.k || 0;
          digit.visible = true;
          digitMat.map = textTex(k < 0.5 ? d.a : d.b, glowHex);
          digit.rotation.x = k < 0.5 ? k * Math.PI : (k - 1) * Math.PI; // the number flips over as it changes
          digitMat.opacity = d.o;
        } else digit.visible = false;
      },
    };
  }

  // ── The glyph: a ket | ⟩ that folds into a column vector [ ] ──────────────
  // m = 0: the ket (a bar and an angle bracket); m = 1: a column (two square brackets
  // around two glass slots). The angle bracket's arms swing upright to become "]".
  function makeGlyph() {
    const g0 = new THREE.Group(); root.add(g0);
    const barG = new THREE.Group(); g0.add(barG);
    const bar = rod(0.085); barG.add(bar.obj);
    const sl = [rod(0.068), rod(0.068)]; sl.forEach((s) => { s.obj.rotation.z = Math.PI / 2; barG.add(s.obj); });
    const chev = new THREE.Group(); g0.add(chev);
    const armT = new THREE.Group(), armB = new THREE.Group(); chev.add(armT, armB);
    const rT = rod(0.085), rB = rod(0.085); armT.add(rT.obj); armB.add(rB.obj);
    const joint = new THREE.Mesh(capGeo, metal); joint.scale.setScalar(0.085); chev.add(joint);
    const sr = [rod(0.068), rod(0.068)]; sr.forEach((s) => { s.obj.rotation.z = Math.PI / 2; chev.add(s.obj); });
    const flash = glow('#ffffff', 1); barG.add(flash);
    const slotsG = new THREE.Group(); g0.add(slotsG);
    const slots = [makeSlot(slotsG, 0.66, '#00f2fe'), makeSlot(slotsG, -0.66, '#f093fb')];
    const orb = makeOrb(g0);
    return {
      set(s) {
        g0.visible = !!s.vis;
        if (!s.vis) return;
        g0.position.set(s.x, s.y, s.z); g0.rotation.y = s.ry; g0.scale.setScalar(s.sc);
        const m = s.m, th = 0.5 * (1 - m), L = 1.3 + 0.08 * m;
        const tipX = lerp(1.05, 0.8, m), barX = lerp(-0.98, -0.8, m), barLen = 2 * L * Math.cos(th);
        barG.position.set(barX + s.barDX, 0, 0); barG.rotation.y = s.spin;
        bar.len(barLen * s.bar); barG.visible = s.bar > 0.01;
        const se = ease(0.55, 1, m);
        sl.forEach((r, i) => { r.obj.visible = se > 0.01; r.len(0.34 * se); r.obj.position.set(0.17 * se, (i ? -1 : 1) * barLen / 2, 0); });
        flash.material.opacity = s.flash; flash.scale.set(1.2 + 2 * s.flash, barLen * (0.6 + s.flash), 1); flash.visible = s.flash > 0.01;
        chev.position.set(tipX + s.chevDX, 0, 0); chev.rotation.y = -s.spin;
        armT.rotation.z = th; armB.rotation.z = -th;
        rT.len(L); rT.obj.position.y = L / 2; rB.len(L); rB.obj.position.y = -L / 2;
        sr.forEach((r, i) => { r.obj.visible = se > 0.01; r.len(0.34 * se); r.obj.position.set(-0.17 * se, (i ? -1 : 1) * L, 0); });
        slotsG.visible = s.slot > 0.01; slotsG.scale.setScalar(Math.max(s.slot, 0.001));
        slots[0].set(s.fill[0], s.dig[0]); slots[1].set(s.fill[1], s.dig[1]);
        orb.set(s.orb);
      },
    };
  }

  // ── The cast ──────────────────────────────────────────────────────────────
  const ket = makeGlyph(), colA = makeGlyph(), colB = makeGlyph(), bra = makeGlyph();
  const orbA = makeOrb(root), orbB = makeOrb(root);
  const trail = Array.from({ length: 14 }, () => { const s = glow('#ffffff', 0.5); root.add(s); return s; });
  const trailPts = [];

  const plus = new THREE.Group(); root.add(plus);
  { const h = rod(0.06), v = rod(0.06); h.len(0.5); v.len(0.5); h.obj.rotation.z = Math.PI / 2; plus.add(h.obj, v.obj, glow('#f7971e', 1.6)); }

  const mirror = new THREE.Group(); mirror.position.set(-0.5, 0, 0.6); root.add(mirror);
  const mirrorBox = own(new THREE.BoxGeometry(0.05, 3.1, 2.5));
  const mirrorSheen = glow('#43e97b', 1); mirrorSheen.scale.set(1.2, 3.6, 1);
  mirror.add(
    mirrorSheen,
    new THREE.Mesh(mirrorBox, own(new THREE.MeshPhysicalMaterial({ color: '#c8ffe0', roughness: 0.05, transparent: true, opacity: 0.2, clearcoat: 1, envMap: environment, envMapIntensity: 2, depthWrite: false, side: THREE.DoubleSide }))),
    new THREE.LineSegments(own(new THREE.EdgesGeometry(mirrorBox)), own(new THREE.LineBasicMaterial({ color: '#43e97b', transparent: true, opacity: 0.95 }))),
  );

  const eqOne = new THREE.Group(); eqOne.position.set(3.05, 0, 0); root.add(eqOne);
  const eqGlow = glow('#43e97b', 2.6);
  const eqPlane = new THREE.Mesh(own(new THREE.PlaneGeometry(2, 1)), own(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })));
  eqOne.add(eqGlow, eqPlane);

  function glyphState() {
    return { vis: false, x: 0, y: 0, z: 0, ry: 0, sc: 1, m: 1, slot: 1, fill: [0, 0], dig: [null, null], orb: null, bar: 1, barDX: 0, chevDX: 0, spin: 0, flash: 0 };
  }

  // ── The four shots ────────────────────────────────────────────────────────
  const SHOTS = [
    // 1 · The ket: the brackets fly in and lock around the |0> pearl, then fold square into a column.
    (t, S) => {
      const E = (a, b) => ease(a, b, t), K = S.ket;
      const arrive = E(0.3, 1.9);
      Object.assign(K, { vis: true, m: E(3.0, 4.6), slot: E(3.5, 4.8), barDX: -5 * (1 - arrive), chevDX: 5 * (1 - arrive), spin: (1 - arrive) * Math.PI * 1.4, flash: pulse(t, 1.9, 0.5) });
      K.orb = { x: 0, y: 0.66 * E(4.3, 5.1), z: 0, s: E(0, 0.9) * (1 - E(5.0, 5.6)), col: CYAN, label: '0', lop: E(0.7, 1.3) * (1 - E(2.9, 3.3)) };
      K.fill = [E(5.1, 6.1), 0];
      K.dig = [{ a: '1', b: '1', o: E(5.7, 6.3) }, { a: '0', b: '0', o: E(5.3, 5.9) }];
    },
    // 2 · |1>: the light condenses into a pearl, swings out around the column and pours into the bottom slot.
    (t, S) => {
      const E = (a, b) => ease(a, b, t), K = S.ket;
      Object.assign(K, { vis: true, m: 1, slot: 1 });
      K.fill = [1 - E(0.2, 1.0), E(3.5, 4.4)];
      K.dig = [{ a: '1', b: '0', k: E(0.7, 1.3), o: 1 }, { a: '0', b: '1', k: E(3.8, 4.4), o: 1 }];
      const u = E(1.2, 3.0);
      S.orbA = { x: 1.3 * Math.sin(Math.PI * u), y: 0.66 - 1.32 * u, z: E(0.5, 1.2) * (1 - E(3.0, 3.5)) + 0.5 * Math.sin(Math.PI * u), s: E(0.2, 1.0) * (1 - E(3.4, 3.9)), col: mixC(CYAN, PURPLE, u) };
      S.trail = t > 1.1 && t < 3.6;
    },
    // 3 · Superposition: the pearl splits in two, filling both slots halfway; then the column
    //     comes apart into α of |0> plus β of |1>, and back together.
    (t, S) => {
      const E = (a, b) => ease(a, b, t), K = S.ket;
      const split = t >= 5.0 && t < 9.8;
      Object.assign(K, { vis: !split, m: 1, slot: 1 });
      K.fill = [0.5 * E(3.0, 3.9), (1 - E(0.2, 1.0)) + 0.5 * E(3.0, 3.9)];
      K.dig = [{ a: '0', b: 'α|0.71', k: E(3.4, 4.0), o: 1 }, { a: '1', b: 'β|0.71', k: E(3.4, 4.0), o: 1 }];
      const rise = E(0.5, 1.5), apart = E(1.6, 2.6), dive = 1 - E(2.6, 3.1), gone = 1 - E(3.0, 3.5);
      const baseY = -0.66 * (1 - rise), z = 1.1 * rise * dive;
      S.orbA = { x: 0, y: baseY + 0.66 * apart, z, s: E(0.2, 1.0) * (1 - 0.22 * E(1.5, 2.0)) * gone, col: mixC(PURPLE, CYAN, E(1.5, 2.3)) };
      S.orbB = t > 1.5 ? { x: 0, y: baseY - 0.66 * apart, z, s: 0.78 * E(1.5, 1.9) * gone, col: PURPLE } : null;
      if (split) {
        const sp = E(5.0, 6.4) * (1 - E(8.4, 9.8));
        Object.assign(S.colA, { vis: true, x: -2.0 * sp, fill: [0.5, 0.5 * (1 - sp)], dig: [{ a: 'α|0.71', b: 'α|0.71', o: 1 }, { a: 'β|0.71', b: '0', k: sp, o: 1 }] });
        Object.assign(S.colB, { vis: true, x: 2.0 * sp, fill: [0.5 * (1 - sp), 0.5], dig: [{ a: 'α|0.71', b: '0', k: sp, o: 1 }, { a: 'β|0.71', b: 'β|0.71', o: 1 }] });
        S.plus = E(5.8, 6.4) * (1 - E(8.2, 8.8));
      }
    },
    // 4 · The bra: the column folds back into the ket |ψ>; a copy flies through the mirror,
    //     turning into ⟨ψ| with its phase reflected; bra and ket join bar to bar: ⟨ψ|ψ⟩ = 1.
    (t, S) => {
      const E = (a, b) => ease(a, b, t), K = S.ket, B = S.bra;
      const pour = E(0.2, 1.0);
      Object.assign(K, { vis: true, m: 1 - E(0.4, 1.8), slot: 1 - E(0.2, 1.2), x: 1.4 * E(2.0, 3.0) - 0.4 * E(6.8, 8.4), flash: pulse(t, 8.4, 0.45) });
      K.fill = [0.5 * (1 - pour), 0.5 * (1 - pour)];
      K.dig = [{ a: 'α|0.71', b: 'α|0.71', o: 1 - E(0.1, 0.5) }, { a: 'β|0.71', b: 'β|0.71', o: 1 - E(0.1, 0.5) }];
      K.orb = { s: E(0.2, 1.4), col: PSI, label: 'ψ', lop: E(1.2, 1.8), dial: PHI, dialS: E(1.4, 2.0) };
      if (t >= 3.0) {
        const x = lerp(1.4, -2.6, E(3.4, 6.2)) + 1.6 * E(6.8, 8.4);
        const k = ease(0, 1, clamp01((-0.1 - x) / 0.8)); // how far through the mirror
        Object.assign(B, { vis: true, m: 0, slot: 0, x, z: 1.2 * E(3.0, 3.6) * (1 - E(6.0, 6.6)), sc: 0.6 + 0.4 * E(3.0, 3.6), ry: Math.PI * k, bar: 1 - E(8.2, 8.4) });
        B.orb = { s: 1, col: mixC(PSI, GREEN, 0.25 * k), label: 'ψ', lop: 1, dial: PHI + Math.PI * k, dialS: 1 };
      }
      S.mirror = E(2.4, 3.2) * (1 - E(6.2, 6.9));
      S.eq = E(9.0, 9.8);
    },
  ];

  // ── Camera: one continuous move per shot ──────────────────────────────────
  const CAMS = [
    [[0, [0, 0.8, 16], [0, 0, 0]], [1.9, [0.5, 0.4, 7.8], [0, 0, 0]], [3.2, [1.5, 0.6, 7.3], [0, 0, 0]], [6.8, [-1.6, 0.5, 7.1], [0, 0, 0]]],
    [[1.4, [2.2, 1.1, 6.8], [0, 0, 0]], [3.2, [3.0, -0.6, 6.5], [0, -0.1, 0]], [5.2, [1.2, 0.3, 7.4], [0, 0, 0]]],
    [[1.2, [0.6, 0.2, 7.0], [0, 0, 0]], [4.4, [1.8, 0.8, 7.2], [0, 0, 0]], [6.4, [0.2, 0.6, 10.4], [0, 0, 0]], [8.4, [-0.6, 0.4, 10.2], [0, 0, 0]], [10.4, [1.0, 0.4, 7.6], [0, 0, 0]]],
    [[2.0, [0.6, 0.6, 8.6], [0.3, 0, 0]], [4.6, [1.6, 2.1, 7.4], [-0.4, 0, 0.4]], [6.6, [-0.8, 0.6, 8.8], [0, 0, 0]], [8.6, [0.4, 0.3, 8.2], [0.5, 0, 0]], [10.8, [1.0, 0.5, 8.8], [0.9, 0, 0]]],
  ].map((keys) => keys.map(([t, p, q]) => ({ t, p: new THREE.Vector3(...p), q: new THREE.Vector3(...q) })));
  const camPos = new THREE.Vector3(0, 0.8, 16), camTgt = new THREE.Vector3();
  let entry = { p: camPos.clone(), q: camTgt.clone() }; // the camera where the shot began
  function catmull(p0, p1, p2, p3, u) {
    const u2 = u * u, u3 = u2 * u;
    return new THREE.Vector3().addScaledVector(p0, -0.5 * u3 + u2 - 0.5 * u)
      .addScaledVector(p1, 1.5 * u3 - 2.5 * u2 + 1)
      .addScaledVector(p2, -1.5 * u3 + 2 * u2 + 0.5 * u)
      .addScaledVector(p3, 0.5 * u3 - 0.5 * u2);
  }
  function cameraAt(step, t) {
    const keys = CAMS[step];
    const list = keys[0].t === 0 ? keys : [{ t: 0, p: entry.p, q: entry.q }, ...keys];
    const last = list[list.length - 1];
    if (t >= last.t) return { p: last.p.clone(), q: last.q.clone() };
    let i = 0; while (i < list.length - 2 && t > list[i + 1].t) i++;
    const a = list[Math.max(i - 1, 0)], b = list[i], c = list[i + 1], d = list[Math.min(i + 2, list.length - 1)];
    let u = clamp01((t - b.t) / (c.t - b.t));
    if (i === 0) u = u * u * (3 - 2 * u) * 0.5 + u * 0.5; // a gentle start
    if (i + 1 === list.length - 1) u = 1 - (1 - u) * (1 - u); // and a soft landing
    return { p: catmull(a.p, b.p, c.p, d.p, u), q: catmull(a.q, b.q, c.q, d.q, u) };
  }

  // The viewer's own look-around: drag to orbit, scroll or pinch to zoom; it eases back on its own.
  let yaw = 0, pitch = 0, zoom = 1, dragging = false;
  const pointers = new Map();
  const el = renderer.domElement;
  const onDown = (e) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragging = true; };
  const onMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pointers.values()];
      zoom = Math.min(1.6, Math.max(0.6, (zoom * before) / Math.max(1, Math.hypot(c.x - d.x, c.y - d.y))));
      return;
    }
    yaw = Math.max(-1.2, Math.min(1.2, yaw - (e.clientX - prev.x) * 0.006));
    pitch = Math.max(-0.6, Math.min(0.6, pitch + (e.clientY - prev.y) * 0.004));
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e) => { pointers.delete(e.pointerId); if (!pointers.size) dragging = false; };
  const onWheel = (e) => { e.preventDefault(); zoom = Math.min(1.6, Math.max(0.6, zoom * (1 + e.deltaY * 0.001))); };
  el.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  // ── Playing ───────────────────────────────────────────────────────────────
  let step = 0, t = 0, frozen = false;
  const off = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3(), view = new THREE.Vector3();

  return {
    root,
    environment,
    /** Starts shot `n` from its beginning (or, with reduced motion, at its end). */
    play(n, reduced) {
      step = n;
      t = reduced ? SHOT_LENGTHS[n] : 0;
      frozen = false;
      entry = { p: camPos.clone(), q: camTgt.clone() };
      trailPts.length = 0;
    },
    /** Holds shot `n` at `at` seconds (for tests and screenshots). */
    seek(n, at) { if (n !== step) this.play(n); t = at; frozen = true; },
    /**
     * Advances the story by `dt` and points `camera` at it. `capFrac` and `topFrac` are the
     * shares of the screen's height the caption and the header cover: the scene centres in
     * the band between them, stepping back if that band is shorter than the shots allow for.
     */
    frame(dt, now, camera, capFrac, topFrac, reduced) {
      if (!frozen) t = Math.min(SHOT_LENGTHS[step], t + dt);
      const S = { ket: glyphState(), colA: glyphState(), colB: glyphState(), bra: glyphState(), orbA: null, orbB: null, plus: 0, mirror: 0, eq: 0, trail: false };
      SHOTS[step](t, S);
      ket.set(S.ket); colA.set(S.colA); colB.set(S.colB); bra.set(S.bra);
      orbA.set(S.orbA); orbB.set(S.orbB);

      // the travelling pearl's trail
      if (S.trail && S.orbA) { trailPts.unshift(new THREE.Vector3(S.orbA.x, S.orbA.y, S.orbA.z)); if (trailPts.length > 28) trailPts.pop(); } else if (trailPts.length) trailPts.pop();
      trail.forEach((s, i) => {
        const p = trailPts[i * 2];
        s.visible = !!p;
        if (p) { s.position.copy(p); const k = 1 - i / trail.length; s.scale.setScalar(0.55 * k); s.material.opacity = 0.55 * k; s.material.color.copy(S.orbA ? S.orbA.col : PURPLE); }
      });

      plus.visible = S.plus > 0.01; plus.scale.setScalar(Math.max(S.plus, 0.001)); plus.rotation.z = (1 - S.plus) * Math.PI;
      mirror.visible = S.mirror > 0.01; mirror.scale.set(1, Math.max(S.mirror, 0.001), Math.max(S.mirror, 0.001));
      mirrorSheen.material.opacity = 0.35 + 0.2 * Math.sin(now * 3);
      eqOne.visible = S.eq > 0.01;
      if (eqOne.visible) {
        eqPlane.material.map = textTex('= 1', '#43e97b'); eqPlane.material.opacity = S.eq;
        eqOne.position.y = -0.4 * (1 - S.eq); eqOne.scale.setScalar(0.7 + 0.3 * S.eq); eqGlow.material.opacity = 0.6 * S.eq;
      }

      // The shots are framed for a 16:10 screen: narrower screens step back to keep that
      // width (portrait ones need about 62% of it), with a wider lens.
      const aspect = camera.aspect;
      camera.fov = aspect < 1 ? 58 : 42;
      const want = Math.tan((21 * Math.PI) / 180) * 1.6 * (aspect < 1 ? 0.62 : 1);
      const band = Math.max(0.3, 1 - capFrac - topFrac);
      const fit = Math.max(1, want / (Math.tan((camera.fov * Math.PI) / 360) * aspect), 0.73 / band);
      camera.updateProjectionMatrix();

      const c = cameraAt(step, t);
      if (!dragging) { yaw *= 0.96; pitch *= 0.96; }
      camTgt.copy(c.q);
      off.copy(c.p).sub(c.q).multiplyScalar(zoom * fit);
      if (!reduced) { off.x += Math.sin(now * 0.25) * 0.25; off.y += Math.sin(now * 0.31) * 0.12; }
      off.applyAxisAngle(up, yaw);
      side.crossVectors(up, off).normalize();
      off.applyAxisAngle(side, -pitch);
      camPos.copy(c.q).add(off);
      // shift the view so the scene sits centred between the header and the caption
      const lift = off.length() * Math.tan((camera.fov * Math.PI) / 360) * (capFrac - topFrac);
      camera.position.copy(camPos); camera.position.y -= lift;
      view.copy(camTgt); view.y -= lift;
      camera.lookAt(view);
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      owned.forEach((x) => x.dispose());
      texCache.forEach((x) => x.dispose());
      envRT.dispose();
    },
  };
}
