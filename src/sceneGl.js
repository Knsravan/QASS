// WebGL settings shared by the full-screen 3D scenes. preserveDrawingBuffer
// keeps each frame readable after it is shown, so glassLight.js can sample
// what's behind a piece of glass and switch it to a light tone over bright 3D.
export const SCENE_GL = { powerPreference: 'high-performance', alpha: true, antialias: true, preserveDrawingBuffer: true };
