# Game Assets Remediation Plan

## Purpose

This plan addresses the missing or placeholder artwork visible in the class picker,
touch controls, and level-up card screen. It defines the Image Gen asset set,
integration points, and validation work without changing gameplay balance.

Reference screenshots:

- `splash-screen-assets-issues.png`: class picker needs class-specific visual treatment.
- `archer-missing-assets.png`: Archer still appears as a reused/tinted hero and Trap is a placeholder.
- `warrior-missing-assets.png`: Shield Guard needs dedicated button art.
- `sorcerer-missing-assets.png`: Magic Shield incorrectly resembles Wand Bolt.
- `level-up-cards-missing-assets.png`: card art is generic and tier pips should be removed.

## Current Findings

- Warrior and Archer currently share the base hero sheet; Archer is differentiated by
  tint rather than dedicated class art.
- The runtime hero animation contract is an `8 x 4` sheet, with animation rows for
  idle, walk, main attack, and skill.
- Touch controls currently depend on generated `shieldIconTexture` and
  `trapIconTexture`, while Magic Shield reuses the spell icon.
- The card system already calls the movement card `Swift Boots`; that name remains
  canonical.
- The level-up overlay renders five progress pips and numeric card tiers. Persistent
  cards should instead show a Roman numeral tier badge.

## Asset Deliverables

### Hero Class Artwork

| Asset | Purpose | Required Result |
| --- | --- | --- |
| Archer hero sheet | Selection preview and playable class animation | New transparent `8 x 4` source sheet with a visually distinct woodland archer, including bow-shot and trap-placement rows |

The Archer should remain compatible with the existing runtime frame contract. The
Warrior and Sorcerer sheets can remain unchanged unless later visual QA identifies
matching animation-quality issues.

### Skill Artwork

| Skill | Required Assets | Visual Direction |
| --- | --- | --- |
| Shield Guard | Touch/HUD icon; optional guard effect refresh | A readable raised shield with a protective glow, distinct from repair and wall-upgrade art |
| Trap | Touch/HUD icon and ground trap sprite | A compact sprung vine or rope snare that reads clearly against grass and flowers |
| Magic Shield | Touch/HUD icon and shield effect if needed | A translucent magical barrier or protective dome, clearly different from a wand bolt |

Skill art must remain legible in the circular touch-button treatment and against the
busy village background.

### Level-Up Card Illustrations

Generate one reusable illustration for each common card:

| Card | Illustration Brief |
| --- | --- |
| Swift Boots | Enchanted light-footed boots with wind or leaf motion |
| Stronger Strikes | Empowered sword strike with bright impact emphasis |
| Quick Hands | Rapid attack cue, such as swift gloves or repeated weapon motion |
| Reinforced Walls | Protected village wall or building with strengthened masonry |
| Tough Heart | Warm heart emblem conveying increased hero resilience |
| Magic Repair | Restored village building surrounded by restorative magic |

Do not generate full card variants for every tier. The illustration is stable; the UI
adds the tier badge.

## Image Gen Workflow

### Style And Output Contract

- Match the existing warm, richly painted, fairy-tale village style.
- Generate storybook-fantasy sprites and icons with bold silhouettes and limited fine
  detail so they remain readable at runtime size.
- Keep generated assets free of baked-in labels, tier numbers, card frames, UI text,
  or watermarks. Game UI owns all typography and badges.
- Produce transparent PNG-ready source art for atlas integration.

### Transparent Asset Process

1. Use the built-in Image Gen tool for each distinct source asset or source sheet.
2. Generate subjects on a flat removable chroma-key background.
3. Use a magenta key background for the foliage-heavy Trap asset so green leaves and
   vines are preserved during extraction.
4. Copy selected project-bound outputs into the workspace before integration.
5. Remove the chroma key with the installed Image Gen transparency helper, using soft
   matte and despill processing to avoid bright edge halos.
6. Inspect transparent corners, edge quality, silhouette clarity, and downscaled
   readability before registering an asset.

Keep source images alongside the existing atlas sources or source sheets, and produce
runtime atlas/sheet outputs through the repository tooling. Do not hand-edit generated
atlas JSON or leave runtime-referenced art only in an external generation directory.

## Integration Plan

### Class Preview And Gameplay Sprite

- Register the Archer source sheet and built runtime sheet using the established asset
  loading/registry conventions.
- Update the class texture selection in `src/main.ts` so Archer uses the new dedicated
  sheet in the class picker and gameplay instead of the tinted shared hero asset.
- Preserve the existing `8 x 4` animation layout and validate all four animation rows.

### Skill Buttons And Effects

- Add dedicated atlas frames for Shield Guard, Trap, and Magic Shield through the
  appropriate UI/touch/effects atlas source workflow.
- Update `src/touchControls.ts` to select the dedicated skill frame for each class.
- Retire runtime-generated placeholder icons only after no active UI path references
  them.
- Use the Trap ground asset and any Magic Shield/Shield Guard effect art in gameplay
  only where it improves skill readability without obscuring enemies or buildings.

### Card UI And Tier Badges

- Register the six common-card illustrations as card/UI assets.
- Remove the progress-pip creation, update, and preview presentation paths from the
  level-up overlay in `src/main.ts`.
- Present persistent card titles with the offered tier in Roman numerals:
  `Swift Boots I`, `Swift Boots II`, through `Swift Boots V`.
- Add a compact badge overlay using crisp game-rendered text for `I`, `II`, `III`,
  `IV`, or `V`; do not bake numerals into Image Gen artwork.
- Display `Magic Repair` as a consumable comeback card with no badge or pip track.

## Acceptance Criteria

- Archer has a distinct preview and playable sprite with functional idle, walk,
  main-attack, and skill animation rows.
- Shield Guard, Trap, and Magic Shield are immediately distinguishable in touch/HUD
  controls and no skill uses a placeholder or incorrect duplicate icon.
- Each of the six common cards is recognizable from its illustration.
- Persistent card offers show Roman numeral badges from `I` to `V`; no card progress
  pips remain visible or active.
- `Magic Repair` never displays a tier badge.
- Asset source files are preserved, runtime atlas/sheet generation succeeds, and new
  assets display cleanly at gameplay scale.

## Validation Checklist

- Validate the Archer sheet dimensions, frame count, row ordering, and animation
  playback for every class action.
- Run the relevant atlas build and validation tooling for added UI, touch, and effects
  assets.
- Inspect the class picker and all three class touch-control layouts on the target
  screen aspect ratios.
- Trigger card offers for each persistent tier and `Magic Repair`, confirming Roman
  badge display and absence of pips.
- Run the standard project validation after integration: `npm run typecheck`,
  `npm run lint`, and `npm test`.

