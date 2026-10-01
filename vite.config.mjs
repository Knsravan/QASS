import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, open: true },
  preview: { port: 3000 },
  build: {
    // Keep CRA's output folder so existing deploy settings keep working.
    outDir: 'build',
    // three.js alone is ~700 kB before gzip; that's expected for a 3D app.
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        // Libraries change far less often than app code, so give them their
        // own long-lived chunks: a redeploy then only invalidates app code.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 20 },
            { name: 'r3f', test: /node_modules[\\/](@react-three|three-stdlib|postprocessing|n8ao|maath|camera-controls|troika-|@react-spring|@monogrid)/, priority: 10 },
            { name: 'katex', test: /node_modules[\\/](katex|react-katex)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
