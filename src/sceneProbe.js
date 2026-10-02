/*
 * Reads a small thumbnail of a 3D scene without making the page wait.
 *
 * Reading a WebGL canvas the usual way (drawImage + getImageData) blocks the
 * main thread until the GPU has finished every frame queued so far: on a slow
 * GPU that was most of the frame time. Here the GPU shrinks the frame itself
 * (blitFramebuffer into a small buffer) and copies it into a pixel buffer
 * asynchronously (readPixels into a PIXEL_PACK_BUFFER with a fence); the
 * pixels are collected a frame or more later, once the fence says the copy
 * is done. three.js caches GL bindings, so every binding touched here is put
 * back exactly as it was.
 *
 * probeScene(canvas, w, h) must run right after the scene has drawn (in an
 * animation frame queued after the scene's own), since the scenes don't
 * preserve their drawing buffer. It resolves to RGBA rows, bottom row first,
 * or null if the canvas can't be read this way (not WebGL2, context lost).
 */

const probes = new WeakMap(); // canvas -> GL objects for its thumbnail

function setup(canvas) {
  if (probes.has(canvas)) return probes.get(canvas);
  let p = null;
  try {
    const gl = canvas.getContext('webgl2');
    if (gl && !gl.isContextLost()) {
      p = { gl, fbo: gl.createFramebuffer(), rb: gl.createRenderbuffer(), pbo: gl.createBuffer(), w: 0, h: 0, msFbo: null, msRb: null, msW: 0, msH: 0, pending: false };
    }
  } catch { p = null; }
  probes.set(canvas, p);
  return p;
}

function sizeRenderbuffer(gl, rb, w, h) {
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
}

export function probeScene(canvas, w, h) {
  const p = setup(canvas);
  if (!p || p.pending || p.gl.isContextLost()) return Promise.resolve(null);
  const { gl } = p;
  const W = gl.drawingBufferWidth;
  const H = gl.drawingBufferHeight;
  if (W < 2 || H < 2) return Promise.resolve(null);

  // Everything three.js may have bound, to put back afterwards.
  const prevRead = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
  const prevDraw = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
  const prevRb = gl.getParameter(gl.RENDERBUFFER_BINDING);
  const prevPack = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
  const scissor = gl.isEnabled(gl.SCISSOR_TEST);
  const fence = { sync: null };

  try {
    if (scissor) gl.disable(gl.SCISSOR_TEST);
    if (p.w !== w || p.h !== h) {
      sizeRenderbuffer(gl, p.rb, w, h);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, p.fbo);
      gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, p.rb);
      p.w = w;
      p.h = h;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.pbo);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, w * h * 4, gl.STREAM_READ);
    }
    // A multisampled (antialiased) frame can't be shrunk in one blit:
    // resolve it at full size first.
    let source = null;
    if (gl.getContextAttributes()?.antialias) {
      if (!p.msFbo) { p.msFbo = gl.createFramebuffer(); p.msRb = gl.createRenderbuffer(); }
      if (p.msW !== W || p.msH !== H) {
        sizeRenderbuffer(gl, p.msRb, W, H);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, p.msFbo);
        gl.framebufferRenderbuffer(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, p.msRb);
        p.msW = W;
        p.msH = H;
      }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, p.msFbo);
      gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      source = p.msFbo;
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, source);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, p.fbo);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, p.fbo);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.pbo);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    fence.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  } catch {
    fence.sync = null;
  } finally {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, prevRead);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, prevDraw);
    gl.bindRenderbuffer(gl.RENDERBUFFER, prevRb);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, prevPack);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
  }
  if (!fence.sync) return Promise.resolve(null);

  p.pending = true;
  return new Promise((resolve) => {
    let tries = 0;
    const poll = () => {
      if (gl.isContextLost()) { p.pending = false; resolve(null); return; }
      const status = gl.clientWaitSync(fence.sync, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED && ++tries < 30) { requestAnimationFrame(poll); return; }
      gl.deleteSync(fence.sync);
      p.pending = false;
      if (status === gl.WAIT_FAILED || status === gl.TIMEOUT_EXPIRED) { resolve(null); return; }
      const pixels = new Uint8Array(w * h * 4);
      const prev = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.pbo);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, prev);
      resolve(pixels);
    };
    requestAnimationFrame(poll);
  });
}
