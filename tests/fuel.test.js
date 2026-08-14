import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { regenerateFuel } from '../src/entities/fuel.js';

test('heavy uses the common fuel pool and canonical Juggernaut Dash values', () => {
    const heavy = BALANCE.MECHS.heavy;

    assert.equal(heavy.fuel, 100);
    assert.equal(heavy.maxFuel, 100);
    assert.equal(heavy.dashSpeed, 10);
    assert.equal(heavy.dashFuelDrain, 1.5);
    assert.equal(heavy.dashPostInv, 12);
    assert.equal(heavy.dashKnockback, 30);
    assert.equal(heavy.fuelRegen, 0.5);
});

test('Juggernaut Dash drains fuel per frame while held and regenerates once released', () => {
    const heavy = BALANCE.MECHS.heavy;
    const state = { fuel: heavy.fuel, maxFuel: heavy.maxFuel };

    // Held dash: fuel drains every tick instead of a single fixed cost.
    let ticks = 0;
    while(state.fuel > 0 && ticks < 200) {
        state.fuel = Math.max(0, state.fuel - heavy.dashFuelDrain);
        ticks++;
    }
    assert.equal(state.fuel, 0);
    assert.equal(ticks, Math.ceil(heavy.fuel / heavy.dashFuelDrain));

    regenerateFuel(state, heavy.fuelRegen);
    assert.equal(state.fuel, 0.5);
});

test('fuel regeneration respects upgraded maxFuel', () => {
    const state = { fuel: 114.75, maxFuel: 115 };

    regenerateFuel(state, BALANCE.MECHS.heavy.fuelRegen);

    assert.equal(state.fuel, 115);
});
