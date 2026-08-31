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
