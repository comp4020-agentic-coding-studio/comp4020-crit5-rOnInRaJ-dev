// Score is derived from horizontal distance traveled — the furthest right the
// ragdoll has reached, so falling back doesn't cost you points already earned.
export class ScoreTracker {
  private startX = 0;
  distance = 0;

  reset(startX: number) {
    this.startX = startX;
    this.distance = 0;
  }

  update(currentX: number) {
    this.distance = Math.max(this.distance, currentX - this.startX);
  }
}

// Best distance, kept in localStorage. Every access is guarded: private
// browsing and blocked site data make even reading it throw, and a high score
// is never worth taking the game down with it.
const BEST_KEY = "rooftop-swing:best";

export function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Stores `distance` if it beats the stored best. Returns the best either way. */
export function saveBest(distance: number): number {
  const best = Math.max(loadBest(), distance);
  try {
    localStorage.setItem(BEST_KEY, String(Math.round(best)));
  } catch {
    // No persistence available — the in-session number still works.
  }
  return best;
}
