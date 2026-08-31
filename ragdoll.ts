import type { Vector2 } from "./types.ts";

// Tuning knob. Realistic gravity at this scale (~34px to the metre) would be
// about 340; games want more bite than that, but the old 1400 was ~4x real
// and gave the player no time to aim a grab.
export const GRAVITY = 650;
export const RAGDOLL_RADIUS = 10;
const BODY_LEN = 26;
const LIMB_LEN = 16;

// Head-center to feet, in world units — used for the ground collision check.
export const FOOT_OFFSET = RAGDOLL_RADIUS + BODY_LEN + LIMB_LEN;

export class Ragdoll {
  pos: Vector2;
  vel: Vector2;

  constructor(x: number, y: number, vx = 0, vy = 0) {
    this.pos = { x, y };
    this.vel = { x: vx, y: vy };
  }

  reset(x: number, y: number, vx = 0, vy = 0) {
    this.pos = { x, y };
    this.vel = { x: vx, y: vy };
  }

  integrate(dt: number) {
    this.vel.y += GRAVITY * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }

  // Where the chain attaches visually — a fixed offset below the head, so
  // translating the ragdoll translates the hand by the same amount.
  handWorldPos(): Vector2 {
    return { x: this.pos.x, y: this.pos.y + RAGDOLL_RADIUS + 4 };
  }

  draw(ctx: CanvasRenderingContext2D, screenX: number, screenY: number) {
    const swingDir = Math.sign(this.vel.x) || 1;
    const neckY = screenY + RAGDOLL_RADIUS;
    const hipY = neckY + BODY_LEN;

    ctx.strokeStyle = "#f2f2f2";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(screenX, neckY);
    ctx.lineTo(screenX, hipY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenX, neckY + 4);
    ctx.lineTo(screenX + swingDir * LIMB_LEN, neckY + 4 + LIMB_LEN * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(screenX, neckY + 4);
    ctx.lineTo(screenX - swingDir * LIMB_LEN * 0.6, neckY + 4 + LIMB_LEN * 0.6);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(screenX, hipY);
    ctx.lineTo(screenX + LIMB_LEN * 0.5, hipY + LIMB_LEN);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(screenX, hipY);
    ctx.lineTo(screenX - LIMB_LEN * 0.5, hipY + LIMB_LEN);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "#f2f2f2";
    ctx.arc(screenX, screenY, RAGDOLL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}
