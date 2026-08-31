import type { Vector2 } from "./types.ts";

// Keep the ragdoll slightly left of center so there's room to see what's
// coming, rather than dead-centering it.
const HORIZONTAL_BIAS = 0.35;

export class Camera {
  x = 0;
  y = 0;

  follow(target: Vector2, viewportWidth: number, viewportHeight: number) {
    this.x = target.x - viewportWidth * HORIZONTAL_BIAS;
    this.y = target.y - viewportHeight / 2;
  }
}
