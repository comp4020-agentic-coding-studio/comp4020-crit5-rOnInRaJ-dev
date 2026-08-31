export interface Vector2 {
  x: number;
  y: number;
}

export interface Building {
  x: number;
  width: number;
  height: number;
  // Painted hint on the opening building only. It marks where to make the
  // first grab; it does not constrain where a rope can attach.
  bullseye?: Vector2;
}

export type GameStatus = "running" | "game-over";
