/**
 * Liquid Glass — the behaviour layer. Zero dependencies, plain ES module.
 *
 *   import { mountLiquidGlass } from "./liquid-glass.js";
 *   const stop = mountLiquidGlass();          // sensible defaults
 *   // mountLiquidGlass({ lens: false, magnetic: ".lg-pill.lg-solo" })   // options below
 *
 * What it adds on top of liquid-glass.css:
 *  - lens:     Chromium only — builds an SVG displacement map so .lg-bar bends the page behind it (adds .lg-lens on <html>)
 *  - magnetic: buttons lean toward the cursor (mouse only)
 *  - glide:    elements with .lg-lean skew slightly with scroll speed and settle when scrolling stops (--lgs-glide on <html>)
 *  - split:    headings with [data-lg-split] rise letter by letter when they scroll into view (words never break)
 *  - progress: a thin line along the top showing how far down the page you are (if a .lg-progress element exists)
 * Everything respects prefers-reduced-motion (the look stays; the movement stops). Returns a cleanup function.
 */

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mountLiquidGlass(opts = {}) {
  const o = {
    magnetic: ".lg-pill, .lg-magnetic",           // controls that lean toward the cursor
    lens: true,                                   // Chromium refraction on .lg-bar
    lensStrength: 26,                             // displacement in px at the edges
    split: "[data-lg-split]",
    glide: true,                                  // scroll-speed lean + progress line (a per-frame loop; off for pages that never scroll)
    ...opts,
  };
  const root = document.documentElement, cleanups = [];

  // ---- lens: an edge-weighted displacement map (edges bend inward, the middle stays clear) ----
  if (o.lens && /Chrome\//.test(navigator.userAgent) && !document.getElementById("lg-liquid")) {
    const n = 128, c = document.createElement("canvas"); c.width = c.height = n;
    const g = c.getContext("2d"), img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const u = x / (n - 1) * 2 - 1, v = y / (n - 1) * 2 - 1;
      const ex = Math.max(0, Math.abs(u) - .55) / .45, ey = Math.max(0, Math.abs(v) - .3) / .7, i = (y * n + x) * 4;
      img.data[i] = 128 - Math.sign(u) * ex * ex * 127; img.data[i + 1] = 128 - Math.sign(v) * ey * ey * 127; img.data[i + 2] = 128; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const wrap = document.createElement("div");
    wrap.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="lg-liquid" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feImage href="${c.toDataURL()}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${o.lensStrength}" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
    const svg = wrap.firstElementChild; document.body.append(svg); root.classList.add("lg-lens");
    cleanups.push(() => { svg.remove(); root.classList.remove("lg-lens"); });
  }

  // ---- magnetic controls (mouse only: on touch it would just jitter) ----
  const lean = (e) => { const b = e.target.closest?.(o.magnetic); if (!b || reduced() || e.pointerType !== "mouse") return;
    const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .2}px, ${(e.clientY - r.top - r.height / 2) * .28}px)`; };
  const settle = (e) => { const b = e.target.closest?.(o.magnetic); if (b) b.style.transform = ""; };
  document.addEventListener("pointermove", lean, { passive: true });
  document.addEventListener("pointerout", settle, { passive: true });
  cleanups.push(() => { document.removeEventListener("pointermove", lean); document.removeEventListener("pointerout", settle); });

  // ---- glide (scroll-speed lean) and the progress line ----
  let lastY = scrollY, glide = 0, raf = 0;
  const bar = document.querySelector(".lg-progress");
  if (o.glide) {
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = scrollY - lastY; lastY = scrollY;
      const want = reduced() ? 0 : Math.max(-1.6, Math.min(1.6, v * .04));
      glide += (want - glide) * .12;
      if (Math.abs(glide) < .001 && want === 0) root.style.removeProperty("--lgs-glide");
      else root.style.setProperty("--lgs-glide", `${glide.toFixed(3)}deg`);
      if (bar) { const max = root.scrollHeight - innerHeight; bar.style.setProperty("--lgs-progress", String(max > 0 ? Math.min(1, scrollY / max) : 0)); }
    };
    raf = requestAnimationFrame(tick);
    cleanups.push(() => cancelAnimationFrame(raf));
  }

  // ---- letter-by-letter headings ----
  const heads = [...document.querySelectorAll(o.split)];
  for (const h of heads) {
    if (h.dataset.lgDone) continue; h.dataset.lgDone = "1";
    const text = h.textContent ?? ""; h.setAttribute("aria-label", text);
    let n = 0; h.textContent = "";
    text.split(/(\s+)/).forEach((w) => {
      if (!w) return;
      if (/^\s+$/.test(w)) { h.append(" "); return; }
      const word = document.createElement("span"); word.className = "lg-word"; word.setAttribute("aria-hidden", "true");
      for (const ch of w) { const s = document.createElement("span"); s.className = "lg-char"; s.style.setProperty("--lgs-c", String(n++)); s.textContent = ch; word.append(s); }
      h.append(word);
    });
  }
  if (heads.length) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("lg-in"); io.unobserve(e.target); } }), { threshold: .2 });
    heads.forEach((h) => io.observe(h));
    // headings stay visible until the script is running; a backup shows anything already on screen
    requestAnimationFrame(() => root.classList.add("lg-armed"));
    const sweep = setInterval(() => heads.forEach((h) => { const r = h.getBoundingClientRect(); if (r.top < innerHeight * .95 && r.bottom > 0) h.classList.add("lg-in"); }), 700);
    cleanups.push(() => { io.disconnect(); clearInterval(sweep); });
  }

  return () => cleanups.forEach((f) => f());
}
