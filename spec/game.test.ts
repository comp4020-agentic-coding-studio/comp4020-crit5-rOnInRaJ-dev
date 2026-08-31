import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Tests for the mechanically-checkable lines of the "A game" spec
// (crits/05-game). Whether a stranger reaches an ending in five minutes
// with zero instruction, and whether the game is any good, is judged live
// at the crit, not here.

function builtBundleSource(): string {
  const distAssets = resolve("dist/assets");
  expect(
    existsSync(distAssets),
    "dist/assets not found — run `pnpm build` first.",
  ).toBe(true);
  return readdirSync(distAssets)
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(resolve(distAssets, f), "utf8"))
    .join("\n");
}

function builtDoc() {
  const distPath = resolve("dist/index.html");
  return new JSDOM(readFileSync(distPath, "utf8")).window.document;
}

describe("it can be lost", () => {
  it("the built bundle exposes an end state — a win, a loss, or a finish", () => {
    const js = builtBundleSource();
    const endState = /game[\s_-]?over|\byou win\b|\byou lose\b|\bgame\s?won\b|\bgame\s?lost\b|\brestart\b|\btry again\b/i;
    expect(
      endState.test(js),
      "No win/loss/finish signal (e.g. 'game over', 'you win', 'restart') found in the built bundle — a wrong move should be possible and play should end somewhere.",
    ).toBe(true);
  });
});

describe("it teaches itself", () => {
  it("ships no on-screen instructions, tutorial, or how-to-play modal", () => {
    const doc = builtDoc();
    const bodyText = doc.body.textContent ?? "";
    const instructionLanguage = /how to play|instructions|tutorial|controls:/i;
    expect(
      instructionLanguage.test(bodyText),
      "Found instructional language in the page body — the opening screen should make the first move obvious without explaining it.",
    ).toBe(false);

    const modalLike = doc.querySelector(
      "[class*=instructions], [id*=instructions], [class*=tutorial], [id*=tutorial], [class*=how-to], [id*=how-to]",
    );
    expect(
      modalLike,
      "Found an element that looks like an instructions/tutorial modal — the no-tutorial rule means no how-to-play surface anywhere.",
    ).toBeNull();
  });
});

// Not testable here — judged at the crit or in process evidence:
// - a stranger can pick it up and reach an ending inside five minutes
// - one rule has a focused automated test of its own, once the mechanic
//   exists (write it alongside the mechanic, in this file or a new one)
// - one change came from playing the finished game rather than reading code
// - you can account for how you directed, grounded and corrected the work
