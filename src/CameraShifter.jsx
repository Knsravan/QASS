import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sidebarFootprint } from './sidebarLayout';

export default function CameraShifter({ isSidebarOpen }) {
  const { camera, size } = useThree();
  const targetSidebarWidth = sidebarFootprint(isSidebarOpen);
  const currentSidebarWidth = useRef(targetSidebarWidth);

  useFrame((state, delta) => {
    if (currentSidebarWidth.current === targetSidebarWidth) return;

    currentSidebarWidth.current = THREE.MathUtils.damp(currentSidebarWidth.current, targetSidebarWidth, 4, delta);
    if (Math.abs(currentSidebarWidth.current - targetSidebarWidth) < 0.05) {
      currentSidebarWidth.current = targetSidebarWidth;
    }
    const shiftX = -(currentSidebarWidth.current / 2);

    if (state.camera.setViewOffset) {
      state.camera.setViewOffset(state.size.width, state.size.height, shiftX, 0, state.size.width, state.size.height);
    }
  });

  useEffect(() => {
    const shiftX = -(currentSidebarWidth.current / 2);
    if (camera.setViewOffset) {
      camera.setViewOffset(size.width, size.height, shiftX, 0, size.width, size.height);
    }
  }, [camera, size]);

  useEffect(() => {
    return () => {
      if (camera.clearViewOffset) camera.clearViewOffset();
    };
  }, [camera]);

  return null;
}

