import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SIDEBAR_MARGIN, SIDEBAR_PANEL, sidebarFootprint } from './sidebarLayout';

// The numbers the scenes and overlays lay out by must be the stylesheet's.
const css = readFileSync(new URL('./styles/layout-sidebar.css', import.meta.url), 'utf8');
const rule = (selector) => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
const px = (block, prop) => Number(block.match(new RegExp(`(?:^|[;\\s])${prop}:\\s*(\\d+)px`))?.[1]);

test('the sidebar footprint matches layout-sidebar.css', () => {
  expect(px(rule('.sidebar-wrapper'), 'margin')).toBe(SIDEBAR_MARGIN);
  expect(px(rule('.sidebar-panel'), 'width')).toBe(SIDEBAR_PANEL.open);
  expect(px(rule('.sidebar-panel.collapsed'), 'width')).toBe(SIDEBAR_PANEL.collapsed);
  expect(sidebarFootprint(true)).toBe(420);
  expect(sidebarFootprint(false)).toBe(112);
});
