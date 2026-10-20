// Storage can be unavailable (privacy modes, blocked site data); the app must
// still load, it just won't remember the visitor's choices.
export const readStorage = (key) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
export const writeStorage = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* not persisted */ }
};
