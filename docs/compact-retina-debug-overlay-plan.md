# Compact Retina Debug Overlay Plan

## Purpose

This plan makes diagnostics readable without obscuring the village. The
current balance and collision panels are large, independent overlays, and
their text does not participate in the higher-resolution UI text policy
already used for player-facing labels.

The target is one compact, screen-fixed debug dock in the upper-left corner
that remains sharp on Retina and upscaled displays while preserving detailed
world-space collision graphics when needed.

## Current Findings

- `Balance Debug (B)` creates a `404 x 264` fixed panel with many long status
  lines, occupying an important part of the playable view.
- `G` collision mode creates its own verbose legend as scene text while also
  drawing grid, route, gate, clearance and occlusion geometry.
- `src/uiFactory.ts` already provides capped UI text resolution logic based on
  device pixel ratio and visible canvas scale, but `debugTextStyle(...)` does
  not opt into that system.
- A scrolled and zoomed world camera makes diagnostic text most useful when it
  stays attached to the UI viewport rather than world placement.

## Target Presentation

### Unified Fixed Dock

- Replace the separate text panels with one debug dock fixed to the UI camera
  in the upper-left safe area beneath the HUD.
- Keep the existing keyboard intent:
  - `B` toggles balance/runtime metrics.
  - `G` toggles world-space collision graphics and its corresponding dock
    diagnostics.
- Show the dock whenever either mode is active; hide it when neither is active.
- Default to a compact footprint sized for a few short lines rather than a
  broad report panel.
- Provide a disclosure control or debug hotkey state for an expanded detail
  view used only during deeper diagnosis.

### Compact Content

Compact mode should contain:

| Section | Information |
| --- | --- |
| Header | Active mode badges (`B`, `G`) and current authored map ID |
| Balance | Phase/level/season, hero HP/gold, enemies active/resolved, village safety |
| Collision | Hero footprint/recovery status, legal exits, selected or rejected movement |
| Map | Gate/corridor validation state and active occluder count |
| Issue | First map or validation failure, clipped to one readable line |

Expanded mode may add route scores, full validation messages, authored CSV
coordinates, placement IDs and verbose legend details.

### World-Space Visuals

- Keep collision-cell colors, road/gate outlines, attack routes, player
  clearance, pocket visualization, enemy ingress and occlusion outlines in the
  world layer so they track map geometry accurately.
- Move explanatory legend and status text to the UI dock.
- Replace persistent labels over every tree, rock or pond with color overlays
  and focused labels only for selected/highlighted cells, gates, failures or
  the player's immediate diagnostic context.
- When authored CSV validation fails, identify the map ID and cell coordinate
  in the compact issue line and expose the full error in expanded mode.

## Retina Text Policy

- Reuse `getUiTextResolution(...)` and the existing `1` through `3` capped
  resolution behavior from `src/uiFactory.ts`.
- Add a persistent debug-dock text factory or resolution-aware debug style
  that registers its text objects for resolution refresh on viewport changes.
- Render dock header, compact values, focused coordinate labels and expanded
  detail text at the high-resolution tier.
- Leave dense or short-lived world labels at normal resolution by default to
  avoid generating excessive text texture memory during `G` visualization.
- Keep text sizes, screen coordinates and collision geometry independent from
  camera zoom and map parallax.

## Implementation Approach

- Consolidate `createDebugOverlay()` and the legend text currently created by
  the generated-level debug renderer behind a shared dock model owned by the
  main scene/UI layer.
- Have the collision renderer publish concise diagnostics to the dock while
  continuing to own world geometry drawing.
- Store separate `balanceEnabled`, `collisionEnabled` and `expanded` flags so
  `B` and `G` retain their individual behavior within one presentation.
- Keep the dock ignored by the world camera and visible only through the
  existing UI camera.
- Add compact truncation for long authored-map validation errors while
  retaining the complete error in expanded mode or development logging.

## Validation And Tests

### Automated Coverage

- Verify the debug dock visibility state for balance only, collision only,
  both modes and neither mode.
- Verify `B` and `G` affect their own data/graphics without producing duplicate
  panels.
- Verify debug dock text resolution is `1` on a standard unscaled display,
  rises to at least `2` for Retina/upscaled displays and caps at `3`.
- Verify compact error presentation includes authored map ID and offending CSV
  coordinates when available.
- Verify collision geometry remains world-positioned while the dock remains
  fixed to UI camera coordinates.

### Manual Checks

- Pan and zoom around a large authored village with `B`, `G` and both enabled;
  confirm the dock remains anchored and world outlines remain aligned.
- Inspect desktop Retina and touch/emulated viewport layouts; confirm the dock
  is sharp, readable and does not hide core HUD or action controls.
- Toggle expanded diagnostics only when needed and confirm returning to compact
  mode restores the small gameplay footprint.
- Inspect gate and blocker failures from an intentionally invalid CSV map and
  confirm the compact error points directly to the editable cell.

### Verification Commands

During implementation, run:

```bash
npm run typecheck
npm run lint
npm test
```

## Assumptions

- This work affects developer-facing debug presentation only; gameplay and
  player-facing HUD layout are unchanged.
- `B` and `G` remain the existing toggle keys but present information through
  a shared dock.
- The UI text-resolution helper remains the source of truth for high-density
  text rasterization.
- High-resolution rendering is applied selectively to persistent dock text,
  not to every grid-cell debug label.
