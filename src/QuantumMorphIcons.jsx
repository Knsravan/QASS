import React from 'react';
import { MorphIcon } from 'morphicons/react';
import {
  Atom,
  Binary,
  Brackets,
  Variable,
  Orbit,
  Sparkles,
  Layers,
  Cpu,
  Workflow,
  GitFork,
  Activity,
  Waves,
  Link2,
  Infinity as InfinityIcon,
  LineChart,
  TrendingUp,
  Lock,
  CopyX,
  Timer,
  Flame,
  Shield,
  ShieldCheck,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Compass,
  ArrowRight,
  Zap,
  Sparkle
} from 'lucide';

// =============================================================================
// QUANTUM MORPHICONS MAPPING (Smooth Spring, Stroke: 1)
// =============================================================================
export const MODULE_MORPH_ICONS = {
  'bit-vs-qubit': { resting: Binary, active: Atom },
  'dirac-notation': { resting: Brackets, active: Variable },
  'superposition': { resting: Orbit, active: Sparkles },
  'gates': { resting: Layers, active: Cpu },
  'multi-qubit-gates': { resting: Workflow, active: GitFork },
  'interference': { resting: Activity, active: Waves },
  'entanglement': { resting: Link2, active: InfinityIcon },
  'exponential': { resting: LineChart, active: TrendingUp },
  'nocloning': { resting: Lock, active: CopyX },
  'decoherence': { resting: Timer, active: Flame },
  'error-correction': { resting: Shield, active: ShieldCheck },
  'default': { resting: Sparkle, active: Atom }
};

/**
 * Universal Quantum Module MorphIcon Component
 * Morphs seamlessly between resting and active states with Smooth spring physics and stroke 1
 */
export const QuantumModuleIcon = React.memo(function QuantumModuleIcon({ moduleId, isActive, color, size = 20, isHovered = false }) {
  const iconPair = MODULE_MORPH_ICONS[moduleId] || MODULE_MORPH_ICONS.default;
  const currentIcon = (isActive || isHovered) ? iconPair.active : iconPair.resting;

  return (
    <MorphIcon
      icon={currentIcon}
      spring="smooth"
      strokeWidth={1}
      size={size}
      color={color || 'currentColor'}
      style={{ display: 'inline-flex', verticalAlign: 'middle' }}
    />
  );
});

/**
 * Morphing Audio Volume Icon
 */
export const MorphAudioIcon = React.memo(function MorphAudioIcon({ isMuted, size = 20, color = 'currentColor' }) {
  return (
    <MorphIcon
      icon={isMuted ? VolumeX : Volume2}
      spring="smooth"
      strokeWidth={1.8}
      size={size}
      color={color}
    />
  );
});

/**
 * Morphing Sidebar Collapse Tab Icon
 */
export const MorphSidebarTabIcon = React.memo(function MorphSidebarTabIcon({ isCollapsed, size = 18, color = 'currentColor' }) {
  return (
    <MorphIcon
      icon={isCollapsed ? ChevronRight : ChevronLeft}
      spring="smooth"
      strokeWidth={1}
      size={size}
      color={color}
    />
  );
});

/**
 * Morphing Circuit Drawer Toggle Icon
 */
export const MorphCircuitToggleIcon = React.memo(function MorphCircuitToggleIcon({ isOpen, size = 16, color = 'currentColor' }) {
  return (
    <MorphIcon
      icon={isOpen ? ChevronUp : ChevronDown}
      spring="smooth"
      strokeWidth={1}
      size={size}
      color={color}
    />
  );
});

// Re-exported for the pieces that draw a single icon of their own.
export { MorphIcon, Atom, Variable, Zap, Compass, ArrowRight };
