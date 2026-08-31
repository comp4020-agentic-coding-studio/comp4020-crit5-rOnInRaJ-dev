import { describe, expect, it } from "vitest";
import { TOKEN_RADIUS, Tokens, tokenAt } from "./tokens.ts";

// Tokens have no spawn list — position comes from the index and the only
// state is what's been eaten. Both halves of that are worth pinning down.
describe("Boost tokens", () => {
  it("puts a given token in the same place every time", () => {
    expect(tokenAt(7)).toEqual(tokenAt(7));
    expect(tokenAt(7)).not.toEqual(tokenAt(8));
  });

  it("collects a token the body flies through", () => {
    const tokens = new Tokens();
    expect(tokens.collect(tokenAt(3), 10)).toBe(1);
  });

  it("collects each token only once", () => {
    const tokens = new Tokens();
    tokens.collect(tokenAt(3), 10);
    expect(tokens.collect(tokenAt(3), 10)).toBe(0);
  });

  it("ignores a token the body misses", () => {
    const tokens = new Tokens();
    const far = tokenAt(3);
    expect(tokens.collect({ x: far.x, y: far.y - TOKEN_RADIUS * 10 }, 10)).toBe(0);
  });

  it("stops drawing a token once it's been eaten", () => {
    const tokens = new Tokens();
    const t = tokenAt(3);
    expect(tokens.live(t.x - 1, t.x + 1)).toContain(3);
    tokens.collect(t, 10);
    expect(tokens.live(t.x - 1, t.x + 1)).not.toContain(3);
  });

  it("resets collected tokens for a new run", () => {
    const tokens = new Tokens();
    tokens.collect(tokenAt(3), 10);
    tokens.reset();
    expect(tokens.collect(tokenAt(3), 10)).toBe(1);
  });
});
