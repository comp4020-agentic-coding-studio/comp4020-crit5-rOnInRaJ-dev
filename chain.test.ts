import { describe, expect, it } from "vitest";
import { Chain } from "./chain.ts";
import { Ragdoll } from "./ragdoll.ts";

// The rule under test: "it can be lost" only works if the chain is a chain,
// not a rod — slack applies no force, and going taut removes only the
// outward (radial) velocity component, preserving the swing.
describe("Chain constraint", () => {
  it("applies no force while slack", () => {
    const ragdoll = new Ragdoll(0, 0, 5, 5);
    const chain = new Chain();
    chain.attach({ x: 0, y: -100 }, ragdoll.handWorldPos());
    const before = { ...ragdoll.pos };
    const velBefore = { ...ragdoll.vel };
    chain.constrain(ragdoll);
    expect(ragdoll.pos).toEqual(before);
    expect(ragdoll.vel).toEqual(velBefore);
  });

  it("clamps position to max length and removes only the outward velocity when taut", () => {
    const ragdoll = new Ragdoll(0, 0, 100, 0);
    const chain = new Chain();
    const handStart = ragdoll.handWorldPos();
    const anchor = { x: handStart.x - 100, y: handStart.y }; // directly left, same height
    chain.attach(anchor, handStart); // maxLength = 100

    // Move the ragdoll straight out past max length, moving purely outward
    // (anchor and hand share a y, so the radial direction here is pure +x).
    ragdoll.pos.x += 500;
    ragdoll.vel.x = 400;
    ragdoll.vel.y = 0;

    chain.constrain(ragdoll);

    const hand = ragdoll.handWorldPos();
    const dist = Math.hypot(hand.x - anchor.x, hand.y - anchor.y);
    expect(dist).toBeCloseTo(chain.maxLength, 5);

    // Outward velocity was fully radial, so it should have been zeroed out.
    expect(ragdoll.vel.x).toBeCloseTo(0, 5);
  });

  it("preserves tangential velocity so the ragdoll can swing", () => {
    const ragdoll = new Ragdoll(0, -100, 0, 0);
    const chain = new Chain();
    const anchor = { x: 0, y: 0 };
    chain.attach(anchor, ragdoll.handWorldPos());

    // Hand sits directly above the anchor; a purely horizontal (tangential)
    // velocity should survive a taut constraint untouched.
    ragdoll.vel.x = 120;
    ragdoll.vel.y = 0;
    chain.constrain(ragdoll);

    expect(ragdoll.vel.x).toBeCloseTo(120, 5);
  });
});
