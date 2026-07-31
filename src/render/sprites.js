import { BASE_MASKS } from './visualManifest.js';

// Compatibility export for gameplay code that still inspects source masks.
export const Sprites = Object.freeze({
    ...BASE_MASKS,
    wall_ruin: BASE_MASKS.wallRuin,
    wall_cave: BASE_MASKS.wallCave,
});
