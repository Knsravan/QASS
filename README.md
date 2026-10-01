# QASS

**Quantum Reality. Decoded.** QASS (Quantum Algorithm State Simulator) is an interactive 3D quantum computing simulator that teaches the core ideas of quantum computing by letting you play with them, instead of reading about them.

Eleven guided modules take you from the difference between a bit and a qubit, through gates, interference and entanglement, up to decoherence and error correction. Every concept is a live, real-time scene: you rotate Bloch spheres, fire gates, collapse wavefunctions and watch the math update as you do it.

**Live demo:** https://qass.vercel.app

![QASS landing page](docs/screenshots/01-landing.jpg)

## Features

- **11 interactive modules**, each with a hands-on 3D scene, step-by-step guidance, plain-language analogies, a "common misconception" callout and KaTeX-rendered math.
- **Dual Reality engine.** Classical bits and qubits side by side, so you can see exactly what quantum adds.
- **Real quantum math.** Gate matrices, Bell states, measurement probabilities and state vectors are computed from the actual linear algebra and shown on screen.
- **A circuit diagram** for every module, one click away in the sidebar.
- **Synthesized soundscapes.** Every module has its own audio, generated live with the Web Audio API (no sound files), with a single mute control.
- **Liquid Glass interface.** Floating controls use a real refraction material (details below), with spring-driven motion and reduced-motion / reduced-transparency support.

![Module hub with the sidebar open](docs/screenshots/02-hub.jpg)

## The modules

| # | Module | What you do |
|---|--------|-------------|
| 1 | **Classical Bit vs Qubit** | Compare a rigid classical bit with a continuous Bloch-sphere state. |
| 2 | **Dirac Notation** | Step through kets, bras, amplitudes and the Born rule on a live state vector. |
| 3 | **Superposition & Measurement** | Apply a Hadamard, watch the vector sweep the equator, then collapse it. |
| 4 | **Classical vs Quantum Gates** | Apply Pauli-X/Y/Z, Hadamard, S and T gates and watch the rotation on the sphere. |
| 5 | **Multi-Qubit Gates** | Set the inputs, then apply CNOT, SWAP, Toffoli and CZ, plus an H + CNOT Bell-state step. |
| 6 | **Quantum Interference** | Drag H and Z gates onto a Mach-Zehnder interferometer, then explore a phase sandbox. |
| 7 | **Entanglement** | Build a Bell pair, measure one qubit, and see the other collapse instantly. |
| 8 | **Exponential State Space** | Add qubits one at a time and watch the state space double (2<sup>N</sup>). |
| 9 | **No-Cloning Theorem** | Copy a classical bit, then try, and fail, to copy a qubit. |
| 10 | **Decoherence & Noise** | Inject noise into a qubit and cool it to see coherence survive. |
| 11 | **Quantum Error Correction** | Strike a qubit with a bit-flip and recover it with parity checks. |

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/03-quantum-gates.jpg" alt="Pauli-X gate rotating the Bloch vector, with the explanation card"/><br/><sub><b>Gates:</b> applying Pauli-X, with the operator and an explanation.</sub></td>
    <td width="50%"><img src="docs/screenshots/04-superposition.jpg" alt="Superposition: the state vector sweeping the equator"/><br/><sub><b>Superposition:</b> the vector sweeps the equator before measurement.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/05-entanglement.jpg" alt="Entanglement: a measured Bell pair with correlation statistics"/><br/><sub><b>Entanglement:</b> measuring Alice collapses Bob, with live correlation stats.</sub></td>
    <td width="50%"><img src="docs/screenshots/06-exponential-state-space.jpg" alt="Exponential state space: five qubits and 32 basis states"/><br/><sub><b>Exponential state space:</b> five qubits, 32 basis states.</sub></td>
  </tr>
</table>

![Quantum interference module](docs/screenshots/07-interference.jpg)

## Getting started

You need a recent [Node.js](https://nodejs.org/) LTS and a desktop browser. Chrome or Edge gives the full glass effect (see below).

```bash
git clone https://github.com/Knsravan/QVerse.git
cd QVerse
npm install
npm start
```

The app opens at <http://localhost:3000>. Other scripts:

| Command | What it does |
|---------|--------------|
| `npm run build` | Optimized production build in `build/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run lint` | Lints the source (ESLint, fails on any warning) |

The simulator is designed for desktop and tablet screens. On narrow windows (under 768 px) it shows a message asking you to use a larger screen.

## Built with

- [React 19](https://react.dev/) and [Vite](https://vite.dev/)
- [three.js](https://threejs.org/) with [react-three-fiber](https://r3f.docs.pmnd.rs/), [drei](https://github.com/pmndrs/drei) and postprocessing (bloom, chromatic aberration)
- [GSAP](https://gsap.com/) and [react-spring](https://www.react-spring.dev/) for animation
- [KaTeX](https://katex.org/) for math rendering
- The Web Audio API for all sound design
- [Lucide](https://lucide.dev/) icons with [Morphicons](https://www.npmjs.com/package/morphicons) transitions

## How it is organized

| Path | What lives there |
|------|------------------|
| `src/App.jsx` | App shell: landing page, sidebar, module routing, mute and learning-mode state |
| `src/*Module.jsx`, `src/BlochSphere.jsx`, `src/QuantumGates.jsx`, ... | One file per module's 3D scene and overlay |
| `src/quantumMath.js` | State-vector, gate and measurement math |
| `src/use*Audio.js`, `src/sharedAudio.js` | Per-module sound design on one shared `AudioContext` |
| `src/LiquidGlass.js`, `src/GlassNavBar.jsx` | The Liquid Glass material and the floating tab bar |
| `scripts/generate_audio.js` | Optional: regenerates the narration clips (see below) |

### The Liquid Glass material

Floating controls (the tab bar, buttons, sidebar, tooltips) are rendered as Liquid Glass. `LiquidGlass.js` evaluates a rounded-rectangle signed-distance-field lens for each element on the CPU and feeds it to an SVG displacement filter inside `backdrop-filter`, so the content behind a surface bends at its edges. Each surface also gets a lit rim, saturation boost and tint. Refraction needs a Chromium-based browser; other browsers keep the blur, tint and rim without the bending.

The tab bar's selection indicator is a hand-written spring (damping 0.72, stiffness 320) that stretches while it travels, can be dragged, and can be interrupted mid-flight.

### Narration clips (optional)

`public/audio` holds a set of narration clips for the Superposition and Dirac Notation modules. The app does not play them yet. `scripts/generate_audio.js` can regenerate the Superposition ones with [ElevenLabs](https://elevenlabs.io/) using your own API key:

```bash
ELEVENLABS_API_KEY=your_key node scripts/generate_audio.js
```

## Roadmap

- **Advanced mode.** The Beginner / Advanced switch is in place, but the Advanced sandbox is not built yet and currently shows a "loading" placeholder.
- Wiring the narration clips into the Superposition and Dirac modules.
- A mobile-friendly layout.

## Acknowledgements

The Liquid Glass lens and highlight follow the approach of [Kyant0/backdrop](https://github.com/Kyant0/backdrop) (Apache-2.0), and the tab bar's structure and behavior are modeled on [BitChord](https://github.com/kushagrasinghx/BitChord) (which builds on Echo Music). Both were reimplemented for the web.
