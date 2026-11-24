// TIDE & THUNDER — save game: cash, mission progress and totals in localStorage.
// The save never leaves the player's own browser.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return {
      cash: data.cash,
      missionIndex: data.missionIndex,
      completedCount: data.completedCount || 0,
      totalEarned: data.totalEarned || 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      completedCount: state.completedCount,
      totalEarned: state.totalEarned,
    }));
  } catch {
    // Private mode or full storage: the game keeps going without a save.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
