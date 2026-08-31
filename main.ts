import { startAudio } from "./audio.ts";
import { Game } from "./game.ts";
import { loadBest, saveBest } from "./score.ts";
import type { Vector2 } from "./types.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const distanceEl = document.querySelector<HTMLElement>("#distance")!;
const bestEl = document.querySelector<HTMLElement>("#best")!;
const gameOverEl = document.querySelector<HTMLElement>("#game-over")!;
const finalScoreEl = document.querySelector<HTMLElement>("#final-score")!;
const restartBtn = document.querySelector<HTMLButtonElement>("#restart")!;
const bestScoreEl = document.querySelector<HTMLElement>("#best-score")!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function formatDistance(distance: number): string {
  return `${Math.max(0, Math.round(distance))} m`;
}

let best = loadBest();
bestEl.textContent = `best ${formatDistance(best)}`;

const game = new Game(
  (distance) => {
    distanceEl.textContent = formatDistance(distance);
  },
  (distance) => {
    best = saveBest(distance);
    bestEl.textContent = `best ${formatDistance(best)}`;
    finalScoreEl.textContent = formatDistance(distance);
    bestScoreEl.textContent = `best ${formatDistance(best)}`;
    gameOverEl.hidden = false;
  },
);

function screenToWorld(clientX: number, clientY: number): Vector2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clientX - rect.left + game.camera.x,
    y: clientY - rect.top + game.camera.y,
  };
}

function restart() {
  gameOverEl.hidden = true;
  distanceEl.textContent = formatDistance(0);
  game.reset();
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// Either mouse button shoots a rope — left is what people reach for first,
// right still works because the context menu is suppressed above.
canvas.addEventListener("mousedown", (e) => {
  startAudio(); // browsers only let audio start inside a user gesture
  game.tryShoot(screenToWorld(e.clientX, e.clientY));
});

window.addEventListener("mouseup", () => {
  game.releaseShoot();
});

restartBtn.addEventListener("click", restart);

// Hold to reel the rope in. Several keys, because the one a player reaches
// for first differs and none of them collide with anything else here.
const REEL_KEYS = new Set([" ", "w", "W", "ArrowUp", "Shift"]);

window.addEventListener("keydown", (e) => {
  if (game.status === "game-over" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    restart();
    return;
  }
  if (!REEL_KEYS.has(e.key)) return;
  e.preventDefault();
  startAudio();
  game.reeling = true;
});

window.addEventListener("keyup", (e) => {
  if (REEL_KEYS.has(e.key)) game.reeling = false;
});

// A key held while the tab loses focus never sends its keyup.
window.addEventListener("blur", () => {
  game.reeling = false;
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  game.update(dt);
  game.render(ctx, canvas.width, canvas.height);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
