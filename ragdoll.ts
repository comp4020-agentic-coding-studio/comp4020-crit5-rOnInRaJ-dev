import type { Vector2 } from "./types.ts";

// Tuning knob. Realistic gravity at this scale (~34px to the metre) would be
// about 340; games want more bite than that, but the old 1400 was ~4x real
// and gave the player no time to aim a grab.
export const GRAVITY = 650;

// Verlet is only stable at a fixed timestep — velocity is implied by the gap
// between the last two positions, so a variable dt silently rescales it and
// the body explodes. Game accumulates real time and steps at this rate.
export const PHYSICS_STEP = 1 / 120;

// Passes over the constraint set per step. More passes = stiffer limbs and a
// less stretchy rope; 10 is enough to look solid without mattering for cost.
export const SOLVER_ITERATIONS = 10;

// Air drag, written per SECOND and converted to the step rate — a raw
// per-step figure looks harmless and is wrong by a factor of 120. A swing has
// to keep almost all its momentum or the game feels like wading.
const DRAG_PER_SECOND = 0.975;
const DAMPING = DRAG_PER_SECOND ** PHYSICS_STEP;

const HEAD_RADIUS = 9;

/**
 * A Verlet point mass. It stores where it is and where it was; the difference
 * is its velocity, which means any code that moves `pos` directly has changed
 * the velocity too. That is the whole trick the chain relies on.
 */
export class Particle {
  pos: Vector2;
  prev: Vector2;
  // 0 would pin the particle in place. Lower = heavier, so it gives less
  // ground when a constraint pulls on it.
  readonly invMass: number;

  constructor(x: number, y: number, invMass = 1) {
    this.pos = { x, y };
    this.prev = { x, y };
    this.invMass = invMass;
  }

  /** Velocity in px/s, derived from the last step's displacement. */
  get velocity(): Vector2 {
    return {
      x: (this.pos.x - this.prev.x) / PHYSICS_STEP,
      y: (this.pos.y - this.prev.y) / PHYSICS_STEP,
    };
  }

  setVelocity(vx: number, vy: number) {
    this.prev.x = this.pos.x - vx * PHYSICS_STEP;
    this.prev.y = this.pos.y - vy * PHYSICS_STEP;
  }

  integrate() {
    const vx = (this.pos.x - this.prev.x) * DAMPING;
    const vy = (this.pos.y - this.prev.y) * DAMPING;
    this.prev.x = this.pos.x;
    this.prev.y = this.pos.y;
    this.pos.x += vx;
    this.pos.y += vy + GRAVITY * PHYSICS_STEP * PHYSICS_STEP;
  }
}

/** A rigid distance constraint between two particles — one bone. */
export class Stick {
  readonly a: Particle;
  readonly b: Particle;
  readonly length: number;
  // Braces hold the skeleton's shape but aren't limbs, so they're solved and
  // not drawn.
  readonly hidden: boolean;

  constructor(a: Particle, b: Particle, hidden = false) {
    this.a = a;
    this.b = b;
    this.hidden = hidden;
    this.length = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
  }

  solve() {
    const dx = this.b.pos.x - this.a.pos.x;
    const dy = this.b.pos.y - this.a.pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const totalInvMass = this.a.invMass + this.b.invMass;
    if (totalInvMass === 0) return;

    // Split the error between the two ends in proportion to how light each
    // one is, so a heavy torso barely moves and a light forearm whips.
    const error = (dist - this.length) / dist;
    const aShare = this.a.invMass / totalInvMass;
    const bShare = this.b.invMass / totalInvMass;

    this.a.pos.x += dx * error * aShare;
    this.a.pos.y += dy * error * aShare;
    this.b.pos.x -= dx * error * bShare;
    this.b.pos.y -= dy * error * bShare;
  }
}

// Rest pose, relative to the pelvis. The right arm starts raised because it's
// the one the rope attaches to — the body should hang from it, not drag it.
const POSE = {
  head: { x: 0, y: -34, invMass: 0.7 },
  chest: { x: 0, y: -22, invMass: 0.45 },
  pelvis: { x: 0, y: 0, invMass: 0.45 },
  elbowR: { x: 10, y: -32, invMass: 1.2 },
  handR: { x: 16, y: -46, invMass: 0.8 },
  elbowL: { x: -12, y: -12, invMass: 1.4 },
  handL: { x: -16, y: 2, invMass: 1.4 },
  kneeL: { x: -6, y: 12, invMass: 1.3 },
  footL: { x: -8, y: 24, invMass: 1.3 },
  kneeR: { x: 6, y: 12, invMass: 1.3 },
  footR: { x: 8, y: 24, invMass: 1.3 },
} as const;

