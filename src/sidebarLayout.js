// How much of the window's width the sidebar takes, its margin included
// (layout-sidebar.css: a 380px panel, 72px collapsed, 20px from the edges).
// The overlays sit in the space to its right, and the scenes move their
// centre over by half of it (CameraShifter).
export const SIDEBAR_MARGIN = 20;
export const SIDEBAR_PANEL = { open: 380, collapsed: 72 };

export const sidebarFootprint = (open) => (open ? SIDEBAR_PANEL.open : SIDEBAR_PANEL.collapsed) + 2 * SIDEBAR_MARGIN;

// Beside the open sidebar the stage needs at least this much width. A window too
// narrow for that keeps the stage whole: the sidebar opens over it, on a solid
// backing (Simulator.jsx), rather than squeezing the scene and its readouts into
// a strip it would cover anyway.
export const MIN_STAGE = 600;
export const sidebarOverlays = (windowWidth) => windowWidth - sidebarFootprint(true) < MIN_STAGE;
