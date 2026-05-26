# Procedural Village Border And Generation Plan

## Status

This document records the procedural border and gate work already explored for
generated villages. Its procedural runtime layout direction is superseded by
[`csv-authored-village-maps-plan.md`](csv-authored-village-maps-plan.md).

The forest-border, readable-gate, seasonal presentation, camera-coverage and
player-visibility requirements in this document remain constraints for the
authored CSV map renderer and validation pipeline.

## Purpose

This plan addresses two related presentation regressions exposed after adding
the zoomed, parallax-enabled generated-world camera. When the view approaches
an edge, portions of the out-of-bounds region can appear as plain tinted
scenery instead of a clearly blocked enchanted-forest border. The first
gate pass also makes enemies appear to arrive from a tree instead of walking
through an intentional village entrance.

Generated seasonal villages should preserve their runtime seasonal art while
following the composition language of `public/assets/village-board.png`: a
dense enclosing forest, intentional road entrances, a readable central town,
and rich clustered landmarks rather than visible empty margins.

## Current Findings

- Generated seasonal maps now use a `29 x 29` board with playable bounds
  `3..25`, rendered scenic boundary terrain, four directional gate frames and
  non-combat enemy ingress from outside each threshold.
- The first gate implementation protects only a short `3 x 5` cell corridor.
  From its threshold onward, each entrance can collapse into a narrow path,
  so the route no longer reads as an intentional village avenue.
- Grid-cell exclusion is insufficient for gate readability. Seasonal trees,
  clusters, bushes and foreground surround sprites can be anchored outside a
  reserved cell while their large rendered bounds still cover the gate or
  roadway.
- The lower and side gates are especially sensitive to overlap from dense rim
  artwork and touch-control framing, making open entrance cells appear hidden
  behind forest rather than connected to the town.
- Existing seasonal boundary and gate art remains suitable. The corrective
  pass must reserve a longer visual route and make foreground rendering
  respect gate sightlines rather than generating more replacement art.

## Target Presentation

### Rendered Forest Boundary

- Expand generated seasonal maps to `29 x 29`, with playable village bounds
  `3..25`. This provides a `23 x 23` playable interior and retains a
  three-cell scenic forest buffer.
- Treat all cells outside playable bounds as permanently blocked, render-only
  scenic boundary space rather than omitting them from the rendered map.
- Fill the three-cell outer buffer with seasonal ground underlay and dense forest
  dressing so the player reads the boundary as trees and wilderness, not as
  an unfinished tile edge.
- Vary boundary trees, clusters, bushes, rocks and occasional water accents
  deterministically by level seed and season while guaranteeing continuous
  border coverage.
- Remove the current playable-edge tree suppression once boundary placement
  supplies the intended forest rim, or restrict it only to art that would
  duplicate a specific surround overlay.
- Render additional beyond-tile scenery using the existing forest mass, cliff,
  water and fog surround pieces so valid camera scroll never exposes an empty
  tinted band.
- Keep the seasonal fallback color as an unseen safety fill beneath complete
  scenic coverage, not as the visible out-of-bounds presentation.

### Four Real Village Gates

- Replace path-only gate presentation with four centered entrance structures:
  north, east, south and west.
- Use these playable threshold cells on the expanded village boundary:

| Gate | Threshold Cell |
| --- | --- |
| North | `(14, 3)` |
| East | `(25, 14)` |
| South | `(14, 25)` |
| West | `(3, 14)` |

- Reserve a three-cell-wide paved avenue for each entrance: a road centerline
  plus one clear shoulder cell on both sides, continuing through the scenic
  buffer and visibly into the playable village before joining ordinary roads.
- Reserve a five-cell-wide sightline envelope around every avenue. Forbid
  trees, tree clusters, tall bushes, large rocks, ponds and blocking
  decorations in that envelope.
- Check rendered sprite overlap as well as occupied cells: scenic props,
  foreground overlap decoration and lower surround pieces whose visible
  bounds cross a gate sightline are skipped or relocated.
- Low flowers and controlled gate dressing may remain outside the paved
  avenue only when they do not obscure the gate, entrance enemies or road.
- Keep the off-board continuation of each gate blocked to the hero. The
  playable threshold remains the first combat-enabled location.
- Ensure each threshold road visibly joins the central village road network
  without reducing early wave travel pressure below its current tuning.

### Seasonal Gate Artwork

- Generate dedicated transparent gate art rather than attempting to imply a
  gate from tree gaps and incidental props.
- Produce four isometric directional frames for each visual theme:

```text
<theme>_gate_n_01
<theme>_gate_e_01
<theme>_gate_s_01
<theme>_gate_w_01
```

- Themes are `spring`, `summer`, `twilight_autumn` and `winter`; each gate
  should use the existing warm storybook style with a clearly open road,
  wooden arch or fence-post entrance, and subtle lantern/sign dressing.
