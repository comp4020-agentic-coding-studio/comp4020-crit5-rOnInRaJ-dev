import { Camera } from "./camera.ts";
import { Chain } from "./chain.ts";
import {
  containsFlyerPoint,
  containsPoint,
  drawBackdrop,
  drawGroundHaze,
  drawStreetLamps,
  drawBuilding,
  drawFlyer,
  generateNextBuilding,
  generateNextFlyer,
  GROUND_Y,
  initialCity,
  initialFlyers,
} from "./city.ts";
import { boostChime, ropeShot, setSpeed, stopWind } from "./audio.ts";
import { PHYSICS_STEP, Ragdoll, SOLVER_ITERATIONS } from "./ragdoll.ts";
import { ScoreTracker } from "./score.ts";
import { BOOST_VX, BOOST_VY, Tokens } from "./tokens.ts";
import type { Building, Flyer, GameStatus, Vector2 } from "./types.ts";

// Spawn high and left of the first building, so the bullseye is inside REACH
// for the whole opening fall — the player gets the full descent to work out
// that the marked circle is the thing to right-click.
const START = { x: 0, y: -1400, vx: 140, vy: 0 };
const REACH = 1200; // how far a rope can be shot from the ragdoll's hands
// Must exceed the world width visible behind the ragdoll (camera bias x
// viewport width) or buildings get culled while still on screen.
const CULL_MARGIN = 2000;
const SPAWN_MARGIN = REACH * 2; // keep the city generated this far ahead
// main.ts already clamps a frame to 1/30s, so 4 steps covers it with headroom.
const MAX_STEPS_PER_FRAME = 8;
// How close the pelvis has to get to a token's centre to eat it. Generous —
// missing a pickup you clearly flew through is worse than a cheap one.
const PICKUP_RADIUS = 34;

export class Game {
  status: GameStatus = "running";
  ragdoll = new Ragdoll(START.x, START.y, START.vx, START.vy);
  chain = new Chain();
  camera = new Camera();
  score = new ScoreTracker();
  tokens = new Tokens();
  buildings: Building[] = initialCity();
  flyers: Flyer[] = initialFlyers();
  // Held by the player: shorten the rope, pumping energy into the swing.
  reeling = false;
  private rightmostX: number;
  private rightmostFlyerX: number;
  private accumulator = 0;
  private elapsed = 0;

  constructor(
    private readonly onScore: (distance: number) => void,
    private readonly onGameOver: (distance: number) => void,
  ) {
    this.score.reset(this.ragdoll.pos.x);
    this.rightmostX = rightEdge(this.buildings);
    this.rightmostFlyerX = rightEdge(this.flyers);
  }

  reset() {
    this.status = "running";
    this.ragdoll.reset(START.x, START.y, START.vx, START.vy);
    this.chain.detach();
    this.buildings = initialCity();
    this.flyers = initialFlyers();
    this.rightmostX = rightEdge(this.buildings);
    this.rightmostFlyerX = rightEdge(this.flyers);
    this.score.reset(this.ragdoll.pos.x);
    this.tokens.reset();
    this.reeling = false;
    this.accumulator = 0;
    this.elapsed = 0;
  }

  // Mouse down: fire a rope at whatever building or flyer surface is under
  // the cursor. Any point on any facade works — the only limits are that the
  // click has to land on something and be within reach of the hands.
  tryShoot(pointerWorld: Vector2) {
    if (this.status !== "running") return;
    const hand = this.ragdoll.handWorldPos();
    if (Math.hypot(pointerWorld.x - hand.x, pointerWorld.y - hand.y) > REACH) return;
    const hit =
      this.buildings.some((building) => containsPoint(building, pointerWorld)) ||
      this.flyers.some((flyer) => containsFlyerPoint(flyer, pointerWorld));
    if (!hit) return;
    this.chain.attach({ ...pointerWorld }, hand);
    ropeShot();
  }

  releaseShoot() {
    this.chain.detach();
  }