type Joint = keyof typeof POSE;

// Road friction, per second like the drag above. Aggressive on purpose: a
// body that hits the street should crumple and stop, not skid off-screen.
const GROUND_FRICTION_PER_SECOND = 0.02;
const GROUND_FRICTION = GROUND_FRICTION_PER_SECOND ** PHYSICS_STEP;

export class Ragdoll {
  private joints!: Record<Joint, Particle>;
  particles!: Particle[];
  sticks!: Stick[];

  constructor(x: number, y: number, vx = 0, vy = 0) {
    this.reset(x, y, vx, vy);
  }

  /** The hand the rope flies from, and what the chain constrains. */
  get hand(): Particle {
    return this.joints.handR;
  }

  /**
   * The body's reference point for camera, score and spawning. The pelvis,
   * not the centre of mass — a flailing average makes the camera seasick.
   */
  get pos(): Vector2 {
    return this.joints.pelvis.pos;
  }

  reset(x: number, y: number, vx = 0, vy = 0) {
    const joints = {} as Record<Joint, Particle>;
    for (const name of Object.keys(POSE) as Joint[]) {
      const { x: dx, y: dy, invMass } = POSE[name];
      joints[name] = new Particle(x + dx, y + dy, invMass);
    }
    this.joints = joints;
    this.particles = Object.values(joints);

    const { head, chest, pelvis } = joints;
    this.sticks = [
      new Stick(head, chest),
      new Stick(chest, pelvis),
      new Stick(chest, joints.elbowR),
      new Stick(joints.elbowR, joints.handR),
      new Stick(chest, joints.elbowL),
      new Stick(joints.elbowL, joints.handL),
      new Stick(pelvis, joints.kneeL),
      new Stick(joints.kneeL, joints.footL),
      new Stick(pelvis, joints.kneeR),
      new Stick(joints.kneeR, joints.footR),
      // Spine brace: without it the torso folds flat under rope tension.
      new Stick(head, pelvis, true),
    ];

    for (const particle of this.particles) particle.setVelocity(vx, vy);
  }

  /** Pelvis velocity — the body's overall speed, for camera/audio/score use. */
  get velocity(): Vector2 {
    return this.joints.pelvis.velocity;
  }

  /** Kick the whole body at once, so a boost doesn't just rip an arm off. */
  addImpulse(vx: number, vy: number) {
    for (const p of this.particles) {
      p.prev.x -= vx * PHYSICS_STEP;
      p.prev.y -= vy * PHYSICS_STEP;
    }
  }

  handWorldPos(): Vector2 {
    return { ...this.hand.pos };
  }

  integrate() {
    for (const particle of this.particles) particle.integrate();
  }

  solveSticks() {
    for (const stick of this.sticks) stick.solve();
  }

  collideGround(groundY: number) {
    for (const particle of this.particles) {
      if (particle.pos.y <= groundY) continue;
      particle.pos.y = groundY;
      // Scrape rather than bounce: kill vertical motion, bleed horizontal.
      const vx = particle.pos.x - particle.prev.x;
      particle.prev.x = particle.pos.x - vx * GROUND_FRICTION;
      particle.prev.y = particle.pos.y;
    }
  }

  lowestY(): number {
    return Math.max(...this.particles.map((p) => p.pos.y));
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
    ctx.strokeStyle = "#f4f4f4";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (const stick of this.sticks) {
      if (stick.hidden) continue;
      ctx.beginPath();
      ctx.moveTo(stick.a.pos.x - camX, stick.a.pos.y - camY);
      ctx.lineTo(stick.b.pos.x - camX, stick.b.pos.y - camY);
      ctx.stroke();
    }

    const head = this.joints.head.pos;
    ctx.beginPath();
    ctx.fillStyle = "#f4f4f4";
    ctx.arc(head.x - camX, head.y - camY, HEAD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}