- Use Image Gen source artwork on a removable magenta key background, process
  it to transparent output, and validate unclipped silhouettes and clean
  transparent edges before packing.
- Pack the directional frames into the seasonal props atlas and resolve them
  through a new `gates` seasonal prop palette. Gates render as scenery only:
  they are not repairable, targetable or player-blocking structures.

### Enemy Gate Ingress

- Enemies should visibly enter from the exterior side of a rendered gate,
  instead of appearing on the inner threshold cell.
- Generate each enemy at its selected gate's exterior visual-entry point and
  move it along the approach into that gate's playable threshold:
  - Normal enemy ingress duration: `650ms`.
  - Seasonal guardian ingress duration: `900ms`.
- While an enemy is approaching, it is visible but cannot be targeted, hit by
  traps, collide with or damage the hero, cast projectiles, or damage
  buildings.
- Once the enemy reaches the threshold, mark it active and begin its existing
  target route, attacks and rewards without otherwise changing wave balance.
- Count approaching enemies as unresolved members of the wave immediately on
  creation so a wave cannot clear while a visible enemy is still entering.

### Village-Board Composition Style

- Preserve seasonal tiles, props and building sprites; do not place
  `village-board.png` behind runtime generated gameplay.
- Use the painted board as a composition reference:
  - A continuous enchanted-forest enclosure at every outer edge.
  - A broad, open village green or plaza around the principal defense area.
  - Cobblestone routes that visibly connect all gates, protected structures
    and landmarks.
  - Buildings placed as a coherent small village rather than unrelated
    targets scattered through open grass.
  - Decorative groupings of gardens, fences, lamps, signs, mushrooms, rocks,
    ponds and magical plants around paths and buildings.
- Replace free-form decoration scattering with deterministic composition zones:

| Zone | Role | Allowed Content |
| --- | --- | --- |
| `forestRim` | Blocked out-of-bounds enclosure | Dense trees, clusters, bushes, rocks, ponds |
| `gateApproach` | Clear enemy entrance corridor | Road, gate, lamps, signs, non-obscuring fences and flowers |
| `villageGreen` | Open playable breathing room | Low flowers, grass, magical accents, lamps |
| `buildingGarden` | Gives buildings an authored setting | Fences, beds, bushes, signs, small props |
| `landmarkPocket` | Distinct secondary destinations | Well/market surroundings, lamp/sign clusters |

- Keep combat mechanics unchanged in this environment pass: hero classes,
  enemies, waves, gold, cards, repairs, building health and seasonal
  progression do not receive balance changes. The entry animation changes only
  presentation and the moment combat eligibility begins.

## Implementation Approach

### Generation And Data Ownership

- Keep `src/levels/buildSeasonBoard.ts` responsible for seasonal composition
  intent: central layout template, four gate locations, road connections,
  protected-building placement and named decoration zones.
- Extend generated-level types with render-only boundary collections and
  explicit gate metadata:

```ts
type GateDirection = 'north' | 'east' | 'south' | 'west';

interface GeneratedGate {
  id: string;
  direction: GateDirection;
  threshold: GridPoint;
  visualEntry: GridPoint;
  approachCells: GridPoint[];
  clearCells: GridPoint[];
  roadCells: GridPoint[];
  sightlineCells: GridPoint[];
}

scenicTerrain: LevelPlacement[];
scenicObjects: LevelPlacement[];
gates: GeneratedGate[];
```

- Produce scenic terrain and scenery placements for cells outside
  `playableBounds`, while leaving them permanently false in walkability and
  reachability grids and absent from combat target, repair and enemy
  destination logic.
- Use seeded placement rules per composition zone rather than selecting border
  scenery at render time, so screenshots and regressions are reproducible.
- Represent exterior road continuation and gate artwork in scenic collections,
  while storing only each inner threshold in gameplay `spawnPoints`.
- Make gate reservations authoritative during scenic and playable decoration
  placement: road cells remain paved, sightline cells reject tall decoration,
  and any rendered canopy or foreground surround piece that still overlaps a
  projected sightline is suppressed at render time.

### Enemy Runtime Entry State

- Extend the runtime enemy representation with entrance state:

```ts
entranceState: 'approaching' | 'active';
entryGateId: string | null;
```

- Spawn selection chooses a validated gate rather than a bare edge point.
  Exterior entry motion is presentation-only; route selection still starts
  from the threshold, so existing pathfinding and building targeting rules
  remain authoritative.
- Transition from `approaching` to `active` only on threshold arrival, then
  enable ordinary collision, combat and special-attack updates.

### Rendering And Camera Coverage

- Update `src/main.ts` and existing scene renderers to draw scenic boundary
  placements below/around playable terrain and then draw the outer surround
  dressing that covers beyond-matrix camera views.
- Reuse seasonal atlas frames for cell-based border dressing and existing
  environment/world-edge frames for larger perimeter masses, cliffs, water and
  fog. Add only the new directional seasonal gate art required for readable
  entrances.
