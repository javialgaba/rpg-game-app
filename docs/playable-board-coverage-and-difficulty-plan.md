# Playable Board Coverage And Difficulty Relief Plan

## Summary

The current highest-priority issue is that large playable areas look unfinished. The debug overlay confirms these cells exist, but many authored CSV cells render as broad, low-detail grass fields with no terrain variation or low scenery. This makes the board look like it is missing tiles even when collision and routing data are present.

This plan fixes the visual coverage problem first, then makes early waves more forgiving by adding automatic heart recovery drops and light early-wave tuning.

## Root Cause

- The parallax apron work covers out-of-map camera exposure, but the screenshots show the issue inside the authored `29 x 29` village map.
- Authored maps still contain large areas of plain cells such as `grass||`, `gate_road||`, or other low-detail terrain without decorative objects.
- These cells technically resolve to a terrain frame, but repeated plain terrain reads as an empty or missing board area at runtime scale.
- Existing validation catches only a simple undressed `5 x 5` grass clearing. It does not catch irregular large plain regions, sparse gate-adjacent fields, or low-detail terrain bands around buildings.
- Gameplay difficulty is also too punishing because the player has little recovery once damaged. Enemy reward feedback is already automatic for gold, so heart recovery should follow the same rule: immediate credit plus a short visual effect, not a collectible object.

## Priority 1: Full Playable Board Visual Coverage

Every playable cell should look intentionally authored. The board may include open village greens, but those areas need visible grass variation, flowers, tufts, path edging, or other low non-blocking detail so they do not read as missing tiles.

### Authored Map Composition

- Revise `village-crossroads-01.csv` and `village-crossroads-02.csv` so large plain fields are replaced with composed village ground.
- Keep the current CSV format: `terrain|object|marker`.
- Preserve the `29 x 29` map size, playable bounds `3..25`, gates, enemy thresholds, player spawn, protected buildings, roads, camera behavior, and parallax behavior.
- Use existing terrain roles first:
  - `grass` only for small calm patches.
  - `flower_grass` for meadow variation.
  - `stone_road` and `plaza` for village paths and central breathing room.
  - `gate_road` only for gate corridors and their direct approach.
  - `forest_floor` for scenic rim and dense edge transition.
- Use existing non-blocking object roles to dress open areas:
  - `flowers`
  - `grass_tuft`
  - `magic_patch`
  - low `bush` only where it does not block movement or sightlines, if the role remains visually low enough.
- Avoid adding blocking scenery to fix visual emptiness. Trees, rocks, ponds, and dense props should stay out of roads, gate corridors, repair access lanes, and combat spaces.

### Terrain Coverage Rules

- Every playable CSV cell must resolve to a visible terrain frame.
- Plain terrain is allowed only in small, intentional patches.
- A large plain region should fail validation even if it is irregular rather than a perfect rectangle.
- Gate corridors are exempt from decoration density rules, but they must still render as visible `gate_road` or road terrain.
- Building footprints and immediate repair/attack access space may remain clear, but their surrounding edges should use grass variation or road edging.
- The outer village transition should move from village ground to dense forest rim instead of broad flat green bands.

### Validation Changes

Extend authored-map validation beyond the current `5 x 5` plain-grass check.

Recommended checks:

- Flood-fill connected plain regions inside playable bounds.
- Treat `grass||` as plain.
- Treat `gate_road||` as plain only when it is outside a known gate corridor or road connection.
- Treat `flower_grass||`, `grass|flowers|`, `grass|grass_tuft|`, and `grass|magic_patch|` as visually dressed.
- Reject any non-road plain region larger than a small threshold, for example `14` connected cells.
- Reject any row or column band near buildings or gates that contains too many plain cells in a short span.
- Report the first offending map ID and CSV coordinate in the compact debug overlay.

### Export Tooling

Update `tools/export-authored-levels.mjs` so generated starter maps no longer recreate sparse fields.

The exporter should:

- Paint more `flower_grass` variation across village greens.
- Place low non-blocking objects with deterministic spacing.
- Keep a minimum clear radius around buildings, roads, gates, enemy thresholds, and player spawn.
- Keep three-cell gate corridors visually open.
- Preserve dense forest rim coverage.

The exported CSVs remain editable authored sources after generation; runtime play should not re-randomize the map layout.

## Priority 2: Easier Recovery And Early Balance

The game should still apply pressure, but early runs should not collapse after one mistake. Add automatic heart recovery as the first difficulty relief mechanic.

### Automatic Heart Drops

