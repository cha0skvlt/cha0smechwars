export const BASE_MASKS = Object.freeze({
    soldier: ["00111100","01111110","01001110","11111111","11011011","10011001","00100100","00100100"],
    heavy: ["00111100","01111110","11111111","11111111","11011011","10011001","11000011","11000011"],
    scout: ["00011000","01111110","11011011","00111100","00111100","01011010","10000001","10000001"],
    zombie: ["00011100","00101010","01111111","10111110","00111110","00100100","00100100","00100100"],
    gunner: ["00111100","01100110","01111110","11111111","01111110","00100100","01000010","10000001"],
    shotman: ["00111100","00111100","01111110","11111111","10111101","10011001","00100100","00100100"],
    sniper: ["00011000","00011000","00111100","01111110","00011000","00100100","00100100","10000001"],
    tank: ["0011111100","0111111110","1110110111","1111111111","1011111101","1011001101","1111001111","1100000011"],
    mantis: ["00100000100","01100000110","11100000111","00111111100","00111011100","01111111110","11101110111","10001110001","10001010001","11001010011"],
    fortress: ["111111111111","110111111011","110111111011","111111111111","111001100111","111111111111","101111111101","101100001101","111100001111","111111111111"],
    eye: ["000011110000","001111111100","011100001110","111001100111","111001100111","111000000111","111111111111","011111111110","001111111100","000100001000","000100001000","001100001100"],
    tree: ["00111100","01111110","11111111","01111110","00011000","00011000","00011000","00111100"],
    box: ["11111111","10000001","10111101","10111101","10111101","10111101","10000001","11111111"],
    wallRuin: ["1111111111111111","1100001110000011","1100001110000011","1111111111111111","1100000000000011","1100001100000011","1111111111111111","1100001110000011","1100001110000011","1111111111111111","1100000000000011","1100000000000011","1111111111111111","1100001110000011","1100001110000011","1111111111111111"],
    wallCave: ["0011111111111000","0111111111111100","1111111111111110","1111001111111111","1111001111111111","1111111111100111","1111111111100111","1110011111111111","1110011111111111","1111111111111111","1111111001111111","1111111001111111","1111111111111110","0111111111111100","0011111111111000","0001111111110000"],
    turret: ["00011000","00111100","01011010","11111111","10011001","10000001","00000000","00000000"],
});

const binaryMask = rows => ({
    rows,
    semanticMap: { '0': '.', '1': 'base' },
});

const bitmap = (id, mask, color, category, options = {}) => Object.freeze({
    id,
    kind: 'bitmap',
    category,
    width: mask[0].length,
    height: mask.length,
    anchor: options.anchor || [0.5, 1],
    mask: binaryMask(mask),
    semanticColors: { base: color },
    outline: options.outline || null,
    shading: options.shading || null,
    noOrphans: options.noOrphans !== false,
    nearestNeighbor: true,
});

const bitmapAssets = [
    bitmap('sprite.player.battle', BASE_MASKS.soldier, '#00eaff', 'actor'),
    bitmap('sprite.player.battle.quad', BASE_MASKS.soldier, '#ff00ff', 'actor'),
    bitmap('sprite.player.heavy', BASE_MASKS.heavy, '#00eaff', 'actor'),
    bitmap('sprite.player.heavy.quad', BASE_MASKS.heavy, '#ff00ff', 'actor'),
    bitmap('sprite.player.scout', BASE_MASKS.scout, '#00eaff', 'actor'),
    bitmap('sprite.player.scout.quad', BASE_MASKS.scout, '#ff00ff', 'actor'),
    bitmap('sprite.rival.battle', BASE_MASKS.soldier, '#ff0000', 'actor'),
    bitmap('sprite.rival.heavy', BASE_MASKS.heavy, '#ff0000', 'actor'),
    bitmap('sprite.rival.scout', BASE_MASKS.scout, '#ff0000', 'actor'),
];

const enemies = [
    ['zombie', BASE_MASKS.zombie, '#55bb55'],
    ['gunner', BASE_MASKS.gunner, '#eebb22'],
    ['shotman', BASE_MASKS.shotman, '#ff6600'],
    ['tank', BASE_MASKS.tank, '#668844'],
    ['commando', BASE_MASKS.soldier, '#222222'],
    ['stalker', BASE_MASKS.soldier, '#dd4444'],
    ['sniper', BASE_MASKS.sniper, '#ffffff'],
    ['mantis', BASE_MASKS.mantis, '#55ff55'],
    ['fortress', BASE_MASKS.fortress, '#888899'],
    ['eye', BASE_MASKS.eye, '#aa00ff'],
];

for(const [name, mask, color] of enemies) {
    const category = ['mantis', 'fortress', 'eye'].includes(name) ? 'boss' : 'actor';
    const options = { noOrphans: name !== 'sniper' };
    bitmapAssets.push(
        bitmap(`sprite.enemy.${name}`, mask, color, category, options),
        bitmap(`sprite.enemy.${name}.hit`, mask, '#ffffff', category, options),
        bitmap(`sprite.enemy.${name}.freeze`, mask, '#6600ff', category, options),
    );
}

