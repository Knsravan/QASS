// WebGL settings shared by the full-screen 3D scenes. The drawing buffer is
// not preserved (that costs memory bandwidth every frame): glassLight.js reads
// the scenes right after they draw, in the same frame.
export const SCENE_GL = { powerPreference: 'high-performance', alpha: true, antialias: true };
