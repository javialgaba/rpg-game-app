# Game Collision And Debug Remediation Plan

## Purpose

This plan addresses three problems identified during playtesting:

- Arrow projectiles are visually horizontal rather than facing their fired direction.
- Debug mode does not clearly show all environmental objects and their collision
  footprints.
- The player can appear or move into a position where surrounding buildings or
  scenery leave no usable escape direction.

Reference screenshots:

- `arrows-direction-issue.png`: arrow sprite orientation does not match its target.
- `player-trapped-issue.png`: debug view does not adequately identify nearby
  environment geometry while diagnosing a trapped player position.

## Current Findings

- Projectile movement is tracked in isometric world space, but rendered projectiles
  are positioned without applying directional rotation.
- An arrow atlas frame already exists and can be used as the directional projectile
  artwork if it remains readable at runtime size.
- The `G` debug renderer draws blocked cells and decoration markers, but does not make
  every object/decorative footprint readable as a named geometry source.
- Level generation already provides a `playerWalkableGrid` representing player
  clearance, while runtime movement also performs continuous footprint walkability
  checks and axis sliding.

## Projectile Facing Fix

### Behavior

- Player-fired arrows must point in the direction of flight from spawn until impact
  or expiry.
- If a directional projectile later changes velocity, including reflection behavior,
  it must immediately face its new direction.
- Circular or symmetrical projectiles do not require visual rotation unless their art
  is replaced with an asymmetric sprite.

### Implementation Approach

- Use the existing arrow effect frame instead of the current horizontal placeholder
  presentation where suitable.
- Add a shared directional-projectile presentation helper in the combat/projectile
  rendering path.
- Compute heading in screen space after isometric projection:
  project the projectile position, project a second point one velocity step ahead,
  then set rotation from the angle between the two screen points.
- Apply a single calibrated texture-axis offset if the source arrow art's neutral
  orientation is not right-facing.
- Apply rotation on spawn and after any velocity mutation; avoid unnecessary per-frame
  recalculation for projectiles whose direction never changes.

### Verification

- Fire arrows toward targets in all cardinal and diagonal isometric directions.
- Confirm the arrow tip leads its flight path in slow-motion or debug captures.
- Confirm any reflected directional projectile rotates to its reflected path.

## Debug Obstacle Visibility

### Behavior

When debug mode is enabled with `G`, the rendered overlay must explain the collision
world independently of the decorative artwork:

- Buildings and their full occupied footprints are visible.
- Solid props such as trees, rocks, fences, or wells are visible.
- Blocking decorations are distinct from non-blocking decorations.
- Environmental features such as ponds remain identifiable even if intentionally
  walkable.
- Player-clearance cells are visible so a trapped-player report can be diagnosed from
  one screenshot.

### Implementation Approach

- Extend `src/levelDebugRenderer.ts` to render full object and decoration footprint
  overlays, not only anchors or generic blocked-cell shading.
- Assign debug colors and short labels by category: building, solid prop, blocking
  decoration, non-blocking environment, protected/attack area, and route.
- Draw player-clearance information derived from `playerWalkableGrid` using a
  separate outline or low-opacity layer, keeping route and attack-area overlays
  readable.
- Add a compact debug legend so the meaning of trees, rocks, ponds, building
  footprint, raw blocking, and player clearance is unambiguous.
- Keep these diagnostics inside debug mode only; do not change normal game visuals.

### Verification

- Enable `G` on seeds containing each scenery category and confirm it is annotated.
- Confirm multi-cell buildings and solid objects show every occupied cell.
- Confirm ponds/non-blocking decorations remain visible without being reported as
  solid unless their authored collision requires it.

## Player Escape Safety

### Required Invariant

The hero must not finish movement, restoration, knockback, teleport/debug placement,
or level setup in an invalid standing position or an inescapable collision pocket. A
valid player position has footprint clearance and at least one legal movement path
back into the reachable play area, except during intentional game-over locking.

### Runtime Movement Changes

- Retain current continuous movement and axis-separated sliding for natural movement
  around obstacle edges.
- Treat `playerWalkableGrid` as the authoritative clearance topology for safe-cell
  and reachability checks, while retaining continuous footprint tests for final
  movement precision.
- Store the player's last valid safe position after successful movement.
- Before accepting a candidate movement position, reject any destination that is not
  footprint-walkable or that maps into an isolated player-clearance pocket.
- If an external repositioning path leaves the player invalid or trapped, move the
  player to the last valid safe position; if unavailable, search for the nearest
  reachable safe cell and place the player there.

### Generated-Level Validation

- Extend procedural validation to detect player-clearance components or cul-de-sac
  pockets introduced by combinations of buildings and blocking scenery.
- Require the player spawn and all gameplay-reachable standing areas around defended
  buildings to connect to usable escape movement.
- Reject a generated placement or regenerate/prune the blocking decoration when it
  creates an inescapable accessible pocket.
- In debug mode, highlight any failed clearance or pocket-validation cells so
  problematic seeds can be reproduced and repaired.

### Failure Cases To Cover

- Sliding diagonally along a building corner into a narrow obstruction.
- Moving between a tree/rock cluster and a building boundary.
- Restoring a saved run at a position made invalid by generated geometry.
- Debug teleport or future knockback/effect displacement into blocked scenery.
- Visual overlap from a non-blocking decoration that is safe to traverse but appears
  obstructive.

## Implementation Boundaries

- Keep the existing custom isometric/grid collision approach; this work does not
  require a physics-engine replacement.
- Keep the owning code locations focused: projectile display logic belongs with
  combat/projectiles, debug visualization with the level debug renderer, and
  clearance/generation validation with level and movement helpers.
- Expose reusable helpers for projectile rotation and player-safe-position resolution
  rather than duplicating fixes in individual class or debug paths.

## Validation Checklist

- Add automated coverage for screen-space arrow rotation across representative
  directions and direction changes.
- Add debug-renderer checks or deterministic visual verification for buildings, trees,
  rocks, ponds, decorations, and player-clearance cells.
- Add movement tests for obstacle corners, narrow paths, trapped-state rejection, and
  safe recovery after forced invalid placement.
- Add deterministic procedural seed tests that fail when an accessible player area
  contains an inescapable collision pocket.
- Manually reproduce the screenshot scenarios in `G` mode and verify arrows, visible
  footprints, and player escape behavior.
- Run `npm run typecheck`, `npm run lint`, and `npm test` after implementation.
