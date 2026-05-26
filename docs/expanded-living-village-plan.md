# Expanded Living Village Presentation Plan

## Purpose

This plan increases the feeling of exploring and defending a living village.
The current generated board is readable but compact, and the fixed presentation
can expose flat blue outside scenery rather than maintaining an immersive
storybook world.

The intended outcome is a larger generated seasonal map viewed through a
smooth, closer world camera, with layered parallax and subtle season-specific
atmosphere. Gameplay balance remains stable in the initial presentation pass.

## Current Findings

- The generated seasonal board is currently based on a `19 x 19` matrix with
  playable bounds `2..16`.
- Seasonal map creation in `src/levels/buildSeasonBoard.ts` uses fixed layout
  templates for the castle, cottage, optional buildings, player spawn, lanes,
  and perimeter enemy spawns.
- Scene variants already define background, exterior-frame, foreground-fog,
  `worldZoom`, and parallax tuning in `src/sceneVariants.ts`.
- Current parallax in `src/sceneVariantRenderer.ts` shifts scenic sprites by a
  small amount based on hero position; it is not camera-scroll-driven.
- Time-of-day rendering already supports ambient tint, mist, and lamp glows,
  but does not provide seasonal moving particles such as petals, rain, leaves,
  or snow.
- Gameplay currently renders at a fixed `1280 x 720` view with no scrolling
  world-camera follow behavior.

## Target Presentation

### Expanded Generated Board

- Expand seasonal generated maps from `19 x 19` to `25 x 25`.
- Change playable bounds from `2..16` to `3..21`, maintaining a scenic forest
  buffer around gameplay cells.
- Reposition seasonal layout templates across the larger space:
  - Keep the castle near the defended center.
  - Spread the required cottage and optional seasonal building farther apart.
  - Keep the player spawn within the central defense network.
  - Place four enemy entry points on separate playable perimeter sides.
- Extend authored lanes and decoration opportunities to fill the new space
  without introducing blocked routes or player-clearance pockets.
- Retain existing waves, enemy statistics, repair values, building health, and
  card balance during this initial visual/world-size pass.

### Closer Camera With Soft Follow

- Introduce a dedicated scrolling world camera for terrain, scenic layers,
  buildings, enemies, projectiles, class effects, and player-occluding
  foreground scenery.
- Set initial world zoom to `1.12`.
- Smoothly follow the hero with damped movement and clamp scroll to board-based
  scenic bounds, so the view feels calm rather than snapping on movement or
  knockback.
- Keep HUD, touch controls, debug panels, and modal overlays on a fixed UI
  camera so their coordinates, readability, and hit regions are unchanged.
- Convert pointer/tap targeting through world-camera coordinates before
  screen-to-isometric conversion; preserve the existing screen-relative
  joystick and keyboard movement behavior.

### Scenic Coverage And Blue-Gap Prevention

- Provide each season with a fallback world background tint used behind scenic
  layers instead of relying on the current visible flat blue.
- Increase scenic surround/background/frame/foreground coverage with enough
  overscan for all valid camera positions at `1.12` zoom.
- Clamp the world camera so it cannot reveal beyond scenic coverage.
- Validate camera coverage at all four scroll extremes and after resize; no
  exposed blue strip may be visible in normal generated gameplay.
- Leave legacy painted/static-map comparison mode unchanged.

## Parallax And Atmospheric Effects

### Camera-Driven Parallax

- Replace hero-normalized image shifting with offsets derived from bounded world
  camera scroll.
- Use separate parallax strengths:
  - Far seasonal background: subtle movement.
  - Exterior frame and distant tree perimeter: moderate movement.
  - Foreground fog and foliage overlays: strongest movement.
- Keep parallax purely visual and ensure the foreground player-occlusion system
  continues to evaluate runtime covering props independently.

### Seasonal Ambient Presets

Add one subtle visual-only effect preset per seasonal world:

| World Presentation | Ambient Effect |
| --- | --- |
| Spring | Sparse drifting pink petals and soft low mist |
| Summer | Light diagonal wind/rain streaks with warm haze |
| Twilight Autumn | Falling amber leaves and slightly denser rolling mist |
| Winter | Slow snow particles and cool ground haze |

Rules:

- Render atmospheric particles below player-facing UI and above/between scenic
  layers as appropriate for legibility.
