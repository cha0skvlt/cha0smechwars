import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
    cellularMask,
    forgeAsset,
    normalizeHex,
    orphanPixels,
    validateTileEdges,
} from '../src/render/pixelForgeCore.js';
import { BITMAP_ASSETS, RUNTIME_VISUAL_IDS, TILE_ASSETS, VISUALS } from '../src/render/visualManifest.js';

const root = resolve(import.meta.dirname, '..');
const contract = JSON.parse(await readFile(join(root, 'art/pixel-style.json'), 'utf8'));
const generated = JSON.parse(await readFile(join(root, 'art/generated/pixel-manifest.generated.json'), 'utf8'));

async function sourceFiles(directory) {
    const result = [];
    for(const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if(entry.isDirectory()) result.push(...await sourceFiles(path));
        else if(entry.isFile() && path.endsWith('.js')) result.push(path);
    }
    return result;
}

test('every runtime visual ID is unique, registered, anchored, and nearest-neighbor', () => {
    assert.equal(new Set(RUNTIME_VISUAL_IDS).size, RUNTIME_VISUAL_IDS.length);
    for(const id of RUNTIME_VISUAL_IDS) {
        const visual = VISUALS[id];
        assert.ok(visual, `${id} is registered`);
        assert.equal(visual.nearestNeighbor, true, `${id} requires nearest-neighbor rendering`);
        assert.equal(visual.anchor.length, 2);
        assert.ok(visual.anchor.every(value => value >= 0 && value <= 1));
    }
});

test('runtime variant matrix has complete actor, enemy, boss, pickup, and environment coverage', () => {
    const expected = [
        ...['battle', 'heavy', 'scout'].flatMap(name => [
            `sprite.player.${name}`,
            `sprite.player.${name}.quad`,
            `sprite.rival.${name}`,
        ]),
        ...['zombie', 'gunner', 'shotman', 'tank', 'commando', 'stalker', 'sniper', 'mantis', 'fortress', 'eye']
            .flatMap(name => [`sprite.enemy.${name}`, `sprite.enemy.${name}.hit`, `sprite.enemy.${name}.freeze`]),
        ...['shotgun', 'mg', 'rpg', 'laser', 'repair', 'quad', 'freeze', 'mine', 'shield', 'turret', 'warp', 'emp', 'grav', 'overclock']
            .map(name => `pickup.${name}`),
        'sprite.module.turret',
        'module.gravity.well',
        'sprite.obstacle.tree',
        'sprite.obstacle.wall.ruins',
        'sprite.obstacle.wall.dungeon',
        'obstacle.house',
        'obstacle.water',
        'shadow.ground',
        'effect.particle',
        'effect.debris',
        'effect.decal',
        'effect.weather.forest',
        'effect.weather.ruins',
        'effect.weather.dungeon',
        'background.biome',
        'background.map',
        'background.grid',
        'hud.boss',
        'hud.combo',
    ];
    for(const id of expected) assert.ok(VISUALS[id], `${id} is covered`);
});

test('generated assets are deterministic, palette-safe, binary-alpha, and dimension-safe', () => {
    const allowed = new Set(Object.values(contract.palette).map(normalizeHex));
    const generatedById = new Map(generated.assets.map(asset => [asset.id, asset]));
    for(const recipe of BITMAP_ASSETS) {
        const first = forgeAsset(recipe);
        const second = forgeAsset(recipe);
        assert.equal(first.hash, second.hash, `${recipe.id} hash is deterministic`);
        assert.equal(first.hash, generatedById.get(recipe.id)?.hash, `${recipe.id} hash matches checked-in output`);
        assert.equal(first.width, recipe.width);
        assert.equal(first.height, recipe.height);
        for(const color of Object.values(recipe.semanticColors)) assert.ok(allowed.has(normalizeHex(color)));
        for(let index = 3; index < first.pixels.length; index += 4) {
            assert.ok(first.pixels[index] === 0 || first.pixels[index] === 255, `${recipe.id} alpha is binary`);
        }
        if(recipe.noOrphans) assert.deepEqual(orphanPixels(first), [], `${recipe.id} has no orphan pixels`);
    }
});

test('semantic masks support explicit outline and shading passes', () => {
    const asset = forgeAsset({
        id: 'test.semantic',
        width: 5,
        height: 5,
        anchor: [0.5, 1],
        mask: {
            rows: ['.....', '.....', '..B..', '.....', '.....'],
            semanticMap: { '.': '.', B: 'base' },
        },
        semanticColors: { base: '#ffffff', outline: '#000000', shade: '#888888' },
        outline: { semantic: 'outline' },
        shading: { semantic: 'shade', fromSemantic: 'base', every: 2 },
    });
    assert.equal(asset.grid[2][1], 'outline');
    assert.equal(asset.grid[1][2], 'outline');
    assert.ok(['base', 'shade'].includes(asset.grid[2][2]));
});

test('cellular organic masks are seeded and deterministic', () => {
    const options = { width: 16, height: 16, seed: 'decal-a', fillProbability: 0.42, steps: 2 };
    assert.deepEqual(cellularMask(options), cellularMask(options));
    assert.notDeepEqual(cellularMask(options), cellularMask({ ...options, seed: 'decal-b' }));
});

test('Wang and WFC tile metadata has valid seamless adjacency', () => {
    assert.deepEqual(validateTileEdges(TILE_ASSETS), []);
    for(const tile of TILE_ASSETS) {
        assert.deepEqual(tile.wfc.rotations, [0]);
        assert.equal(tile.width, 16);
        assert.equal(tile.height, 16);
        assert.equal(tile.adjacent.length, 4);
    }
});

test('central renderer gate blocks ad-hoc Canvas visuals in gameplay modules', async () => {
    const forbidden = /\.(?:fillRect|strokeRect|clearRect|drawImage|fillText|strokeText|arc|ellipse|createLinearGradient)\s*\(|\.(?:fillStyle|strokeStyle)\s*=/;
    const violations = [];
    for(const path of await sourceFiles(join(root, 'src'))) {
        if(path.includes(`${join('src', 'render')}/`)) continue;
        const lines = (await readFile(path, 'utf8')).split('\n');
        lines.forEach((line, index) => {
            if(forbidden.test(line)) violations.push(`${path}:${index + 1}`);
        });
    }
    assert.deepEqual(violations, []);
});

test('runtime and CSS enforce nearest-neighbor policy', async () => {
    const runtime = await readFile(join(root, 'src/core/runtime.js'), 'utf8');
    const css = await readFile(join(root, 'src/style.css'), 'utf8');
    assert.match(runtime, /imageSmoothingEnabled\s*=\s*false/);
    assert.match(css, /image-rendering:\s*pixelated/);
});
