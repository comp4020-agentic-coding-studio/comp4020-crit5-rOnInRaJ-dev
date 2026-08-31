import { Camera } from "./camera.ts";
import { Chain } from "./chain.ts";
import {
  containsPoint,
  drawBuilding,
  generateNextBuilding,
  GROUND_Y,
  initialCity,
} from "./city.ts";
import { FOOT_OFFSET, Ragdoll } from "./ragdoll.ts";
import { ScoreTracker } from "./score.ts";
import type { Building, GameStatus, Vector2 } from "./types.ts";

// Spawn high and left of the first building, so the bullseye is inside REACH
// for the whole opening fall — the player gets the full descent to work out
// that the marked circle is the thing to right-click.
const START = { x: 0, y: -1400, vx: 140, vy: 0 };
const REACH = 1200; // how far a rope can be shot from the ragdoll's hands
// Must exceed the world width visible behind the ragdoll (camera bias x
// viewport width) or buildings get culled while still on screen.
const CULL_MARGIN = 2000;
const SPAWN_MARGIN = REACH * 2; // keep the city generated this far ahead

export class Game {
  status: GameStatus = "running";
  ragdoll = new Ragdoll(START.x, START.y, START.vx, START.vy);
  chain = new Chain();
  camera = new Camera();
  score = new ScoreTracker();
  buildings: Building[] = initialCity();
  private rightmostX: number;

  constructor(
    private readonly onScore: (distance: number) => void,
    private readonly onGameOver: (distance: number) => void,
  ) {
    this.score.reset(this.ragdoll.pos.x);
    this.rightmostX = rightEdge(this.buildings);
  }

  reset() {
    this.status = "running";
    this.ragdoll.reset(START.x, START.y, START.vx, START.vy);
    this.chain.detach();
    this.buildings = initialCity();
    this.rightmostX = rightEdge(this.buildings);
    this.score.reset(this.ragdoll.pos.x);
  }

  // Right-click down: fire a rope at whatever building surface is under the
  // cursor. Any point on any facade works — the only limits are that the
  // click has to land on a building and be within reach of the hands.
  tryShoot(pointerWorld: Vector2) {
    if (this.status !== "running") return;
    const hand = this.ragdoll.handWorldPos();
    if (Math.hypot(pointerWorld.x - hand.x, pointerWorld.y - hand.y) > REACH) return;
    const hit = this.buildings.find((building) => containsPoint(building, pointerWorld));
    if (!hit) return;
    this.chain.attach({ ...pointerWorld }, hand);
  }

  releaseShoot() {
    this.chain.detach();
  }

  update(dt: number) {
    if (this.status !== "running") return;

    this.ragdoll.integrate(dt);
    this.chain.constrain(this.ragdoll);

    if (this.ragdoll.pos.y + FOOT_OFFSET >= GROUND_Y) {
      this.status = "game-over";
      this.chain.detach();
      this.onGameOver(this.score.distance);
      return;
    }

    this.score.update(this.ragdoll.pos.x);
    this.onScore(this.score.distance);

    while (this.rightmostX < this.ragdoll.pos.x + SPAWN_MARGIN) {
      const next = generateNextBuilding(this.rightmostX);
      this.buildings.push(next);
      this.rightmostX = next.x + next.width;
    }
    this.buildings = this.buildings.filter((b) => b.x + b.width > this.ragdoll.pos.x - CULL_MARGIN);
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.camera.follow(this.ragdoll.pos, width, height);
    const { x: camX, y: camY } = this.camera;

    ctx.clearRect(0, 0, width, height);

    const groundScreenY = GROUND_Y - camY;
    ctx.fillStyle = "#232b33";
    ctx.fillRect(0, groundScreenY, width, Math.max(0, height - groundScreenY));
    ctx.strokeStyle = "#0d1117";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundScreenY);
    ctx.lineTo(width, groundScreenY);
    ctx.stroke();

    for (const b of this.buildings) drawBuilding(ctx, b, camX, camY);

    if (this.chain.anchor) {
      const hand = this.ragdoll.handWorldPos();
      ctx.strokeStyle = "#d8d8d8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hand.x - camX, hand.y - camY);
      ctx.lineTo(this.chain.anchor.x - camX, this.chain.anchor.y - camY);
      ctx.stroke();
    }

    this.ragdoll.draw(ctx, this.ragdoll.pos.x - camX, this.ragdoll.pos.y - camY);
  }
}

function rightEdge(buildings: Building[]): number {
  return Math.max(...buildings.map((b) => b.x + b.width));
}
