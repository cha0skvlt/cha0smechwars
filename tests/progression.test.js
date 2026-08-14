import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addXp,
    applyUpgrade,
    grantAiProgress,
    initializeProgression,
    isUpgradeAvailable,
    isPlayerKillCredit,
    killReward,
    progressionOwner,
    rollUpgradeChoices,
    xpForNextLevel,
} from '../src/progression/progression.js';

function makePlayer(overrides={}) {
    return {
        level: 1,
        xp: 0,
        perks: {},
        hp: 10,
        maxHp: 10,
        shield: 0,
        maxShield: 6,
        shieldRegenRate: 180,
        critChance: 0.1,
        fireRateMult: 1,
        spd: 4,
        fuel: 100,
        maxFuel: 100,
        baseMaxFuel: 100,
        isHumanPlayer: true,
        isBot: false,
        faction: 'player',
        ownsProgression: true,
        ...overrides,
    };
}

test('level thresholds grow linearly', () => {
    assert.equal(xpForNextLevel(1), 26);
    assert.equal(xpForNextLevel(2), 39);
    assert.equal(xpForNextLevel(3), 52);
});

test('one XP reward can cross multiple levels and retain overflow', () => {
    const player = makePlayer();

    const levelsGained = addXp(player, 122);

    assert.equal(levelsGained, 3);
    assert.equal(player.level, 4);
    assert.equal(player.xp, 5);
});

test('kill reward is the enemy scaled max HP rounded to whole XP', () => {
    assert.equal(killReward(2), 2);
    assert.equal(killReward(2.2), 3);
});

test('kill credit rejects bot and missing attackers', () => {
    const player = { isHumanPlayer: true, isBot: false, faction: 'player' };
    const bot = { isHumanPlayer: false, isBot: true, faction: 'rival' };
    const playerTurret = { faction: 'player', grantsPlayerKillCredit: true, owner: player };
    const botTurret = { faction: 'rival', grantsPlayerKillCredit: false, owner: bot };

    assert.equal(isPlayerKillCredit(player, player), true);
    assert.equal(isPlayerKillCredit(playerTurret, player), true);
    assert.equal(isPlayerKillCredit(bot, player), false);
    assert.equal(isPlayerKillCredit(botTurret, player), false);
    assert.equal(isPlayerKillCredit({ faction: 'rival', grantsPlayerKillCredit: true }, player), false);
    assert.equal(isPlayerKillCredit(null, player), false);
    assert.equal(isPlayerKillCredit(undefined, player), false);
});

test('upgrade roll returns three unique available choices', () => {
    const choices = rollUpgradeChoices(makePlayer(), () => 0);

    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
});

test('common upgrades modify their canonical player stats', () => {
    const player = makePlayer();

    applyUpgrade(player, 'targetingMatrix');
    applyUpgrade(player, 'shieldCycler');
    applyUpgrade(player, 'reinforcedFrame');
    applyUpgrade(player, 'overclockedFeed');
    applyUpgrade(player, 'servoBoost');
    applyUpgrade(player, 'auxiliaryTank');

    assert.ok(Math.abs(player.critChance - 0.15) < Number.EPSILON);
    assert.equal(player.shieldRegenRate, 165);
    assert.equal(player.maxHp, 12);
    assert.equal(player.hp, 12);
    assert.ok(Math.abs(player.fireRateMult - 0.92) < Number.EPSILON);
    assert.equal(player.spd, 4.25);
    assert.equal(player.maxFuel, 115);
    assert.equal(player.fuel, 115);
});

test('capped upgrades stop at their canonical limits', () => {
    const player = makePlayer();

    for(let i=0; i<20; i++) {
        applyUpgrade(player, 'targetingMatrix');
        applyUpgrade(player, 'shieldCycler');
        applyUpgrade(player, 'overclockedFeed');
    }

    assert.equal(player.critChance, 0.5);
    assert.equal(player.shieldRegenRate, 60);
    assert.equal(player.fireRateMult, 0.55);
});

test('rare upgrades apply both combined effects', () => {
    const player = makePlayer();

    applyUpgrade(player, 'assaultCore');
    applyUpgrade(player, 'reactorMatrix');
    applyUpgrade(player, 'predatorProtocol');

    assert.equal(player.maxHp, 12);
    assert.equal(player.hp, 12);
    assert.equal(player.spd, 4.25);
    assert.equal(player.shieldRegenRate, 165);
    assert.equal(player.maxFuel, 115);
    assert.equal(player.fuel, 115);
    assert.ok(Math.abs(player.critChance - 0.15) < Number.EPSILON);
    assert.ok(Math.abs(player.fireRateMult - 0.92) < Number.EPSILON);
});

test('naniteSurge FULL ARMOR restores armor pool and shield instantly', () => {
    const player = makePlayer({ hp: 3, shield: 1, maxHp: 12, maxShield: 6 });

    applyUpgrade(player, 'naniteSurge');

    assert.equal(player.hp, 12);
    assert.equal(player.shield, 6);
    assert.equal(player.perks.naniteSurge, 1);
});

test('AI gains personal XP and auto-selects an available perk', () => {
    const ai = makePlayer({ isHumanPlayer: false, isBot: true, faction: 'rival' });

    const result = grantAiProgress(ai, 26, () => 0);

    assert.equal(ai.level, 2);
    assert.equal(ai.xp, 0);
    assert.equal(result.levelsGained, 1);
    assert.equal(result.upgrades.length, 1);
    assert.equal(ai.perks[result.upgrades[0]], 1);
});

test('deployable progression resolves to its owning mech', () => {
    const mech = makePlayer({ isHumanPlayer: false, isBot: true, faction: 'player' });
    const turret = { faction: 'player', owner: mech };
    const human = makePlayer();
    mech.owner = human;

    assert.equal(progressionOwner(turret), mech);
    assert.equal(progressionOwner(mech), mech);
});

test('fresh mech progression starts at level one after replacement', () => {
    const replacement = initializeProgression({
        level: 9,
        xp: 999,
        perks: { assaultCore: 4 },
    });

    assert.equal(replacement.level, 1);
    assert.equal(replacement.xp, 0);
    assert.deepEqual(replacement.perks, {});
});