bitmapAssets.push(
    bitmap('sprite.obstacle.tree', BASE_MASKS.tree, '#22dd66', 'prop'),
    bitmap('sprite.obstacle.box', BASE_MASKS.box, '#ffffff', 'prop'),
    bitmap('sprite.obstacle.wall.ruins', BASE_MASKS.wallRuin, '#776666', 'structure', { anchor: [0.5, 1] }),
    bitmap('sprite.obstacle.wall.dungeon', BASE_MASKS.wallCave, '#554444', 'structure', { anchor: [0.5, 1] }),
    bitmap('sprite.module.turret', BASE_MASKS.turret, '#00eaff', 'module'),
);

bitmapAssets.push(Object.freeze({
    id: 'effect.decal.organic',
    kind: 'bitmap',
    category: 'effect',
    width: 16,
    height: 16,
    anchor: [0.5, 1],
    nearestNeighbor: true,
    noOrphans: false,
    mask: {
        type: 'cellular',
        width: 16,
        height: 16,
        seed: 'cmw-phase0-decal',
        fillProbability: 0.42,
        steps: 2,
        semanticMap: { '0': '.', '1': 'base', '.': '.' },
    },
    semanticColors: { base: '#aa0000' },
    outline: null,
    shading: null,
}));

const solidTile = (id, color, socket) => Object.freeze({
    ...bitmap(id, Array(16).fill('1'.repeat(16)), color, 'tile', { anchor: [0, 0] }),
    wang: { north: socket, east: socket, south: socket, west: socket },
    wfc: { weight: 1, rotations: [0] },
    adjacent: [
        { direction: 'north', id },
        { direction: 'east', id },
        { direction: 'south', id },
        { direction: 'west', id },
    ],
});

const tiles = [
    solidTile('tile.ground.forest', '#051005', 'forest-ground'),
    solidTile('tile.ground.ruins', '#101520', 'ruins-ground'),
    solidTile('tile.ground.dungeon', '#1a0505', 'dungeon-ground'),
];
bitmapAssets.push(...tiles);

const dynamic = [
    ['shadow.ground', 'shadow', 'effect'],
    ['effect.shield.player', 'ring', 'effect'],
    ['effect.shield.rival', 'ring', 'effect'],
    ['effect.shield.enemy', 'ring', 'effect'],
    ['effect.dash.echo', 'sprite-effect', 'effect'],
    ['effect.overclock', 'overlay', 'effect'],
    ['effect.mantis.rage', 'sprite-effect', 'effect'],
    ['effect.damage.smoke', 'radial', 'effect'],
    ['projectile.bullet', 'projectile', 'projectile'],
    ['projectile.laser', 'projectile', 'projectile'],
    ['effect.turret.flash', 'overlay', 'effect'],
    ['module.gravity.well', 'radial', 'module'],
    ['obstacle.tree.trunk', 'primitive', 'prop'],
    ['obstacle.house', 'primitive', 'structure'],
    ['obstacle.water', 'primitive', 'tile'],
    ['effect.particle', 'primitive', 'effect'],
    ['effect.debris', 'primitive', 'effect'],
    ['effect.weather.forest', 'primitive', 'effect'],
    ['effect.weather.ruins', 'primitive', 'effect'],
    ['effect.weather.dungeon', 'primitive', 'effect'],
    ['effect.shockwave', 'ring', 'effect'],
    ['effect.floater', 'text', 'effect'],
    ['effect.decal', 'organic', 'effect'],
    ['background.biome', 'background', 'background'],
    ['background.map', 'background', 'background'],
    ['background.grid', 'background', 'background'],
    ['background.darkness', 'overlay', 'background'],
    ['background.warp', 'overlay', 'background'],
    ['background.death', 'overlay', 'background'],
    ['hud.boss', 'hud', 'hud'],
    ['hud.combo', 'hud', 'hud'],
    ['pickup.shotgun', 'pickup', 'pickup'],
    ['pickup.mg', 'pickup', 'pickup'],
    ['pickup.rpg', 'pickup', 'pickup'],
    ['pickup.laser', 'pickup', 'pickup'],
    ['pickup.repair', 'pickup', 'pickup'],
    ['pickup.quad', 'pickup', 'pickup'],
    ['pickup.freeze', 'pickup', 'pickup'],
    ['pickup.mine', 'pickup', 'pickup'],
    ['pickup.shield', 'pickup', 'pickup'],
    ['pickup.turret', 'pickup', 'pickup'],
    ['pickup.warp', 'pickup', 'pickup'],
    ['pickup.emp', 'pickup', 'pickup'],
    ['pickup.grav', 'pickup', 'pickup'],
    ['pickup.overclock', 'pickup', 'pickup'],
].map(([id, kind, category]) => Object.freeze({
    id,
    kind,
    category,
    nearestNeighbor: true,
    anchor: kind === 'hud' || category === 'background' ? [0, 0] : [0.5, 0.5],
}));

export const BITMAP_ASSETS = Object.freeze(bitmapAssets);
export const TILE_ASSETS = Object.freeze(tiles);
export const VISUALS = Object.freeze(Object.fromEntries([...bitmapAssets, ...dynamic].map(entry => [entry.id, entry])));
export const RUNTIME_VISUAL_IDS = Object.freeze(Object.keys(VISUALS).sort());

export function getVisual(id) {
    const visual = VISUALS[id];
    if(!visual) throw new Error(`Unknown visual ID: ${id}`);
    return visual;
}
