import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/config/balance.js';
import { shieldRingRadius } from '../src/combat/shield.js';

test('shield ring clears a 32px sprite to the mech ring radius', () => {
    assert.equal(BALANCE.SHIELD.ringPadding, 12);
    assert.equal(shieldRingRadius(32, 32), 28);
});

test('shield ring uses the larger axis plus padding', () => {
    assert.equal(shieldRingRadius(48, 32), 24 + BALANCE.SHIELD.ringPadding);
    assert.equal(shieldRingRadius(32, 64), 32 + BALANCE.SHIELD.ringPadding);
});
