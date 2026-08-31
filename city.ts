import type { Building, Vector2 } from "./types.ts";

export const GROUND_Y = 600;

// World scale: the ragdoll stands ~62px tall, so ~34px is roughly a metre.
// Buildings are sized in that scale — 5 to 15 storeys — which is why they
// dwarf the player instead of being hoppable blocks.
const MIN_WIDTH = 260;
const MAX_WIDTH = 620;
const MIN_HEIGHT = 520;
const MAX_HEIGHT = 1600;
const MIN_GAP = 260;
const MAX_GAP = 620;

// The scripted opening. The first building is hand-placed and carries the
// bullseye, which is the only thing on screen telling the player what to do.
const FIRST_BUILDING = { x: 400, width: 460, height: 1200 };
const BULLSEYE_INSET = { x: 100, y: 120 };

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomBuilding(x: number): Building {
  return {
    x,
    width: randomBetween(MIN_WIDTH, MAX_WIDTH),
    height: randomBetween(MIN_HEIGHT, MAX_HEIGHT),
  };
}

// A rope can attach to any point on any building face — this hit test is the
// whole attachment rule.
export function containsPoint(building: Building, point: Vector2): boolean {
  const top = GROUND_Y - building.height;
  return (
    point.x >= building.x &&
    point.x <= building.x + building.width &&
    point.y >= top &&
    point.y <= GROUND_Y
  );
}

export function initialCity(): Building[] {
  const first: Building = {
    ...FIRST_BUILDING,
    bullseye: {
      x: FIRST_BUILDING.x + BULLSEYE_INSET.x,
      y: GROUND_Y - FIRST_BUILDING.height + BULLSEYE_INSET.y,
    },
  };

  const buildings: Building[] = [first];
  let x = first.x + first.width + randomBetween(MIN_GAP, MAX_GAP);
  for (let i = 0; i < 8; i++) {
    const building = randomBuilding(x);
    buildings.push(building);
    x = building.x + building.width + randomBetween(MIN_GAP, MAX_GAP);
  }
  return buildings;
}

// Phase 2: the endless generator, called once the player gets close enough to
// the current rightmost edge that another building should exist.
export function generateNextBuilding(rightEdge: number): Building {
  return randomBuilding(rightEdge + randomBetween(MIN_GAP, MAX_GAP));
}

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  building: Building,
  camX: number,
  camY: number,
) {
  const screenX = building.x - camX;
  const screenY = GROUND_Y - building.height - camY;

  ctx.fillStyle = "#3a4a5c";
  ctx.fillRect(screenX, screenY, building.width, building.height);
  ctx.strokeStyle = "#2b3846";
  ctx.lineWidth = 2;
  ctx.strokeRect(screenX, screenY, building.width, building.height);

  if (building.bullseye) {
    const bx = building.bullseye.x - camX;
    const by = building.bullseye.y - camY;
    ctx.beginPath();
    ctx.fillStyle = "#ffcc33";
    ctx.arc(bx, by, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = "#c8451a";
    ctx.lineWidth = 4;
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.stroke();
  }
}
