import type { Ragdoll } from "./ragdoll.ts";
import type { Vector2 } from "./types.ts";

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// A chain, not a rod: slack inside max length applies no force at all; only
// once taut does it clamp position and kill the outward velocity component,
// leaving the tangential (swinging) component untouched.
export class Chain {
  anchor: Vector2 | null = null;
  maxLength = 0;

  get active(): boolean {
    return this.anchor !== null;
  }

  attach(anchor: Vector2, ragdollHand: Vector2) {
    this.anchor = anchor;
    this.maxLength = distance(anchor, ragdollHand);
  }

  detach() {
    this.anchor = null;
    this.maxLength = 0;
  }

  constrain(ragdoll: Ragdoll) {
    if (!this.anchor) return;
    const hand = ragdoll.handWorldPos();
    const dx = hand.x - this.anchor.x;
    const dy = hand.y - this.anchor.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= this.maxLength || dist === 0) return; // slack: no force

    const nx = dx / dist;
    const ny = dy / dist;
    const clampedHandX = this.anchor.x + nx * this.maxLength;
    const clampedHandY = this.anchor.y + ny * this.maxLength;
    // Translate the whole ragdoll by the same delta as the hand, since the
    // hand is a fixed offset from its position.
    ragdoll.pos.x += clampedHandX - hand.x;
    ragdoll.pos.y += clampedHandY - hand.y;

    const radialSpeed = ragdoll.vel.x * nx + ragdoll.vel.y * ny;
    if (radialSpeed > 0) {
      ragdoll.vel.x -= radialSpeed * nx;
      ragdoll.vel.y -= radialSpeed * ny;
    }
  }
}
