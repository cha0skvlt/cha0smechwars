import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BALANCE } from '../src/config/balance.js';
import { botTargetCandidates, formationSlotTarget, ownerFollowState, wingIndexOf } from '../src/entities/botTactics.js';
import { randomMechClass, randomLanceComposition } from '../src/entities/mechLifecycle.js';

function mech(faction, x=0, y=0) {
    return {
        faction,
        x,
        y,
        w: 32,
        h: 32,
        hp: 10,
        flying: false,
        center() { return { x: this.x + 16, y: this.y + 16 }; },
    };
}

test('ally and rival AI select only hostile factions', () => {
    const player = mech('player');
    const ally = mech('player');
    const rivalA = mech('rival');
    const rivalB = mech('rival');
    const enemy = mech('enemy');

    assert.deepEqual(botTargetCandidates(ally, [player, ally, rivalA, enemy]), [rivalA, enemy]);
    assert.deepEqual(botTargetCandidates(rivalA, [player, ally, rivalA, rivalB, enemy]), [player, ally, enemy]);
});

test('formation slot 0 is the leader; wing slots trail behind the leader facing', () => {
    const leader = { x: 100, y: 100, facing: 0 };

    assert.deepEqual(formationSlotTarget(leader, 0), { x: 100, y: 100 });

    const left = formationSlotTarget(leader, 1);
    const right = formationSlotTarget(leader, 2);
    const spacing = BALANCE.LANCE.triangleSpacing;

    // Facing 0 (east): both wings trail west of the leader, splayed to opposite sides of it.
    assert.ok(left.x < leader.x);
    assert.ok(right.x < leader.x);
    assert.ok((left.y - leader.y) * (right.y - leader.y) < 0); // opposite sides of the centerline
    const distLeft = Math.hypot(left.x - leader.x, left.y - leader.y);
    const distRight = Math.hypot(right.x - leader.x, right.y - leader.y);
    assert.ok(Math.abs(distLeft - spacing) < 1e-9);
    assert.ok(Math.abs(distRight - spacing) < 1e-9);
});

test('wing mech follow state becomes mandatory beyond the leash', () => {
    const leader = { x: 0, y: 0, facing: 0 };
    const slotTarget = formationSlotTarget(leader, 1);
    const near = mech('player', slotTarget.x, slotTarget.y);
    const following = mech('player', slotTarget.x + Math.sqrt(BALANCE.LANCE.followRadiusSq) + 1, slotTarget.y);
    const leashed = mech('player', slotTarget.x + Math.sqrt(BALANCE.LANCE.leashRadiusSq) + 1, slotTarget.y);

    assert.equal(ownerFollowState(near, slotTarget).shouldFollow, false);
    assert.equal(ownerFollowState(following, slotTarget).shouldFollow, true);
    assert.equal(ownerFollowState(following, slotTarget).mustFollow, false);
    assert.equal(ownerFollowState(leashed, slotTarget).mustFollow, true);
    assert.ok(ownerFollowState(leashed, slotTarget).vector.x < 0);
});

test('Formation Tactics (tight=true) uses the tighter lock-step radii', () => {
    const leader = { x: 0, y: 0, facing: 0 };
    const slotTarget = formationSlotTarget(leader, 1);
    const softDist = Math.sqrt(BALANCE.LANCE.tightFollowRadiusSq) + 5;
    const wingMech = mech('player', slotTarget.x + softDist, slotTarget.y);

    assert.equal(ownerFollowState(wingMech, slotTarget, false).shouldFollow, false);
    assert.equal(ownerFollowState(wingMech, slotTarget, true).shouldFollow, true);
});

test('wing role is derived from current leadership, not a mech\'s fixed construction slot', () => {
    const m0 = { ...mech('player'), lanceSlot: 0 };
    const m1 = { ...mech('player'), lanceSlot: 1 };
    const m2 = { ...mech('player'), lanceSlot: 2 };
    const lance = [m0, m1, m2];

    // Initial leader is m0 (slot 0, matches C's default activeSlot=0): m1/m2 keep their natural roles.
    assert.equal(wingIndexOf(m1, lance, m0), 1);
    assert.equal(wingIndexOf(m2, lance, m0), 2);

    // Player switches control to m1 ([C]) - m1 is now the leader. m0 must NOT keep asking for
    // slotIndex 0 (the leader's exact position, offset zero) - it needs a real wing role.
    assert.equal(wingIndexOf(m0, lance, m1), 1);
    assert.equal(wingIndexOf(m2, lance, m1), 2);

    // Switch again to m2 as leader - m0 and m1 both get real (and distinct) wing roles.
    const roleOf0 = wingIndexOf(m0, lance, m2);
    const roleOf1 = wingIndexOf(m1, lance, m2);
    assert.notEqual(roleOf0, roleOf1);
    assert.ok([1, 2].includes(roleOf0) && [1, 2].includes(roleOf1));
});

test('rival lance composition is always 3 equiprobable class rolls', () => {
    assert.deepEqual(randomLanceComposition(() => 0), ['battle', 'battle', 'battle']);
    assert.deepEqual(randomLanceComposition(() => 0.999999), ['scout', 'scout', 'scout']);
    assert.equal(randomMechClass(() => 0), 'battle');
    assert.equal(randomMechClass(() => 0.999999), 'scout');
});

test('Game.js drives combat through fixed 3-mech lances, not a bot singleton', () => {
    const source = fs.readFileSync(new URL('../src/game/Game.js', import.meta.url), 'utf8');

    assert.doesNotMatch(source, /\b(?:this|Game)\.bot\b/);
    assert.doesNotMatch(source, /if\s*\(\s*b\.(?:bot|enemy)\s*\)/);
    assert.match(source, /playerLance:\s*\[\],\s*rivalLance:\s*\[\]/);
    assert.match(source, /prepareMission/);
    assert.match(source, /switchControl/);
    assert.match(source, /purchaseRivalLoadout/);
});
