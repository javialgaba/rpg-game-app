# Map Editor Route Plan

## Summary

Add a designer-facing `/map-editor` route to the Vite app for authoring `29 x 29` village maps using the same high-fidelity seasonal tile, prop, gate, and building assets used by gameplay. The editor exports the existing authored-map CSV format: `terrain|object|marker` cells under `public/levels/authored/`.

The season selector changes the preview art only. Exported maps remain season-neutral so one CSV continues to work across spring, summer, autumn, and winter runtime presentations.

## Key Changes

- Route bootstrap detects `/map-editor` and launches a dedicated `MapEditorScene`, while `/` keeps launching the gameplay scene.
- The editor scene provides pan, zoom, cell hover, click/drag painting, import, copy, download, and validation status.
- Editor state is stored as `AuthoredMapCell[][]` and exports exactly the existing layered CSV format.
- Terrain, object, marker, and erase tools use role palettes that match the authored CSV parser allowlists.
- Building and gate object roles are single-instance in the editor. `castle`, `cottage`, `bakery`, `market`, `well`, and the four directional gates cannot be placed twice.
- Exclusive markers are single-instance. Placing a player spawn or directional enemy threshold moves that marker rather than duplicating it.
- The season selector previews `day_spring`, `afternoon_summer`, `night_spring`, and `noon_winter` without writing season data to CSV.
- Export validates with `parseAuthoredMapCsv`, `generateLevel`, and `validateGeneratedLevel` before allowing copy or download.

## Implementation Notes

- Editor-only modules live in `src/mapEditor/`.
- Shared authored-map parsing and gameplay validation remain in `src/levels/`.
- Duplicate building validation exists in both editor placement rules and authored CSV parser validation so imported invalid CSVs are reported clearly.
- The first save workflow is browser copy/download. Direct repo writes and catalog auto-registration are intentionally left out.

## Test Plan

- Unit coverage verifies CSV round-trip, parser/palette alignment, duplicate building rejection, exclusive marker replacement, and duplicate-building export validation.
- Run focused checks first:

```bash
npm run typecheck
npm run lint
npm run validate:levels
```

- Run `npm test` before handoff when shared level behavior, assets, or build tooling are touched.

## Assumptions

- The export target is the existing authored CSV format, not a new JSON schema.
- Building uniqueness applies per authored building role: `castle`, `cottage`, `bakery`, `market`, and `well`.
- `/map-editor` is a local designer tool and does not need mobile gameplay controls.
- The editor previews authored layouts using current seasonal atlas assets; no new art is required for v1.
