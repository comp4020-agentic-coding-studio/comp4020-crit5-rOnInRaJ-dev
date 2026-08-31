import { describe, expect, it } from "vitest";
import { Chain } from "./chain.ts";
import { GRAVITY, Particle, PHYSICS_STEP, Ragdoll, SOLVER_ITERATIONS } from "./ragdoll.ts";

describe("Air drag", () => {
  // Regression: drag is a per-second figure converted to the step rate. Set
  // as a raw per-step number it is wrong by a factor of 120 — 0.996/step is
  // 38% of velocity lost every second, which quietly kills every swing.
  it("costs a falling body only a few percent of a second's acceleration", () => {
    const particle = new Particle(0, 0);
    for (let i = 0; i < 1 / PHYSICS_STEP; i++) particle.integrate();

    // One second of free fall should land just under g*t. The per-step
    // mistake above lands near 520 instead.
    expect(particle.velocity.y).toBeGreaterThan(GRAVITY * 0.95);
    expect(particle.velocity.y).toBeLessThanOrEqual(GRAVITY);
  });
});

// The rule under test: the rope is a chain, not a rod. Slack applies no
// force; taut removes the outward motion and keeps the sideways motion, which
// is the only reason a swing builds instead of dying on the first grab.
describe("Chain constraint", () => {
  function tautChain(maxLength: number) {
    const chain = new Chain();
    chain.attach({ x: 0, y: 0 }, { x: maxLength, y: 0 });
    return chain;
  }

  it("applies no force while slack", () => {
    const hand = new Particle(0, 0);
    const chain = new Chain();
    chain.attach({ x: 0, y: -200 }, hand.pos);

    hand.pos = { x: 30, y: -40 }; // still well inside the 200 max length
    const before = { ...hand.pos };
    chain.constrain(hand);

    expect(hand.pos).toEqual(before);
  });

  it("clamps the hand back to max length when it would overshoot", () => {
    const chain = tautChain(100);
    const hand = new Particle(500, 300);
    chain.constrain(hand);

    expect(Math.hypot(hand.pos.x, hand.pos.y)).toBeCloseTo(100, 6);
  });

  it("removes outward velocity, because the clamp moves pos and not prev", () => {
    const chain = tautChain(100);
    const hand = new Particle(100, 0);
    hand.pos = { x: 120, y: 0 }; // a step straight outward, purely radial

    chain.constrain(hand);

    expect(hand.pos.x).toBeCloseTo(100, 6);
    expect(hand.velocity.x).toBeCloseTo(0, 6);
  });

  it("keeps tangential velocity, which is what produces the swing", () => {
    const chain = tautChain(100);
    const hand = new Particle(100, 0);
    hand.pos = { x: 100, y: 20 }; // a step sideways around the anchor

    chain.constrain(hand);

    const speed = Math.hypot(hand.pos.x - hand.prev.x, hand.pos.y - hand.prev.y);
    expect(speed).toBeGreaterThan(19); // ~98% of the 20px step survives
    expect(Math.hypot(hand.pos.x, hand.pos.y)).toBeCloseTo(100, 6);
  });

  it("never pins the hand at zero length when you grab a surface you're touching", () => {
    const chain = new Chain();
    const point = { x: 10, y: 10 };
    chain.attach(point, point);
    expect(chain.maxLength).toBeGreaterThan(0);
  });
});

