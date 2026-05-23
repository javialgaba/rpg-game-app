# Player Escape Route Collision Follow-Up Plan

## Purpose

This plan addresses the remaining stuck-player report captured in
`Captura de pantalla 2026-05-25 a las 15.35.31.png`, after the initial
screen-relative movement and collision-debug refactor.

The required outcome is simple: if the debug overlay identifies an escape route
from the hero's current legal position, movement into that route must produce
visible displacement and must not leave the player apparently trapped beside a
building or decoration.

## Reproduced Evidence

The screenshot reports:

- `Hero footprint: OPEN`
- `recovery anchor: YES`
- `Visible exits: DOWN / LEFT / RIGHT`
- `rejected: blocked footprint`

The player is near the cottage/castle frontage and an adjacent blocking tree
cell. No pink pocket is shown at the player's position.

This proves that the reported state is not an invalid placement requiring
teleport recovery and is not an unreachable generated-level pocket. The current
position is legal, but the active movement attempt is being rejected even though
the movement debugger predicts escape options from the same position.

## Current Failure Hypothesis

The remaining issue is in continuous obstacle response:

- The prior `src/playerMovement.ts` implementation converted visible input into
  isometric motion correctly, but when the desired full move was blocked it
  attempted sliding by separately applying isometric `x` and `y` components.
- Those fallback axes are board axes, not visible screen directions. After the
  screen-relative input change, raw isometric-axis sliding can disagree with the
  direction a player is holding around a tree or building corner.
- The debug overlay tests four isolated cardinal probes from the current
  location. It does not verify that following an indicated exit for several
  frames remains possible, nor record which visible input produced the rejected
  attempt.

The screenshot alone does not establish whether the player was holding a fully
blocked direction or a direction that should have slid into an open exit.
Implementation should first preserve that input/position trace, then fix any
failure where valid escape intent is rejected.

## Implementation Plan

### 1. Add Deterministic Stuck-State Capture

- Extend development diagnostics with player isometric position, current
  screen-input vector, converted isometric vector, movement result, rejected
  candidate positions, and the current level seed/config.
- Add a debug command to freeze enemies and place the player at an exact
  isometric coordinate, so the screenshot position can be reproduced without
  building damage ending the run.
- In `G` mode, render the held screen direction separately from the chosen slide
  direction and label each rejected candidate with its collision source.
- Persist a short rolling movement trace in development mode only, covering the
  latest input attempts and resulting player positions.

### 2. Replace Board-Axis Sliding With Screen-Space Sliding

- Keep continuous footprint collision as the ordinary movement authority and
  keep reachable-cell recovery limited to forced invalid placement.
- Refactor the movement resolver to accept screen-space desired input and return
  the selected screen-space travel result plus rejection details.
- If the full desired motion is blocked, test visible tangent alternatives
  around the blocker rather than splitting the motion into raw isometric axes.
- Rank tangent candidates by alignment with the player's intended direction and
  continuity with the previous successful slide, so corner navigation does not
  jitter between sides.
- Convert the chosen visible travel direction to isometric coordinates only
  after selecting a valid slide candidate, then apply continuous footprint
  collision to the final displacement.
- A straight input directly into a solid obstacle may remain blocked; diagonal
  or along-edge intent with a valid tangential exit must slide smoothly.

### 3. Validate Escape Routes Over Distance

- Replace the debug overlay's single short cardinal probe with an escape probe
  that advances for multiple movement steps or until it reaches the center of a
  neighboring player-clearance cell.
- Report an exit only when that sustained probe remains footprint-walkable and
  makes meaningful visible progress.
- If no sustained exit exists while the position is marked `OPEN`, flag the
  cell as a runtime dead-end diagnostic even if it is connected in the coarse
  clearance grid.
- Use the same probe helper for regression tests and `G` mode so the on-screen
  claim matches actual movement behavior.

### 4. Add Optional Recovery Only For Genuine Runtime Dead Ends

- Do not teleport or auto-steer a player merely because the held direction
  points directly into a tree or building.
- If a legal position has no sustained escape direction because continuous
  footprint clearance disagrees with coarse reachability, recover to the
  nearest reachable safe anchor and record the offending location in debug
  output.
- Feed any reproducible runtime dead-end location back into level validation so
  future generated boards reject or prune the blocking decoration arrangement.

## Expected Code Areas

- `src/playerMovement.ts`: screen-space slide selection, sustained escape
  probing, and pure movement-result diagnostics.
- `src/main.ts`: provide current input/previous slide state and apply the
  selected movement result without broadening recovery behavior.
- `src/levelDebugRenderer.ts` and `src/devCommands.ts`: reproducible placement,
  freeze/trace diagnostics, and truthful escape-route visualization.
- `src/levels/`: validation only if a reproduced dead-end is caused by generated
  obstacle placement rather than movement response.

## Test Plan

- Add unit tests proving screen-space sliding around both sides of a blocking
  building/tree corner, including the pictured arrangement.
- Add tests where direct head-on movement is blocked but an angled input with an
  open tangent successfully slides.
- Add sustained-exit probe tests: each direction advertised by debug
  diagnostics must produce multi-step visible displacement without entering a
  blocked footprint.
- Add recovery tests ensuring legal, escapable positions are never snapped and
  genuine continuous dead ends recover to a safe anchor.
- Add deterministic debug reproduction for the screenshot coordinate/seed, with
  enemies frozen, and confirm the player can leave through each advertised
  direction.
- Run `npm run typecheck`, `npm run lint`, and `npm test` after implementation,
  then manually verify joystick and keyboard corner movement with `G` enabled.

## Acceptance Criteria

- At the reported position, `G` does not advertise an exit that fails to move
  the player when that direction is held.
- The player can move away from the cottage/tree boundary through every
  advertised route without teleporting or crossing a solid footprint.
- Obstacle contact feels like smooth visible-direction sliding, not board-axis
  snapping or immobilization.
- A rejected head-on move is clearly identified as blocked input rather than
  presented as a trapped-player state.
- Any truly inescapable continuous position is recoverable and reproducible
  through debug diagnostics.

## Assumptions

- This document is a follow-up plan only; no gameplay behavior changes are
  included in this documentation task.
- The existing isometric grid, continuous footprint collision, and generated
  reachability validation remain the foundations of the collision system.
- The screenshot indicates a legal-position movement-response failure or an
  inaccurate escape diagnostic, not proof that the procedural board contains a
  disconnected pocket.
