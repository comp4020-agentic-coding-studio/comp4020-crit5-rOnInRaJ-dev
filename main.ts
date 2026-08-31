import { Game } from "./game.ts";
import type { Vector2 } from "./types.ts";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const hud = document.querySelector<HTMLElement>("#hud")!;
const gameOverEl = document.querySelector<HTMLElement>("#game-over")!;
const finalScoreEl = document.querySelector<HTMLElement>("#final-score")!;
const restartBtn = document.querySelector<HTMLButtonElement>("#restart")!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function formatDistance(distance: number): string {
  return `${Math.max(0, Math.round(distance))} m`;
}

const game = new Game(
  (distance) => {
    hud.textContent = formatDistance(distance);
  },
  (distance) => {
    finalScoreEl.textContent = formatDistance(distance);
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
  hud.textContent = formatDistance(0);
  game.reset();
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 2) return;
  game.tryShoot(screenToWorld(e.clientX, e.clientY));
});

window.addEventListener("mouseup", (e) => {
  if (e.button !== 2) return;
  game.releaseShoot();
});

restartBtn.addEventListener("click", restart);

window.addEventListener("keydown", (e) => {
  if (game.status === "game-over" && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    restart();
  }
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
