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

// A plane or blimp hanging high above the skyline — another rope anchor,
// just one that lives above the buildings instead of among them.
export interface Flyer {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "plane" | "blimp";
}