- Enemies may reward hearts only when the player is below max health.
- Heart rewards are credited immediately when the enemy is defeated.
- No heart pickup object waits on the map.
- Show a short floating heart animation at the defeated enemy, then fade it out automatically.
- Clamp healing at max hearts.
- Only player-defeated enemies can trigger heart recovery.
- Bomb Buds that successfully explode without being defeated give no heart, no gold, and no defeat credit.
- Invulnerable or shielded player states do not change reward behavior.

Recommended starting values:

- Normal defeated enemies: `8%` heart chance when the hero is damaged.
- Heavy or priority enemies: `12%` heart chance when the hero is damaged.
- Boss or guardian defeat: guaranteed `+1` heart if the hero is damaged.
- Pity rule: if the hero is at `1` heart and no heart has been restored in the last `12` player-defeated enemies, the next eligible defeated enemy restores `1` heart.

### Early Wave Softening

Keep the existing class identities and enemy curves, but soften the first few levels while the player is learning.

Recommended first pass:

- Level 1 budget: `5` instead of `6`.
- Level 2 budget: `8` instead of `9`.
- Level 3 budget: `11` instead of `12`.
- Level 4 and later: keep current budget curve unless playtesting still feels too harsh.

This keeps the later game intact while making the first successful card choices easier to reach.

## Implementation Points

- `public/levels/authored/village-crossroads-01.csv`
  - Replace large plain areas with richer authored terrain and low non-blocking decoration.
- `public/levels/authored/village-crossroads-02.csv`
  - Apply the same visual coverage standard to the second map.
- `src/levels/authoredMap.ts`
  - Add connected-region validation for undressed playable terrain.
  - Report clear map coordinates for the first failure.
- `tools/export-authored-levels.mjs`
  - Improve starter map dressing and avoid sparse grass fields.
- `src/gameConfig.ts`
  - Add heart reward tuning constants.
  - Add softened early wave budget constants if the budget curve is updated.
- `src/combat.ts`
  - Extend enemy defeat reward handling to roll and apply automatic heart rewards.
- `src/effects.ts` or `src/projectiles.ts`
  - Add or reuse floating reward feedback for the heart visual.
- `src/main.ts`
  - Ensure HUD hearts update immediately after automatic recovery.
  - Surface authored-map visual coverage failures in debug output.

## Debug Requirements

- Debug mode should distinguish:
  - authored terrain cells;
  - visually dressed cells;
  - plain cells that are allowed because they are road, gate, or clearance space;
  - plain cells that fail the coverage rule.
- The compact debug dock should show the first visual coverage failure as:
  - map ID;
  - CSV coordinate;
  - reason, such as `plain region too large`.
- The world overlay may highlight failing plain regions with a subtle color separate from collision blockers.

## Test Plan

- Add authored-map validation tests:
  - Reject a large connected `grass||` region in playable bounds.
  - Permit small plain patches around building access and roads.
  - Permit clear gate corridors when they use `gate_road`.
  - Reject low-detail gate-adjacent fields that are not part of the reserved corridor.
  - Validate both authored CSV maps pass the new coverage rules.
- Add heart reward tests:
  - Damaged player can receive an automatic heart on eligible enemy defeat.
  - Healing clamps at max hearts.
  - Full-health player receives no heart.
  - Pity rule triggers at `1` heart after the configured defeat threshold.
  - Bomb Bud self-detonation does not grant a heart.
  - Boss defeat grants a heart only when the hero is damaged.
- Add early-wave tests if budgets change:
  - Level 1, 2, and 3 budgets match the softened values.
  - Level 4 and later remain on the current curve.
- Manual validation:
  - Open `?map=village-crossroads-01&debugLevel=1&forceDesktop=1&skipCountdown=1`.
  - Inspect the full playable board with debug mode on and off.
  - Repeat for `village-crossroads-02`.
  - Confirm no broad empty-looking fields remain.
  - Confirm hearts restore automatically and show clear feedback without requiring pickup collision.
- Run:
  - `npm run validate:levels`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`

## Acceptance Criteria

- The whole playable board looks intentionally tiled and decorated.
- No large playable area reads as missing, transparent, or unfinished terrain.
- Gate corridors remain clear, visible, and uncluttered.
- Added visual dressing does not block movement, attacks, repairs, enemy ingress, or projectile readability.
- Heart rewards are automatic, visible, and never require walking over a pickup.
- Early levels feel more forgiving without removing pressure from later waves.

## Assumptions

- The reported missing-tile issue is a visual composition and validation gap inside authored maps, not absent terrain rendering.
- Existing seasonal terrain and low-decoration assets are sufficient for the first fix.
- New Image Gen assets are not required for this pass.
- Authored CSV maps remain the runtime source of village layout.
- Heart recovery should behave like gold recovery: immediate reward plus visual feedback.
