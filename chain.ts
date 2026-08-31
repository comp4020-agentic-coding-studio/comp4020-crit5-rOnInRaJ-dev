import type { Particle } from "./ragdoll.ts";
import type { Vector2 } from "./types.ts";

// Grabbing a surface you're already touching would otherwise pin the hand at
// zero length and snap the body into the wall.
const MIN_LENGTH = 40;

// How fast holding reel shortens the rope, in px/s. This is the energy pump:
// the clamp moves `pos` inward without touching `prev`, so every reeled pixel
// becomes inward velocity that the swing converts into speed at the bottom of
// the arc — the same trick as pulling your legs in on a playground swing.
const REEL_SPEED = 520;

/**
 * A chain, not a rod: slack inside max length applies no force at all, and
 * going taut clamps the hand back to max length.
 *
 * Under Verlet that clamp is the entire physics. Velocity is the gap between
 * `pos` and `prev`, so pulling `pos` back toward the anchor without touching
 * `prev` removes exactly the outward motion that overshot — and leaves the
 * tangential component alone, which is what keeps the swing alive.
 */
export class Chain {
  anchor: Vector2 | null = null;
  maxLength = 0;

  get active(): boolean {
    return this.anchor !== null;
  }

  attach(anchor: Vector2, hand: Vector2) {
    this.anchor = anchor;
    this.maxLength = Math.max(MIN_LENGTH, Math.hypot(anchor.x - hand.x, anchor.y - hand.y));
  }

  /**
   * Shorten the rope while the player holds reel. Slack gets taken up first
   * (free), and once taut this is doing real work on the body — which is the
   * point: a swing that only ever clamps bleeds energy and dies.
   */
  reel(dt: number) {
    if (!this.anchor) return;
    this.maxLength = Math.max(MIN_LENGTH, this.maxLength - REEL_SPEED * dt);
  }

  detach() {
    this.anchor = null;
    this.maxLength = 0;
  }

  constrain(hand: Particle) {
    if (!this.anchor) return;
    const dx = hand.pos.x - this.anchor.x;
    const dy = hand.pos.y - this.anchor.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= this.maxLength || dist === 0) return; // slack: no force

    const scale = this.maxLength / dist;
    hand.pos.x = this.anchor.x + dx * scale;
    hand.pos.y = this.anchor.y + dy * scale;
  }
}
