# Authored CSV Village Maps Plan

## Purpose

This plan replaces runtime-random village layout construction with a fixed
catalog of editable CSV maps. It addresses the gate and blocker readability
problems reported in the generated seasonal village: visible gate art can sit
on incorrect ground treatment, and debug-blocking tree or rock cells can fail
to match what the player actually sees.

The result should preserve the current class combat, seasonal presentation,
camera, collision validation and enemy entrance behavior while making each
map's layout and visual roles directly authorable.

## Current Findings

- The current matrix stores broad gameplay tokens such as `path`, `tree` and
  `blocker`, while seasonal art frames are resolved later by rendering code.
- Gate artwork is drawn independently of its underlying terrain; an east,
  west or south gate can therefore appear over a generic open tile instead of
  an intentional entrance surface.
- Gate sightline protection can skip a large tree or rock sprite after its
  logical placement has already become part of collision and debug output.
  A blocked cell can consequently be labelled `TREE` without displaying a
  tree that explains the obstruction.
- Procedural placement makes these mismatches difficult to correct by hand
  and difficult to reproduce as an authored village composition.

## Target Runtime Model

- Normal gameplay loads one authored map from a fixed catalog rather than
  calling the procedural board builder to create a new layout.
- A fresh run randomly selects one eligible authored map. The selected map ID
  is stored in resume state and reused across seasonal transitions and reloads.
- Seasonal changes recolor or replace the selected map's authored visual roles
  through the existing seasonal registries; they do not regenerate geometry.
- Pathfinding, building defense, repairs, enemy waves, gate ingress, player
  clearance, camera coverage, foreground fading and seasonal ambience remain
  active over the authored layout.
- `buildSeasonBoardConfig(...)` is retained only as development/export tooling
  for producing starter drafts, not as the normal runtime map source.

## CSV Map Contract

### Files And Dimensions

- Store authored layouts under `public/levels/authored/`.
- Produce two initial editable source maps during implementation:
  - `village-crossroads-01.csv`
  - `village-crossroads-02.csv`
- Each file is a `29 x 29` comma-separated grid with playable village bounds
  `3..25`, matching the current expanded village footprint.
- A single CSV represents a layout for every season; no season-specific map
  copies are required.
- The outer `0..2` and `26..28` bands remain authored `forest_floor` scenic
  buffer cells, except for the four three-cell-wide `gate_road` corridors.
  The renderer extends that same forest/gate-road language into the
  camera-only apron outside the CSV so parallax never exposes plain fallback
  ground as a board edge.

### Cell Encoding

Each cell stores three layers separated by `|`:

```text
terrain|object|marker
```

Examples:

```text
stone_road||
gate_road|gate_s|enemy_threshold_s
grass|tree_broadleaf|
plaza|castle|
grass||player_spawn
```

Layer responsibilities:

| Layer | Purpose | Example IDs |
| --- | --- | --- |
| `terrain` | Exact authored ground role mapped to seasonal art | `grass`, `flower_grass`, `stone_road`, `plaza`, `forest_floor`, `gate_road` |
| `object` | Visible structure, prop or blocker role | `tree_broadleaf`, `tree_conifer`, `rock_large`, `pond`, `castle`, `cottage`, `gate_n`, `gate_e`, `gate_s`, `gate_w` |
| `marker` | Non-visual gameplay metadata | `player_spawn`, `enemy_threshold_n`, `enemy_threshold_e`, `enemy_threshold_s`, `enemy_threshold_w` |

- Empty layers are represented by adjacent separators, for example
  `stone_road||enemy_threshold_s`.
- IDs are a validated allowlist. Unknown IDs, missing terrain, malformed
  layer counts and duplicate exclusive markers are map-load errors.
- Terrain and object IDs describe authored roles rather than choosing from a
  randomized palette. A seasonal resolver maps each role to the corresponding
  seasonal frame.

## Gates And Visible Blockers

- Each authored map must contain exactly four directional gate objects and
  matching threshold markers: north, east, south and west.
