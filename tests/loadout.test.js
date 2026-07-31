import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { BALANCE } from '../src/config/balance.js';
import { weaponDamage } from '../src/combat/damage.js';

async function sourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(entries.map(entry => {
        const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        return entry.isDirectory() ? sourceFiles(path) : [path];
    }));
    return files.flat();
}

test('shotman owns the six-pellet shotgun loadout at 45 frame cooldown', () => {
    const shotman = BALANCE.ENEMIES.shotman;

    assert.deepEqual(shotman.weapons, ['shotgun']);
    assert.equal(shotman.pellets, 6);
    assert.equal(shotman.aiCd, 45);
    assert.equal(weaponDamage('shotgun', 1), 1);
});

test('tank always uses the canonical RPG loadout', () => {
    const tank = BALANCE.ENEMIES.tank;
    const rpg = BALANCE.WEAPONS.rpg;

    assert.deepEqual(tank.weapons, ['rpg']);
    assert.equal(rpg.damage, 3);
    assert.deepEqual(rpg.splash, {
        close: 2,
        mid: 1,
        far: 1,
        rClose: 30,
        rMid: 50,
        rBase: 80,
        rL3: 120,
    });
});

test('retired enemy identifier is absent from source', async () => {
    const root = new URL('../src/', import.meta.url);
    const files = await sourceFiles(root);
    const contents = await Promise.all(files.map(file => readFile(file, 'utf8')));

    assert.equal(contents.some(content => content.toLowerCase().includes('rocketman')), false);
});
