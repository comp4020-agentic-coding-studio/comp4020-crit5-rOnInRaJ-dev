import { PHYSICS_STEP, type Particle } from "./ragdoll.ts";
import type { Vector2 } from "./types.ts";

// Grabbing a surface you're already touching would otherwise pin the hand at
// zero length and snap the body into the wall.
const MIN_LENGTH = 40;

// How fast holding reel shortens the rope, in px/s.
const REEL_SPEED = 520;
// Reeling stops here rather than at MIN_LENGTH, so the player can't wind
// themselves onto the anchor and spin on the spot.
const MIN_REEL_LENGTH = 140;
// Ceiling on the pump, px/s. Angular momentum conservation is a 1/r law and
// runs away as the rope gets short; without this a long reel ends in a body
// moving faster than the camera can follow.
const MAX_TANGENTIAL = 2400;

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
   * Shorten the rope while the player holds reel — the swing's energy pump.
   *
   * Slack is taken up for free. Once taut, the tangential velocity is scaled
   * by r/r': a skater pulling their arms in. That conservation step is the
   * whole mechanic — a bare positional clamp leaves tangential speed flat, so
   * shortening the rope on its own actually loses energy to the clamp instead
   * of gaining it.
   */
  reel(hand: Particle, dt: number) {
    if (!this.anchor) return;
    const next = Math.max(MIN_REEL_LENGTH, this.maxLength - REEL_SPEED * dt);
    if (next >= this.maxLength) return;
    this.maxLength = next;

    const dx = hand.pos.x - this.anchor.x;
    const dy = hand.pos.y - this.anchor.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= next || dist === 0) return; // still slack: no work done

    const ux = dx / dist;
    const uy = dy / dist;
    const vx = hand.pos.x - hand.prev.x;
    const vy = hand.pos.y - hand.prev.y;
    const radial = vx * ux + vy * uy;
    const tx = vx - radial * ux;
    const ty = vy - radial * uy;
    const tangential = Math.hypot(tx, ty);
    if (tangential === 0) return;

    const boosted = Math.min(tangential * (dist / next), MAX_TANGENTIAL * PHYSICS_STEP);
    const scale = boosted / tangential;
    hand.prev.x = hand.pos.x - (radial * ux + tx * scale);
    hand.prev.y = hand.pos.y - (radial * uy + ty * scale);
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
