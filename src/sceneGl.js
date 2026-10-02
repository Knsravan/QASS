// WebGL settings shared by the full-screen 3D scenes. preserveDrawingBuffer
// keeps each frame readable after it is shown, so glassLight.js can see when
// a bright beam passes behind a piece of glass.
export const SCENE_GL = { powerPreference: 'high-performance', alpha: true, antialias: true, preserveDrawingBuffer: true };
