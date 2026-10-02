import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/*
 * The landing page's centrepiece: a breathing shell of light points around a
 * real hydrogen 2p_z orbital, wrapped in three wave ribbons.
 *
 * - Shell: points on a Fibonacci sphere, pushed in and out by slow waves and
 *   brightest where the surface turns away from the eye.
 * - Orbital: points sampled from |psi|^2 = z^2 e^-r (in Bohr radii); each is
 *   coloured by the sign of psi, cyan for the + lobe and violet for the -.
 * - Ribbons: twisting strips that ripple like wavefunctions, drawn in the
 *   vertex shader so they cost no work on the CPU.
 *
 * Everything is additive light, so the scene's Bloom makes it glow. Bloom
 * spreads a single NaN or infinite pixel into a big white blob, so pow()
 * bases are clamped at 0 and the ribbons drop any such pixel outright.
 */

const CYAN = new THREE.Color('#3ee6ff');
const VIOLET = new THREE.Color('#b06cff');
const BLUE = new THREE.Color('#4f8dff');
const PINK = new THREE.Color('#ff6ad5');
const SKY = new THREE.Color('#5ad1ff');
const ADDITIVE = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

const SHELL_RADIUS = 3.7;
const SHELL_POINTS = 7000;
const ORBITAL_POINTS = 5200;

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.2, 'rgba(255,255,255,.55)');
  r.addColorStop(0.5, 'rgba(255,255,255,.12)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function Shell() {
  const dpr = useThree((state) => state.gl.getPixelRatio());
  const ref = useRef();
  const { geometry, material } = useMemo(() => {
    const pos = new Float32Array(SHELL_POINTS * 3);
    for (let i = 0; i < SHELL_POINTS; i++) {
      const y = 1 - (i / (SHELL_POINTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963229728653; // golden angle
      pos[i * 3] = Math.cos(th) * r * SHELL_RADIUS;
      pos[i * 3 + 1] = y * SHELL_RADIUS;
      pos[i * 3 + 2] = Math.sin(th) * r * SHELL_RADIUS;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: dpr } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPx;
        varying float vD;
        varying float vF;
        void main() {
          vec3 n = normalize(position);
          float d = .22 * sin(n.x * 5. + uTime * .9) * cos(n.y * 4. - uTime * .6) + .12 * sin(n.z * 8. + uTime * 1.3);
          vD = d;
          vec4 mv = modelViewMatrix * vec4(position + n * d, 1.);
          vec3 nv = normalize(normalMatrix * n);
          vF = pow(max(1. - abs(dot(nv, normalize(-mv.xyz))), 0.), 1.6);
          gl_PointSize = (1.3 + 2.2 * vF) * uPx * (14. / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vD;
        varying float vF;
        void main() {
          float a = smoothstep(.5, 0., length(gl_PointCoord - .5));
          vec3 col = mix(vec3(.24, .9, 1.), vec3(.69, .42, 1.), smoothstep(-.2, .25, vD));
          float k = (.18 + .8 * vF) * a;
          gl_FragColor = vec4(col * k, k);
        }`,
      ...ADDITIVE,
    });
    return { geometry: geo, material: mat };
  }, [dpr]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    if (ref.current) ref.current.rotation.y = t * 0.05;
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

function Orbital({ glow }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    const pos = new Float32Array(ORBITAL_POINTS * 3);
    const col = new Float32Array(ORBITAL_POINTS * 3);
    const scale = 0.3; // 9 Bohr radii -> 2.7 units, inside the shell
    let k = 0;
    while (k < ORBITAL_POINTS) {
      const x = (Math.random() * 2 - 1) * 9;
      const y = (Math.random() * 2 - 1) * 9;
      const z = (Math.random() * 2 - 1) * 9;
      const r = Math.hypot(x, y, z);
      // Rejection sampling: z^2 e^-r peaks at 4/e^2 ~ 0.54.
      if (Math.random() * 0.55 < z * z * Math.exp(-r)) {
        pos[k * 3] = x * scale;
        pos[k * 3 + 1] = z * scale; // the orbital's axis points up the screen
        pos[k * 3 + 2] = y * scale;
        const c = z > 0 ? CYAN : VIOLET;
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
        k++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ref.current) {
      ref.current.rotation.y = t * 0.12;
      ref.current.rotation.z = Math.sin(t * 0.2) * 0.2;
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.05} vertexColors opacity={0.75} map={glow} {...ADDITIVE} />
    </points>
  );
}

const RIBBON_SEGMENTS = 700;

function WaveRibbon({ radius, width, halfTwists, phase, colorA, colorB, tilt, spin }) {
  const ref = useRef();
  const { geometry, material } = useMemo(() => {
    const n = RIBBON_SEGMENTS;
    const u = new Float32Array((n + 1) * 2);
    const v = new Float32Array((n + 1) * 2);
    const index = [];
    for (let i = 0; i <= n; i++) {
      u[i * 2] = u[i * 2 + 1] = i / n;
      v[i * 2] = -1;
      v[i * 2 + 1] = 1;
      if (i < n) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    // Placeholder positions: the vertex shader computes the real ones.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 6), 3));
    geo.setAttribute('aU', new THREE.BufferAttribute(u, 1));
    geo.setAttribute('aV', new THREE.BufferAttribute(v, 1));
    geo.setIndex(index);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uR: { value: radius }, uW: { value: width }, uK: { value: halfTwists },
        uPh: { value: phase }, cA: { value: colorA }, cB: { value: colorB },
      },
      vertexShader: /* glsl */ `
        attribute float aU;
        attribute float aV;
        uniform float uTime, uR, uW, uK, uPh;
        varying float vU;
        varying float vV;
        varying float vSide;
        vec3 centre(float a) {
          float R = uR + .28 * sin(3. * a + uTime * .7 + uPh);
          return vec3(cos(a), sin(a), 0.) * R + vec3(0., 0., .35 * sin(2. * a - uTime * .5 + uPh));
        }
        void main() {
          float a = aU * 6.2831853;
          vec3 rad = vec3(cos(a), sin(a), 0.);
          vec3 c = centre(a);
          float tw = uK * a * .5 + uTime * .35 + uPh;
          vec3 w = cos(tw) * rad + sin(tw) * vec3(0., 0., 1.);
          float width = uW * (.55 + .45 * sin(4. * a + uTime * .9 + uPh));
          vec4 mv = modelViewMatrix * vec4(c + w * aV * width, 1.);
          // Where the ribbon runs straight at the viewer, a long stretch of it
          // stacks up on a few pixels and the additive light (then the bloom)
          // blows out into a white blob: fade it by how side-on it is.
          vec3 tangent = normalize((modelViewMatrix * vec4(centre(a + .01) - c, 0.)).xyz);
          vSide = length(cross(tangent, normalize(-mv.xyz)));
          vU = aU;
          vV = aV;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 cA, cB;
        varying float vU;
        varying float vV;
        varying float vSide;
        void main() {
          float edge = 1. - vV * vV;
          edge *= edge;
          float band = pow(max(.5 + .5 * sin(vU * 6.2831853 * 3. - uTime * 1.2), 0.), 5.);
          float threads = .35 * pow(abs(sin(vV * 9.)), 18.);
          vec3 col = mix(cA, cB, .5 + .5 * sin(vU * 6.2831853 + uTime * .25));
          float a = (edge * (.28 + 1.05 * band) + threads * edge * 1.05) * vSide * vSide;
          gl_FragColor = vec4(mix(col, vec3(1.), band * .35) * a, a);
          // A NaN/Inf pixel would bloom into a white blob (seen where a ribbon
          // turns end-on): drop it.
          if (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.);
          gl_FragColor = clamp(gl_FragColor, 0., 1.);
        }`,
      side: THREE.DoubleSide,
      ...ADDITIVE,
    });
    return { geometry: geo, material: mat };
  }, [radius, width, halfTwists, phase, colorA, colorB]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    if (ref.current) ref.current.rotation.z = t * spin;
  });

  return <mesh ref={ref} geometry={geometry} material={material} rotation={tilt} frustumCulled={false} />;
}

export default function LandingOrbitalCloud() {
  const glow = useMemo(glowTexture, []);
  return (
    <>
      <Shell />
      <Orbital glow={glow} />
      <sprite scale={[0.8, 0.8, 0.8]}>
        <spriteMaterial map={glow} color="#ffffff" opacity={0.9} {...ADDITIVE} />
      </sprite>
      <WaveRibbon radius={4.6} width={0.75} halfTwists={3} phase={0} colorA={CYAN} colorB={BLUE} tilt={[1.1, 0.15, 0]} spin={0.06} />
      <WaveRibbon radius={5.3} width={0.6} halfTwists={5} phase={2.1} colorA={VIOLET} colorB={PINK} tilt={[-0.6, 0.75, 0.2]} spin={-0.05} />
      <WaveRibbon radius={6.0} width={0.45} halfTwists={1} phase={4.2} colorA={SKY} colorB={VIOLET} tilt={[0.25, 1.35, 0.55]} spin={0.04} />
    </>
  );
}
