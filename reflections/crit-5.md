# Crit 5 reflection

**What was the breakthrough that moved the work forward?**

The breakthrough wasn't a feature, it was noticing that a failing test was
right and my code was wrong. Reeling the rope in was making the ragdoll's
swing *slower*, not faster — the obvious fix was to loosen the test's
assertion until it passed. Instead I sat with the physics: shortening the
rope's length and letting a distance constraint yank the ragdoll inward
conserves position but bleeds kinetic energy, which is exactly backwards for
a mechanic that's supposed to feel like pumping momentum into a swing. The
real fix — decomposing velocity into radial and tangential parts and scaling
only the tangential part by the ratio of old to new radius — is the same
angular-momentum conservation a skater uses pulling their arms in. Getting
there meant trusting a red test over my first, more convenient explanation of
what "reel" should mean.

**What did this work change about who I want to be as a developer?**

I want to be someone who treats a stubborn failing test as a claim about
reality worth investigating, not an obstacle to route around. The same
instinct showed up later when a click handler started throwing: it would
have been easy to add a null check and move on, but tracing it back to a
second, concurrently running session editing the same files was the only way
to actually understand — and trust — the fix.