- Gate objects must use their matching directional frame and must be placed on
  `gate_road` terrain that visibly joins the internal road network.
- Each threshold preserves the existing exterior approach, non-combat enemy
  ingress and activation-after-crossing behavior.
- Gate corridors and sightline zones must be authored clear of trees, rocks,
  ponds, blocking shrubs and large foreground clusters.
- Trees, rocks, ponds, buildings and other blocking scenery must produce both
  visible placement art and the matching collision footprint. The renderer
  must not silently hide invalid authored blockers as a normal correction.
- Validation should reject sightline overlap, missing gate-road continuation,
  incorrect directional gate pairing, hidden blockers and missing rendered
  forest boundary coverage.

## Implementation Approach

### Loading And Materialization

- Add an authored CSV parser/materializer under `src/levels/` that reads the
  layered cells and produces the existing placement, gate, grid and
  validation structures.
- Extend level types with authored terrain, object and marker role unions plus
  a catalog entry containing the CSV asset path.
- Keep gameplay-facing generated-level structures stable wherever practical so
  existing pathfinding, movement, rendering and debug code can consume
  materialized authored levels.
- Resolve authored visual roles through seasonal mappings in scene variant
  configuration; do not invoke randomized `selectSeasonalFrame(...)` for
  authored terrain or blocker roles.

### Catalog, Selection And Resume

- Change `src/levels/levelCatalog.ts` into an authored-map catalog containing
  map ID, display label and CSV path.
- On a fresh run, select an authored map randomly from the runtime catalog.
- Add selected map ID to the run resume snapshot and reload the same CSV map
  on seasonal scene changes.
- Retain an explicit preview override such as `?map=village-crossroads-01`
  for designers and test automation.
- Keep legacy painted/static comparison mode separate from authored seasonal
  map selection.

### Starter Map Export

- Add a one-time developer script that materializes two seeded procedural
  layouts into layered CSV drafts.
- Require the export step to emit four correctly oriented gates, paved entrance
  routes, clear sightlines, dense rendered borders, valid protected buildings,
  player clearance and valid enemy routes.
- Once exported, treat each CSV as authored source content. Runtime loading and
  validation never regenerate or overwrite manual CSV edits.

## Validation And Tests

### Automated Coverage

- Parse valid layered cells and report invalid IDs, malformed cells, invalid
  dimensions and missing exclusive markers with map ID and CSV coordinates.
- Verify both starter maps are exactly `29 x 29`, use playable bounds `3..25`,
  have one player spawn and have four directional gate/threshold pairs.
- Verify each gate uses the correct directional art role and a continuous
  authored entrance road free of blocking or visually obscuring objects.
- Verify every blocking authored object produces corresponding visible
  seasonal art and collision data.
- Verify player clearance, repair access, building targeting, scenic coverage,
  enemy ingress and route reachability.
- Verify random fresh-run selection, map query override and seasonal resume
  preservation of the selected authored map ID.

### Manual Checks

- Inspect west, south and east gates in each season and confirm their object
  and ground tile treatment read as intentional entrances.
- Toggle collision debug and confirm tree, rock and pond labels correspond
  directly to visible blocker artwork.
- Move the camera to all village edges and confirm the forest border remains
  complete without ambiguous open out-of-bounds cells, including the
  non-interactive scenic apron outside the CSV bounds.
- Manually edit each exported CSV, reload it through the map override and
  confirm changes appear exactly where authored.

### Verification Commands

During implementation, run:

```bash
npm run validate:levels
npm run typecheck
npm run lint
npm test
```

## Assumptions

- Authored maps use one layered CSV file per layout, with seasonal artwork
  resolved from exact authored role IDs.
- The selected authored layout remains fixed for one run while seasonal
  presentation continues to change.
- Two procedurally exported CSV layouts provide editable starting points only;
  they are not regenerated during play.
- Runtime procedural map construction is retired from normal play and retained
  only as optional draft-generation tooling.
- Existing gate, border, camera, enemy-ingress and visibility requirements
  remain valid constraints for authored maps.
