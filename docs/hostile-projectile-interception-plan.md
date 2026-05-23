# Hostile Projectile Interception Plan

## Purpose

This plan fixes a combat readability and fairness bug reported in
`projectile-issue.png`: a hostile spell can visibly overlap the hero while
continuing to its building target and damaging the village instead.

The intended rule is that the hero can physically intercept building-targeted
projectiles. If a hostile shot touches the hero, it is resolved against the
hero and cannot also strike the building.

## Current Findings

- `src/projectiles.ts` launches both Spitter and guardian projectiles toward a
  stored `targetBuilding`.
- Hostile projectile updates currently check hero overlap only for Warrior
  `Shield Guard`; when the guard does not block, the projectile continues until
  it reaches the target building or expires.
- `src/main.ts` already owns `takePlayerDamage(...)`, including self Magic
  Shield absorption, player invulnerability, Warrior melee damage reduction,
  hit feedback, knockback/recovery, and player game-over handling.
- Building Magic Shield already protects a building through
  `damageProtectedBuilding(...)` and should continue to do so only for
  projectiles that reach the building.

## Required Behavior

### Collision Resolution Order

Resolve every enemy-owned projectile in this order:

1. If it overlaps the hero and the Warrior's frontal guard applies, block or
   reflect the projectile using the existing skill behavior.
2. Otherwise, if it overlaps the hero, apply hero-impact handling and consume
   the projectile.
3. Otherwise, if it reaches its building target, apply building-impact
   handling and consume the projectile.
4. Otherwise, expire it after its travel range is exhausted.

This order ensures Shield Guard remains the highest-priority defensive
interaction while an unguarded hero can still body-block a shot.

### Hero Impact

- Apply hero damage through `takePlayerDamage(...)` rather than duplicating
  defense logic in the projectile system.
- Destroy the projectile after hero overlap even if damage is fully absorbed by
  a Sorcerer self shield or ignored during active invulnerability frames.
- Use the shooter as the impact source so current knockback and hit feedback
  remain coherent.
- Do not run building-impact logic after a hero collision in the same update.

### Damage Values

- Retain existing building-impact values:
  - Spitter projectile: `3` building damage.
  - Guardian projectile: `5` building damage.
- Add separate hero-impact values:
  - Spitter projectile: `1` heart.
  - Guardian projectile: `1` heart.
- Keep reflected projectile enemy damage behavior unchanged unless playtesting
  later identifies a balance issue.

## Implementation Approach

### Projectile Runtime And Configuration

- Add configured hero-impact damage for hostile projectile types alongside the
  existing building/projectile constants in `src/gameConfig.ts`.
- Extend the hostile projectile runtime data in `src/projectiles.ts` with:
  - `heroDamage`
  - `sourceEnemy`
  - existing building-target damage and `targetBuilding`
- Populate these fields in `fireEnemyProjectile(...)` for Spitter and guardian
  shots.

### Projectile Update Flow

- Refactor enemy-owned projectile handling in `updateProjectiles(...)` into
  explicit guard, hero-hit, building-hit, and expiry branches.
- Preserve current frontal guard detection and Level 9 reflection behavior.
- For an unblocked hero overlap, call
  `scene.takePlayerDamage(projectile.heroDamage, projectile.sourceEnemy)`,
  spawn/read existing hit feedback through that path, and destroy the
  projectile immediately.
- Leave player-owned projectile collision and reward behavior unchanged.

### Scene API And Diagnostics

- Expose `takePlayerDamage(...)` through `SceneAPI` if it is not already part
  of the typed renderer/combat contract.
- Add development diagnostics for the last hostile projectile resolution:
  `guarded`, `reflected`, `hero-hit`, `building-hit`, or `expired`.
- Include projectile type and source role in debug output so guardian and
  Spitter cases can be reproduced independently.

## Test Plan

### Automated Coverage

- A Spitter projectile crossing the player damages the hero by `1`, is
  destroyed, and does not damage its target building.
- A guardian projectile crossing the player damages the hero by `1`, is
  destroyed, and does not damage its target building.
- A Sorcerer self Magic Shield absorbs an intercepted hostile projectile and
  the shot still cannot pass through to a building.
- A Sorcerer building Magic Shield absorbs a projectile when the hero does not
  intercept it.
- Warrior Shield Guard blocks frontal hostile shots before ordinary hero-hit
  resolution.
- Level 9 Warrior reflection reverses the projectile and does not apply hero or
  building damage on the reflection frame.
- A hero within invulnerability frames still consumes an overlapping hostile
  projectile, preventing pass-through building damage.
- A hostile projectile that never intersects the hero continues to damage its
  intended building exactly as before.

### Manual Verification

- Reproduce the screenshot scenario with an Archer between a guardian and the
  target building; confirm the hero loses a heart and the building health does
  not change from that shot.
- Repeat with Warrior guard at Levels 1 and 9 and with Sorcerer self/building
  shield placement.
- Inspect debug output to confirm each impact is labeled with its resolved
  outcome.

### Validation Commands

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.

## Acceptance Criteria

- A hostile projectile cannot damage both the hero and a building after one
  continuous flight.
- Both Spitter and guardian shots can be intercepted by any class.
- Existing class defenses remain distinct: Warrior blocks/reflects, Sorcerer
  absorbs through the selected shield target, and Archer can body-block at
  personal risk.
- The building-targeting behavior remains intact when the hero is not in a
  projectile path.

## Assumptions

- A hero collision consumes the projectile even when player damage is prevented
  by invulnerability or shielding.
- Spitter and guardian projectile body-blocking follow the same rule.
- This fix changes projectile resolution only; boss firing cadence, enemy AI,
  health balance, and projectile artwork are out of scope.