  // Real frame time in, fixed physics steps out. Verlet needs a constant dt,
  // and a frame drop must slow the sim rather than destabilise it.
  update(dt: number) {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= PHYSICS_STEP && steps < MAX_STEPS_PER_FRAME) {
      this.step();
      this.accumulator -= PHYSICS_STEP;
      steps++;
    }
    // After a long stall, drop the backlog instead of chasing it forever.
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.elapsed += dt;
    const v = this.ragdoll.velocity;
    if (this.status === "running") setSpeed(Math.hypot(v.x, v.y));
    else stopWind();
  }

  private step() {
    if (this.reeling) this.chain.reel(this.ragdoll.hand, PHYSICS_STEP);
    this.ragdoll.integrate();

    // Bones and rope are solved together, over and over: the rope is just one
    // more constraint, so tension propagates hand -> arm -> torso -> legs.
    for (let i = 0; i < SOLVER_ITERATIONS; i++) {
      this.ragdoll.solveSticks();
      this.chain.constrain(this.ragdoll.hand);
    }

    this.ragdoll.collideGround(GROUND_Y);

    // Past game over the body keeps simulating so it visibly crumples on the
    // road, but nothing else in the world advances.
    if (this.status !== "running") return;

    if (this.ragdoll.lowestY() >= GROUND_Y) {
      this.status = "game-over";
      this.chain.detach();
      this.onGameOver(this.score.distance);
      return;
    }

    if (this.tokens.collect(this.ragdoll.pos, PICKUP_RADIUS) > 0) {
      this.ragdoll.addImpulse(BOOST_VX, BOOST_VY);
      boostChime();
    }

    this.score.update(this.ragdoll.pos.x);
    this.onScore(this.score.distance);

    while (this.rightmostX < this.ragdoll.pos.x + SPAWN_MARGIN) {
      const next = generateNextBuilding(this.rightmostX);
      this.buildings.push(next);
      this.rightmostX = next.x + next.width;
    }
    this.buildings = this.buildings.filter((b) => b.x + b.width > this.ragdoll.pos.x - CULL_MARGIN);

    while (this.rightmostFlyerX < this.ragdoll.pos.x + SPAWN_MARGIN) {
      const next = generateNextFlyer(this.rightmostFlyerX);
      this.flyers.push(next);
      this.rightmostFlyerX = next.x + next.width;
    }
    this.flyers = this.flyers.filter((f) => f.x + f.width > this.ragdoll.pos.x - CULL_MARGIN);
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const zoom = this.camera.zoom;
    const viewWidth = width / zoom;
    const viewHeight = height / zoom;
    this.camera.follow(this.ragdoll.pos, viewWidth, viewHeight);
    const { x: camX, y: camY } = this.camera;

    ctx.save();
    ctx.scale(zoom, zoom);

    drawBackdrop(ctx, camX, camY, viewWidth, viewHeight);

    const groundScreenY = GROUND_Y - camY;
    ctx.fillStyle = "#232b33";
    ctx.fillRect(0, groundScreenY, viewWidth, Math.max(0, viewHeight - groundScreenY));
    ctx.strokeStyle = "#0d1117";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundScreenY);
    ctx.lineTo(viewWidth, groundScreenY);
    ctx.stroke();

    for (const f of this.flyers) drawFlyer(ctx, f, camX, camY);
    for (const b of this.buildings) drawBuilding(ctx, b, camX, camY, viewWidth, viewHeight);
    drawStreetLamps(ctx, camX, camY, viewWidth, viewHeight);
    drawGroundHaze(ctx, camY, viewWidth);
    this.tokens.draw(ctx, camX, camY, viewWidth, this.elapsed);

    if (this.chain.anchor) {
      const hand = this.ragdoll.handWorldPos();
      ctx.strokeStyle = "#d8d8d8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hand.x - camX, hand.y - camY);
      ctx.lineTo(this.chain.anchor.x - camX, this.chain.anchor.y - camY);
      ctx.stroke();
    }

    this.ragdoll.draw(ctx, camX, camY);
    ctx.restore();
  }
}

function rightEdge(items: { x: number; width: number }[]): number {
  return Math.max(...items.map((b) => b.x + b.width));
}
