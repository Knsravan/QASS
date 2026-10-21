// How much of the window's width the sidebar takes, its margin included
// (layout-sidebar.css: a 380px panel, 72px collapsed, 20px from the edges).
// The overlays sit in the space to its right, and the scenes move their
// centre over by half of it (CameraShifter).
export const SIDEBAR_MARGIN = 20;
export const SIDEBAR_PANEL = { open: 380, collapsed: 72 };

export const sidebarFootprint = (open) => (open ? SIDEBAR_PANEL.open : SIDEBAR_PANEL.collapsed) + 2 * SIDEBAR_MARGIN;
