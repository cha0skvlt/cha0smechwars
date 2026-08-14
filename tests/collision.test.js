import test from 'node:test';
import assert from 'node:assert/strict';
import { separationPush } from '../src/combat/collision.js';

test('bodies far enough apart do not get pushed', () => {
    const result = separationPush(0, 0, 16, 100, 0, 16);
    assert.equal(result, null);
});

test('bodies on the exact same point return null instead of NaN', () => {
    const result = separationPush(5, 5, 16, 5, 5, 16);
    assert.equal(result, null);
});

test('overlapping same-size bodies push A directly away from B, scaled by mult', () => {
    const result = separationPush(10, 0, 16, 0, 0, 16, 0, 1.5);
    assert.ok(result);
    assert.equal(result.y, 0);
    assert.equal(result.x, 1.5); // unit vector (1,0) * mult
});

test('padding widens the threshold beyond the raw half-width sum', () => {
    const dist = 35; // beyond two 16-half bodies just touching (32) but inside a padded 40 threshold
    const withoutPad = separationPush(dist, 0, 16, 0, 0, 16, 0);
    const withPad = separationPush(dist, 0, 16, 0, 0, 16, 8);
    assert.equal(withoutPad, null);
    assert.ok(withPad);
});

test('a large body (boss-size) widens the separation threshold accordingly', () => {
    const dist = 40; // mech (half 16) vs a same-size enemy (half 16) would not separate here
    const vsSameSize = separationPush(dist, 0, 16, 0, 0, 16);
    const vsBoss = separationPush(dist, 0, 16, 0, 0, 32); // fortress-sized enemy, half 32
    assert.equal(vsSameSize, null);
    assert.ok(vsBoss);
});
