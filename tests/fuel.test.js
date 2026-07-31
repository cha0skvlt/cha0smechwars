import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { consumeFuel, regenerateFuel } from '../src/entities/fuel.js';

test('heavy uses the common fuel pool and canonical dash values', () => {
    const heavy = BALANCE.MECHS.heavy;

    assert.equal(heavy.fuel, 100);
    assert.equal(heavy.maxFuel, 100);
    assert.equal(heavy.dashCost, 40);
    assert.equal(heavy.fuelRegen, 0.5);
});

test('heavy can dash twice, rejects a third dash, and regenerates fuel', () => {
    const heavy = BALANCE.MECHS.heavy;
    const state = { fuel: heavy.fuel, maxFuel: heavy.maxFuel };

    assert.equal(consumeFuel(state, heavy.dashCost), true);
    assert.equal(state.fuel, 60);
    assert.equal(consumeFuel(state, heavy.dashCost), true);
    assert.equal(state.fuel, 20);
    assert.equal(consumeFuel(state, heavy.dashCost), false);
    assert.equal(state.fuel, 20);

    regenerateFuel(state, heavy.fuelRegen);
    assert.equal(state.fuel, 20.5);
});

test('fuel regeneration respects upgraded maxFuel', () => {
    const state = { fuel: 114.75, maxFuel: 115 };

    regenerateFuel(state, BALANCE.MECHS.heavy.fuelRegen);

    assert.equal(state.fuel, 115);
});