- Keep player-occlusion fading for ordinary tall scenery, but omit tall
  boundary and foreground scenery that would hide a gate avenue; fading is not
  an adequate substitute for an entrance remaining readable.
- Compute camera coverage from the combined rendered board and surround extent,
  then clamp follow travel so every legal camera position remains covered by
  scenic art.
- Preserve parallax, but ensure parallax motion cannot detach the visible
  forest border from the playable map edge or open a plain-color gap.

### Seasonal Presentation And Debugging

- Extend seasonal presentation configuration with a boundary palette/density
  policy, a `gates` prop palette, and directional gate frame keys for Spring,
  Summer, Twilight Autumn and Winter.
- In `G` debug mode, render distinct overlays for:
  - Playable walkable cells.
  - Scenic-only blocked boundary cells.
  - Gate structures, paved avenue cells and protected sightline cells.
  - Actual playable threshold spawn cells.
  - Enemies in `approaching` versus `active` entry state.
  - Camera coverage and surround coverage bounds.
- Surface boundary coverage failures and any rejected/invalid gate-corridor
  obstruction in debug diagnostics so a seed, season or camera extreme that
  exposes fallback color or blocked entry art can be reproduced directly.

## Test Plan

### Automated Coverage

- Verify generated seasonal maps use `29 x 29` dimensions and playable bounds
  `3..25`.
- Verify each season generates exactly four centered gates with threshold cells
  `(14, 3)`, `(25, 14)`, `(14, 25)` and `(3, 14)`.
- Verify every gate produces a continuing three-cell-wide paved avenue and a
  wider sightline envelope; no tree, cluster, rock, pond, bush or blocking
  decoration intersects the protected sightline.
- Verify every visual theme registers all four directional gate art frames and
  resolves them from the seasonal props palette.
- Verify every outside-playable matrix cell remains collision-blocked while
  yielding sufficient scenic terrain/forest placements for its configured
  boundary zone.
- Verify player routes, building attack/repair access, spawn-to-target paths
  and player-pocket validation remain valid with the new gates and clustered
  village composition.
- Verify non-gate edge scenery remains rendered, gate-overlapping scenery is
  intentionally suppressed, and surround coverage encloses all allowed camera
  extents without blocking an entrance.
- Verify parallax offsets cannot reveal uncovered fallback-color regions at
  any clamped camera position.
- Verify normal enemies and guardians move from exterior gate entries to their
  threshold before becoming targetable, hazardous, projectile-capable or
  building-damaging.
- Verify ingress enemies remain counted in wave resolution until their ordinary
  active resolution path completes.

### Manual Verification

- Walk to each reachable edge and camera extreme in Spring, Summer, Twilight
  Autumn and Winter.
- Confirm no empty or plainly tinted out-of-bounds cells appear during movement,
  camera easing, parallax, resize or debug inspection.
- Confirm the forest perimeter clearly communicates an impassable boundary and
  each of the four rendered gates remains unobstructed and immediately
  recognizable.
- Observe enemies and seasonal guardians entering at each gate; confirm no
  enemy appears to emerge from a tree and no pre-threshold enemy can interact
  with combat.
- Confirm town composition resembles the painted-board reference through a
  central open area, connected roads and coherent garden/landmark clusters.
- Confirm collision, repair access, enemy telegraphs, foreground occlusion,
  touch controls and HUD readability remain unchanged.

### Validation Commands

- Run `npm run build:scene-variants`.
- Run `npm run validate:scene-variants`.
- Run `npm run validate:levels`.
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.

## Acceptance Criteria

- Normal generated seasonal gameplay never visibly exposes unfinished
  fallback-color out-of-bounds space at any permitted camera location.
- A player immediately understands that the dense forest rim is not walkable
  and that enemies arrive through four explicit, open gate structures.
- No gate entrance is visually obstructed by a tree, large foliage sprite or
  blocking decoration in any season or validated seed.
- Enemies visibly cross each gate before combat activates, without changing
  wave budgets, building routes or combat rewards.
- Generated maps retain seasonal identity while reading like authored villages
  in the style and composition of `village-board.png`.
- The environment pass does not alter combat balance or invalidate procedural
  route, clearance and pocket-safety guarantees.

## Assumptions

- This document describes the implemented generation direction and the gate
  sightline remediation contract; asset regeneration is not required for the
  sightline pass.
- Generated seasonal maps are in scope; legacy static/painted-board comparison
  mode remains unchanged.
- Seasonal runtime art is reused and arranged to match the original board's
  composition; the painted board is not used as a runtime background.
- Enemy presentation uses four generated seasonal gate structures with
  non-combat exterior ingress and combat activation at inner thresholds.
- Directional gate artwork already exists; boundary scenery continues to reuse
  existing seasonal and environment atlas assets while yielding to gate
  sightlines.
