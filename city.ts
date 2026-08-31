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

// Deterministic 0..1 noise. Buildings are generated randomly but drawn every
// frame, so their windows have to come from position, not Math.random().
export function hash(n: number): number {
  const v = Math.sin(n * 127.1) * 43758.5453;
  return v - Math.floor(v);
}

// Height reads as colour: squat blocks are pale slate, towers go deep violet.
// Saturation climbs with height too, so the tall ones read as "far up" even
// when only a slice of facade is on screen.
function facadeColor(height: number): string {
  const t = Math.min(1, Math.max(0, (height - MIN_HEIGHT) / (MAX_HEIGHT - MIN_HEIGHT)));
  return `hsl(${205 + t * 65}, ${16 + t * 24}%, ${50 - t * 24}%)`;
}

const WINDOW_W = 10;
const WINDOW_H = 16;
const WINDOW_GAP_X = 26;
const WINDOW_GAP_Y = 38;
const FACADE_INSET = 18;

export function drawBuilding(
  ctx: CanvasRenderingContext2D,
  building: Building,
  camX: number,
  camY: number,
  viewWidth: number,
  viewHeight: number,
) {
  const screenX = building.x - camX;
  const screenY = GROUND_Y - building.height - camY;

  ctx.fillStyle = facadeColor(building.height);
  ctx.fillRect(screenX, screenY, building.width, building.height);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(screenX, screenY, building.width, building.height);

  drawWindows(ctx, building, screenX, screenY, viewWidth, viewHeight);

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

// Window grid, clipped to the viewport — a full 1600px tower is ~1500 windows
// and only a couple of dozen rows are ever on screen.
function drawWindows(
  ctx: CanvasRenderingContext2D,
  building: Building,
  screenX: number,
  screenY: number,
  viewWidth: number,
  viewHeight: number,
) {
  const cols = Math.floor((building.width - FACADE_INSET * 2) / WINDOW_GAP_X);
  const rows = Math.floor((building.height - FACADE_INSET * 2) / WINDOW_GAP_Y);
  if (cols <= 0 || rows <= 0) return;

  const firstCol = Math.max(0, Math.floor((-screenX - FACADE_INSET) / WINDOW_GAP_X));
  const lastCol = Math.min(cols - 1, Math.ceil((viewWidth - screenX) / WINDOW_GAP_X));
  const firstRow = Math.max(0, Math.floor((-screenY - FACADE_INSET) / WINDOW_GAP_Y));
  const lastRow = Math.min(rows - 1, Math.ceil((viewHeight - screenY) / WINDOW_GAP_Y));

  const lit = new Path2D();
  const dark = new Path2D();
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const x = screenX + FACADE_INSET + col * WINDOW_GAP_X;
      const y = screenY + FACADE_INSET + row * WINDOW_GAP_Y;
      const on = hash(building.x + col * 31.7 + row * 91.3) > 0.55;
      (on ? lit : dark).rect(x, y, WINDOW_W, WINDOW_H);
    }
  }
  ctx.fillStyle = "rgba(10, 14, 20, 0.55)";
  ctx.fill(dark);
  ctx.fillStyle = "rgba(255, 214, 130, 0.75)";
  ctx.fill(lit);
}

// Backdrop: sky gradient plus two procedural skylines that scroll at a
// fraction of camera speed. The layers are the altitude gauge — near the
// ground their bases sit low on screen and slide past fast; up high they
// collapse toward the horizon and barely move.
const LAYERS = [
  { depth: 0.18, spacing: 210, minH: 300, maxH: 900, color: "#1b2330" },
  { depth: 0.42, spacing: 300, minH: 420, maxH: 1300, color: "#243044" },
];

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  width: number,
  height: number,
) {
  // Altitude tint: the sky darkens as the camera climbs above the ground.
  const altitude = Math.min(1, Math.max(0, (GROUND_Y - camY - height / 2) / 2400));
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, `hsl(220, 45%, ${16 - altitude * 10}%)`);
  sky.addColorStop(1, `hsl(212, 38%, ${34 - altitude * 16}%)`);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (const layer of LAYERS) {
    const offsetX = camX * layer.depth;
    const baseY = GROUND_Y - camY * layer.depth;
    if (baseY < 0) continue;

    ctx.fillStyle = layer.color;
    const first = Math.floor(offsetX / layer.spacing) - 1;
    const last = Math.ceil((offsetX + width) / layer.spacing);
    for (let i = first; i <= last; i++) {
      const h = layer.minH + hash(i * 7.3 + layer.depth * 1000) * (layer.maxH - layer.minH);
      const w = layer.spacing * (0.6 + hash(i * 3.1 + layer.depth * 500) * 0.35);
      ctx.fillRect(i * layer.spacing - offsetX, baseY - h, w, h);
    }
  }

}

// Ground haze, drawn over the buildings so their bases fade into it — the
// stronger it is on screen, the closer the ground is.
export function drawGroundHaze(ctx: CanvasRenderingContext2D, camY: number, width: number) {
  const groundScreenY = GROUND_Y - camY;
  const haze = ctx.createLinearGradient(0, groundScreenY - HAZE_DEPTH, 0, groundScreenY);
  haze.addColorStop(0, "rgba(150, 175, 205, 0)");
  haze.addColorStop(1, "rgba(150, 175, 205, 0.35)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, groundScreenY - HAZE_DEPTH, width, HAZE_DEPTH);
}

const HAZE_DEPTH = 320;

// Street lamps march along the ground at a fixed spacing. They're the
// close-range altitude cue the parallax layers can't give: when you can pick
// out individual lamp glows, you are about to hit the street.
const LAMP_SPACING = 420;
const LAMP_HEIGHT = 260;
const LAMP_ARM = 46;

export function drawStreetLamps(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  width: number,
  height: number,
) {
  const baseY = GROUND_Y - camY;
  if (baseY < -LAMP_HEIGHT || baseY - LAMP_HEIGHT > height) return;

  const first = Math.floor(camX / LAMP_SPACING) - 1;
  const last = Math.ceil((camX + width) / LAMP_SPACING);
  for (let i = first; i <= last; i++) {
    const x = i * LAMP_SPACING - camX;
    const headY = baseY - LAMP_HEIGHT;
    const headX = x + LAMP_ARM;

    // Light pool on the road, drawn first so the post sits inside it.
    const pool = ctx.createRadialGradient(headX, baseY, 0, headX, baseY, LAMP_HEIGHT);
    pool.addColorStop(0, "rgba(255, 206, 122, 0.32)");
    pool.addColorStop(1, "rgba(255, 206, 122, 0)");
    ctx.fillStyle = pool;
    ctx.fillRect(headX - LAMP_HEIGHT, baseY - LAMP_HEIGHT, LAMP_HEIGHT * 2, LAMP_HEIGHT);

    ctx.fillStyle = "#161c24";
    ctx.fillRect(x - 5, headY, 10, LAMP_HEIGHT); // post
    ctx.fillRect(x - 16, baseY - 10, 32, 10); // base
    ctx.fillRect(x - 5, headY, LAMP_ARM + 5, 8); // arm out to the lamp head

    // Lamp head: a shade with the bulb glowing underneath it.
    ctx.fillStyle = "#161c24";
    ctx.fillRect(headX - 14, headY + 6, 28, 10);
    ctx.beginPath();
    ctx.fillStyle = "#ffce7a";
    ctx.arc(headX, headY + 20, 9, 0, Math.PI * 2);
    ctx.fill();
  }
}
