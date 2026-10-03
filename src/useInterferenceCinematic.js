import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { handoff } from './handoff';

export default function useInterferenceCinematic({ stage, subStage, camera, sceneRefs, audio, fromHub = false }) {
  const lookTarget = useRef(new THREE.Vector3(0, 0, 0));
  const fromHubRef = useRef(fromHub);
  fromHubRef.current = fromHub;

  // Read audio/sceneRefs through refs so unstable object identities from the
  // caller can never re-trigger the camera effects mid-flight.
  const audioRef = useRef(audio);
  audioRef.current = audio;
  const sceneRefsRef = useRef(sceneRefs);
  sceneRefsRef.current = sceneRefs;

  // ─── STAGE 1 INTRO: runs ONCE when camera is ready, NEVER re-runs on subStage change ───
  // This is the critical fix: the intro animation is completely isolated from subStage
  // so the 4-second timer (setSubStage(1)) cannot kill or interrupt it.
  useLayoutEffect(() => {
    if (!camera || stage !== 1) return;

    // Set FOV manually (no Canvas camera prop to avoid R3F override resets)
    camera.fov = 45;
    camera.updateProjectionMatrix();

    // Kill any lingering tweens from a previous visit
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(lookTarget.current);

    // Start far away, look at center synchronously to prevent 1-frame flash
    // Coming from the hub, the intro starts where the hub's lone qubit already is
    // (its camera, and the sphere at the hub's size and place) instead of far away,
    // then plays the same zoom and strafe.
    const intro = fromHubRef.current ? sceneRefsRef.current?.intro?.current : null;
    if (fromHubRef.current) camera.position.set(0, 0, 13); else camera.position.set(20, 10, 40);
    lookTarget.current.set(0, 0, 0);
    camera.lookAt(lookTarget.current);

    const tl = gsap.timeline({
      onUpdate: () => camera.lookAt(lookTarget.current)
    });
    if (intro) {
      // 0.7 (the hub's size) times how much bigger or smaller the hub's lone qubit was holding itself.
      intro.scale.setScalar(0.7 * handoff.qubitScale);
      handoff.qubitScale = 1;
      intro.position.y = -0.8;
      tl.to(intro.scale, { x: 1, y: 1, z: 1, duration: 2.5, ease: 'power2.inOut' }, 0);
      tl.to(intro.position, { y: 0, duration: 2.5, ease: 'power2.inOut' }, 0);
    }

    if (audioRef.current?.playCameraPan) audioRef.current.playCameraPan(2.5, 'zoom-in');

    // Step 1: Zoom in to center
    tl.to(camera.position, {
      x: 0, y: 1, z: 12,
      duration: 2.5,
      ease: 'power2.inOut'
    });

    // Step 2: Strafe camera + lookAt target rightward simultaneously
    // so the sphere appears to slide left and rest there
    tl.to(camera.position, {
      x: 3.5, y: 1, z: 12,
      duration: 2,
      ease: 'power2.inOut',
      onStart: () => {
        if (audioRef.current?.playCameraPan) audioRef.current.playCameraPan(2.0, 'strafe');
      }
    }, '+=0.2');

    tl.to(lookTarget.current, {
      x: 3.5, y: 0, z: 0,
      duration: 2,
      ease: 'power2.inOut'
    }, '<');

    const lookAtTarget = lookTarget.current;
    return () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(lookAtTarget);
    };
  }, [camera, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  // NOTE: deliberately excludes subStage so the 4s timer cannot interrupt the animation.

  // ─── STAGE 2 & 3: depends on subStage normally ───
  useLayoutEffect(() => {
    if (!camera) return;
    if (stage === 1) return; // Stage 1 is handled above

    // Stage 2: Guided Core
    if (stage === 2) {
      if (subStage === 0) {
        if (audioRef.current?.playCameraPan) audioRef.current.playCameraPan(2.0, 'zoom-in');
        const tl = gsap.timeline({
          onUpdate: () => camera.lookAt(lookTarget.current)
        });
        tl.to(camera.position, {
          x: 5, y: 3, z: 10,
          duration: 2,
          ease: 'power3.inOut'
        });
        tl.to(lookTarget.current, {
          x: 0, y: 0, z: 0,
          duration: 2,
          ease: 'power3.inOut'
        }, '<');
      }
      else if (subStage === 1 || subStage === 2 || subStage === 3) {
        if (subStage === 1) { // Only play once when it initiates the move
          if (audioRef.current?.playCameraPan) audioRef.current.playCameraPan(2.5, 'top-down');
        }
        const tl = gsap.timeline({
          onUpdate: () => camera.lookAt(lookTarget.current)
        });
        tl.to(camera.position, {
          x: 0, y: 14, z: 0.01,
          duration: 2.5,
          ease: 'power3.inOut'
        });
        tl.to(lookTarget.current, {
          x: 0, y: 0, z: 0,
          duration: 2.5,
          ease: 'power3.inOut'
        }, '<');
      }
    }

    // Stage 3: Interactive Sandbox
    else if (stage === 3) {
      if (subStage === 0) {
        gsap.to(camera.position, {
          x: 0, y: 14, z: 0.01,
          duration: 2,
          ease: 'power2.out'
        });
      }
    }

    const lookAtTarget = lookTarget.current;
    return () => {
      gsap.killTweensOf(camera.position);
      gsap.killTweensOf(lookAtTarget);
      if (sceneRefsRef.current?.magentaWave?.current) {
        gsap.killTweensOf(sceneRefsRef.current.magentaWave.current.rotation);
      }
    };
  }, [stage, subStage, camera]);
}