- Use lightweight generated particle textures or existing suitable effect
  frames; do not require large new full-scene paintings for the first pass.
- Cap particle count, scale, alpha, and motion speed so enemies, projectile
  telegraphs, buildings, and touch controls remain easy to read.
- Pause or sharply reduce emission while splash, level-up, and game-over
  overlays are shown.
- Destroy and recreate emitters cleanly when the seasonal scene restarts or
  transitions.

## Implementation Approach

### Generation And Validation

- Update generated-board dimensions, playable bounds, and seasonal template
  coordinates in the level/scene-variant configuration ownership area.
- Keep existing procedural validation active for routes, building clearance,
  player-walkable connectivity, spawn access, and pocket detection.
- Extend deterministic validation fixtures so the enlarged authored templates
  and all seasonal optional-building combinations remain playable.

### Camera And Coordinate Flow

- Create world and UI camera responsibilities during scene setup:
  - World camera includes world/scenery/gameplay layers.
  - UI camera ignores world layers and includes HUD/touch/overlays/debug UI.
- Set world camera bounds from generated world extents plus configured scenic
  overscan and begin smooth follow only when gameplay begins.
- Keep overlay and touch positions tied to logical screen coordinates.
- Update pointer targeting to transform through the world camera before calling
  existing isometric conversion utilities.

### Variant Configuration And Rendering

- Extend scene variant presentation data with:
  - World camera zoom.
  - Scenic fallback color.
  - Scenic overscan/camera padding.
  - Per-layer parallax factors.
  - Ambient preset and intensity.
- Update seasonal scene rendering to size and position background/frame/
  foreground elements for camera travel rather than a single fixed viewport.
- Add an ambient-effect lifecycle controller that starts, pauses, swaps, and
  clears the current seasonal preset.

### Diagnostics

- Extend development/debug output with current camera zoom, camera scroll,
  computed bounds, active seasonal ambient preset, live particle count, and a
  scenic-coverage status.
- Add an optional visual camera-bounds/coverage overlay for diagnosing any
  reported outside-background gap without affecting normal play.

## Test Plan

### Automated Coverage

- Generated seasonal maps report `25 x 25` dimensions and playable bounds
  `3..21`.
- Each seasonal layout template retains valid protected-building footprints,
  player-spawn clearance, perimeter enemy spawns, routes, and no player pocket
  failures.
- Camera-bound computation constrains every viewport edge inside configured
  scenic coverage at `1.12` zoom.
- Pointer/tap targeting resolves the same intended isometric point after camera
  scroll and zoom transforms.
- UI camera isolation leaves HUD, touch controls, overlays, and debug panels
  fixed while the world camera moves.
- Parallax layer offsets are derived from camera scroll and stay within their
  configured movement limits.
- Seasonal ambient presets select correctly, enforce particle caps, suppress
  emission behind modal overlays, and clear correctly on restart/transition.

### Manual Verification

- Play each seasonal world while walking to all accessible edges and corners:
  confirm smooth follow, no camera jitter, usable defense context, and no blue
  outside-map exposure.
- Verify touch targeting and desktop targeting while the camera is displaced
  from its initial center.
- Confirm HUD and modal/card interfaces remain stationary and clickable.
- Verify petals, rain/wind, autumn leaves, and snow/mist remain subtle enough
  that projectiles, enemies, shield effects, repair targets, and building
  health remain readable.
- Verify foreground scenery still fades when it visually covers the hero.

### Validation Commands

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.

## Acceptance Criteria

- Generated seasonal maps provide meaningfully more traversal and village
  spacing without changing first-pass combat balance.
- The camera presents a closer, smoothly followed defense view while fixed UI
  remains stable.
- The player never sees uncovered blue outside the seasonal scenic world during
  normal camera movement or resizing.
- Parallax and ambient effects strengthen season identity without reducing
  gameplay readability or causing noticeable performance regressions.

## Assumptions

- This document defines a future implementation only; it does not require asset
  or gameplay changes as part of the documentation task.
- Expanded map and camera behavior apply to generated seasonal gameplay only.
- Legacy static/painted board mode remains available as a comparison path and
  is not expanded.
- Environmental effects are cosmetic and do not affect collision, movement,
  visibility, projectile behavior, repair, or enemy AI.
