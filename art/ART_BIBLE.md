# CHA0S Mech Wars Pixel Art Bible

This document records the Phase 0 visual canon already present in the game. It is a preservation contract, not a redesign brief. The machine-readable authority is `art/pixel-style.json`; runtime asset registrations live in `src/render/visualManifest.js`.

## Pixel grammar

- One logical pixel is 4 world pixels at the standard 32 px actor size.
- Standard actors and props use 8×8 source masks rendered at 32×32.
- Ruin and cave walls use 16×16 source masks rendered at 64×64.
- Legacy nonstandard masks remain native: tank 10×8; mantis 11×10; fortress 12×10; eye 12×12. Bosses remain 48×48 in gameplay.
- Every generated bitmap uses binary alpha only: fully transparent or fully opaque.
- Runtime scaling is nearest-neighbor. Canvas smoothing stays disabled and CSS canvases use `image-rendering: pixelated`.

## Palette and ramps

The palette in `pixel-style.json` is derived from the current JavaScript, CSS, and HTML. Existing short hex values are normalized there to six digits without changing their RGB values. Generated assets may only use registered palette values.

The canon is high-contrast neon over near-black grounds:

- HUD/player: `#001020 → #0088aa → #00eaff → #ffffff`.
- Danger: `#550000 → #880000 → #ff0000 → #ffffff`.
- Fire: `#ff4400 → #ff6600 → #ff9900 → #ffaa00 → #ffff00`.
- Forest, ruins, and dungeon ramps retain their current ground, obstacle, weather, and boss colors exactly.

No automatic palette expansion, hue shift, antialiasing color, or replacement palette is permitted.

## Shape, outline, and shading

- Sprite silhouettes are the authored masks. Do not erode, dilate, smooth, or reinterpret them.
- Default sprites have no separate outline and use a flat semantic `base` fill.
- Outline and shading passes are opt-in recipe operations. They must use registered colors and cannot alter the requested anchor or canvas dimensions.
- Generated organic masks use deterministic seeded cellular steps. Runtime decals retain the current four-blob geometry and color while requesting that recipe by visual ID.
- Details are at least one source pixel. Fractional source details and antialiased generated edges are forbidden.

## Anchors and dimensions

- Actors, props, structures, and organic marks normalize to bottom-center `[0.5, 1]`.
- Projectiles and radial effects use center `[0.5, 0.5]`.
- Tiles and screen-space overlays use top-left `[0, 0]`.
- Asset dimensions, anchors, and gameplay draw bounds are manifest data and are contract-tested.

## Shadows and compositing

- The canonical shadow is a 32×16 black ellipse at 50% opacity.
- Ground actors place it at their lower edge; flying actors and the eye boss retain their existing vertical offsets.
- Cyan, red, yellow, and magenta glows retain the existing `lighter` blend mode.
- Scorch marks retain `multiply`; normal blood decals retain `source-over`.

## Motion and effects

- Animation is procedural and preserves existing frame timing: invulnerability blink, recoil, flying lift/scale, dash echo, shield pulse, overclock wash, boss rage, turret muzzle flash, pickup bounce, weather drift, shockwave growth, floaters, camera transforms, and screen overlays.
- Procedural motion may use fractional world coordinates. Bitmap source pixels remain integer and nearest-neighbor.
- Particles retain their 4×4 square form. Weather retains current sizes and biome colors. Debris retains square geometry and rotation.

## Category rules

- **Player, ally, rival:** use the battle/heavy/scout masks and faction/quad variants registered in the manifest.
- **Monsters:** use their existing masks and colors. Commando and stalker intentionally reuse the soldier mask.
- **Bosses:** preserve mantis, fortress, and eye masks, colors, bounds, rage/freeze/hit variants, and gameplay behavior.
- **Projectiles:** preserve gameplay dimensions. Laser keeps rotation, additive blend, and white half-height core.
- **Modules and pickups:** preserve the 24 px colored core, 34 px half-alpha aura, and current glyph/color mapping. Turret and gravity visuals retain their current geometry.
- **Obstacles:** preserve tree, house, wall, water, trunk, and biome color behavior.
- **Background:** preserve biome flat fills, 100 px cyan grid, red world boundary, darkness overlays, and screen effects.
- **HUD:** remains DOM/CSS. Generated CSS and JavaScript tokens share palette and rhythm values from the art contract.

## Tiles

Standardized biome ground tiles are 16×16 native masks with Wang/WFC edge sockets. Every edge declares a terrain socket in clockwise `north/east/south/west` order. Adjacent edges must match exactly. The Phase 0 ground tiles are flat and self-compatible, matching the current flat biome backgrounds.

## Change control

Any new runtime visual requires:

1. A registered visual ID and category.
2. Palette, dimensions, anchor, and nearest-neighbor compliance.
3. Deterministic generation hash when bitmap data is generated.
4. Edge metadata and seam validation for tiles.
5. A central renderer path; gameplay modules must not add ad-hoc Canvas drawing primitives.