describe("Rope reel", () => {
  it("scales tangential speed by r/r\', the skater-pulling-arms-in effect", () => {
    const hand = new Particle(0, 200); // hanging straight below the anchor
    hand.setVelocity(200, 0); // moving purely sideways: all tangential
    const chain = new Chain();
    chain.attach({ x: 0, y: 0 }, hand.pos);

    const before = chain.maxLength;
    chain.reel(hand, PHYSICS_STEP);

    expect(chain.maxLength).toBeLessThan(before);
    expect(hand.velocity.x).toBeCloseTo(200 * (before / chain.maxLength), 4);
  });

  it("does nothing while the rope is still slack — reeling in air is free", () => {
    const hand = new Particle(0, 50); // well inside a 400 rope
    hand.setVelocity(200, 0);
    const chain = new Chain();
    chain.attach({ x: 0, y: 0 }, { x: 0, y: 400 });

    chain.reel(hand, PHYSICS_STEP);

    expect(hand.velocity.x).toBeCloseTo(200, 6);
  });

  it("raises the peak speed of a swing when reeled at the bottom of the arc", () => {
    // Reeling only pays where the rope is taut and the body is fast, which is
    // the bottom. Peak speed over the run is the honest measure: a shorter
    // rope also has less height to fall, so comparing a fixed instant would
    // compare two different pendulums instead of the pump.
    function peakSpeed(reel: boolean): number {
      const hand = new Particle(0, 400);
      hand.setVelocity(300, 0);
      const chain = new Chain();
      chain.attach({ x: 0, y: 0 }, hand.pos);

      let peak = 0;
      for (let step = 0; step < 240; step++) {
        // Only while it's still near the bottom and moving, as a player would.
        if (reel && step < 40) chain.reel(hand, PHYSICS_STEP);
        hand.integrate();
        for (let i = 0; i < SOLVER_ITERATIONS; i++) chain.constrain(hand);
        const v = hand.velocity;
        peak = Math.max(peak, Math.hypot(v.x, v.y));
      }
      return peak;
    }

    expect(peakSpeed(true)).toBeGreaterThan(peakSpeed(false));
  });

  it("never reels down to zero, which would pin the body on the anchor", () => {
    const chain = new Chain();
    const hand = new Particle(400, 0);
    chain.attach({ x: 0, y: 0 }, hand.pos);
    for (let i = 0; i < 2000; i++) chain.reel(hand, PHYSICS_STEP);
    expect(chain.maxLength).toBeGreaterThan(0);
  });

  it("does nothing with no rope out", () => {
    const chain = new Chain();
    chain.reel(new Particle(0, 0), PHYSICS_STEP);
    expect(chain.maxLength).toBe(0);
  });
});

describe("Ragdoll under rope tension", () => {
  it("drags the whole body toward the anchor, not just the roped hand", () => {
    const ragdoll = new Ragdoll(0, 0);
    const chain = new Chain();
    // Anchor far above and left, with a short rope: the hand is way outside
    // it, so the constraint has to haul the body along.
    chain.attach({ x: -300, y: -300 }, ragdoll.handWorldPos());
    chain.maxLength = 50;

    const pelvisBefore = { ...ragdoll.pos };
    for (let i = 0; i < SOLVER_ITERATIONS; i++) {
      ragdoll.solveSticks();
      chain.constrain(ragdoll.hand);
    }

    expect(ragdoll.pos.x).toBeLessThan(pelvisBefore.x);
    expect(ragdoll.pos.y).toBeLessThan(pelvisBefore.y);
  });

  it("holds the skeleton together — bones stay near their rest length", () => {
    const ragdoll = new Ragdoll(0, 0);
    const chain = new Chain();
    chain.attach({ x: 400, y: -400 }, ragdoll.handWorldPos());
    chain.maxLength = 60;

    for (let step = 0; step < 120; step++) {
      ragdoll.integrate();
      for (let i = 0; i < SOLVER_ITERATIONS; i++) {
        ragdoll.solveSticks();
        chain.constrain(ragdoll.hand);
      }
    }

    for (const stick of ragdoll.sticks) {
      const dist = Math.hypot(stick.a.pos.x - stick.b.pos.x, stick.a.pos.y - stick.b.pos.y);
      expect(Math.abs(dist - stick.length)).toBeLessThan(stick.length * 0.25);
    }
  });

  it("settles on the ground instead of sinking through it", () => {
    const ragdoll = new Ragdoll(0, -200);
    for (let step = 0; step < 400; step++) {
      ragdoll.integrate();
      for (let i = 0; i < SOLVER_ITERATIONS; i++) ragdoll.solveSticks();
      ragdoll.collideGround(0);
    }
    expect(ragdoll.lowestY()).toBeCloseTo(0, 6);
  });
});
