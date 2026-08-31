import { GROUND_Y, hash } from "./city.ts";
import type { Vector2 } from "./types.ts";

// Tokens are derived from their index, not stored in a list: token i always
// sits at the same place, so there is nothing to spawn, cull or keep in sync
// with the city. The only state is which indices have been eaten.
const SPACING = 1100;
const MIN_ALTITUDE = 420;
const MAX_ALTITUDE = 1900;
export const TOKEN_RADIUS = 30;

// The payout, in px/s added to every particle. Forward-and-up: a boost should
// buy height to spend on the next swing, not just fling you at the road.
export const BOOST_VX = 620;
export const BOOST_VY = -520;

export function tokenAt(index: number): Vector2 {
  return {
    x: index * SPACING + hash(index * 5.7) * SPACING * 0.6,
    y: GROUND_Y - (MIN_ALTITUDE + hash(index * 12.9) * (MAX_ALTITUDE - MIN_ALTITUDE)),
  };
}

export class Tokens {
  private taken = new Set<number>();

  reset() {
    this.taken.clear();
  }

  /** Indices whose token is inside [fromX, toX] and still uncollected. */
  live(fromX: number, toX: number): number[] {
    const out: number[] = [];
    // The jitter can push a token up to 0.6 spacings right of its slot, so
    // start one slot early or the leftmost one pops in late.
    for (let i = Math.floor(fromX / SPACING) - 1; i <= Math.ceil(toX / SPACING); i++) {
      if (i < 0 || this.taken.has(i)) continue;
      const x = tokenAt(i).x;
      if (x >= fromX && x <= toX) out.push(i);
    }
    return out;
  }

  /** Eat any token the body is touching. Returns how many were collected. */
  collect(body: Vector2, bodyRadius: number): number {
    const reach = TOKEN_RADIUS + bodyRadius;
    let count = 0;
    for (const i of this.live(body.x - reach, body.x + reach)) {
      const t = tokenAt(i);
      if (Math.hypot(t.x - body.x, t.y - body.y) > reach) continue;
      this.taken.add(i);
      count++;
    }
    return count;
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, width: number, time: number) {
    for (const i of this.live(camX - TOKEN_RADIUS, camX + width + TOKEN_RADIUS)) {
      const t = tokenAt(i);
      const x = t.x - camX;
      // Bob, so a token reads as a pickup rather than as level geometry.
      const y = t.y - camY + Math.sin(time * 2 + i) * 8;

      const glow = ctx.createRadialGradient(x, y, 0, x, y, TOKEN_RADIUS * 2);
      glow.addColorStop(0, "rgba(120, 240, 200, 0.45)");
      glow.addColorStop(1, "rgba(120, 240, 200, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - TOKEN_RADIUS * 2, y - TOKEN_RADIUS * 2, TOKEN_RADIUS * 4, TOKEN_RADIUS * 4);

      ctx.beginPath();
      ctx.fillStyle = "#7af0c8";
      ctx.arc(x, y, TOKEN_RADIUS * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Up-and-right chevron: the direction the boost throws you.
      ctx.strokeStyle = "#08312a";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 4);
      ctx.lineTo(x, y - 6);
      ctx.lineTo(x + 8, y + 4);
      ctx.stroke();
    }
  }
}
