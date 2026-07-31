// Unified Damage Unit (DU): 1 HP = 1 Shield = 1 Damage
// All combat numbers live here. Readers must not hardcode DU literals.
// One physics for player, bot, and monsters — same WEAPONS table.

export const BALANCE = {
    UNIT: 1,

    // Shields as a phenomenon — one regen interval for player and monsters
    SHIELD: {
        regenRate: 180, // frames between +1 DU while shield > 0 && shield < maxShield
        // Outer ring clearance: max(w,h)/2 + padding (32px mob → 28, matches mech ring)
        ringPadding: 12,
    },

    WEAPONS: {
        pistol:  { damage: 1, speed: 15, baseCd: 18, minCd: 5, size: 6, sizeH: 6 },
        shotgun: { damage: 1, speed: 15, baseCd: 45, minCd: 20, size: 6, sizeH: 6,
                   pelletsBase: 5, spreadL2: 0.48, spreadL1: 0.8, explodeRadiusL3: 30 },
        mg:      { damage: 1, speed: 15, baseCd: 6,  minCd: 2, size: 6, sizeH: 6, speedMultL3: 1.5 },
        laser:   { damage: 2, speed: 30, baseCd: 50, minCd: 30, size: 30, sizeH: 2, sizeL3: 45, sizeHL3: 3 },
        rpg:     { damage: 3, speed: 8,  baseCd: 80, minCd: 40, size: 8, sizeH: 8,
                   splash: { close: 2, mid: 1, far: 1, rClose: 30, rMid: 50, rBase: 80, rL3: 120 },
                   // Softer screen punch + quieter launch/boom than legacy 12/15 shake + 0.3/0.5 vol
                   feel: {
                       fireKick: 4,
                       fireShake: 5,
                       explodeShake: 6,
                       explodeShakeBot: 3,
                       explodeTrauma: 0.12,
                       shootToneVol: 0.12,
                       shootNoiseVol: 0.1,
                       shootToneDur: 0.22,
                       shootNoiseDur: 0.15,
                       boomNoiseVol: 0.22,
                       boomToneVol: 0.08,
                       boomNoiseDur: 0.32,
                       boomToneDur: 0.35,
                   } },
    },

    BULLET_LIFE: 100,

    MECHS: {
        battle: {
            hp: 12, shield: 6, spd: 4.5,
            fuel: 100, maxFuel: 100, canFly: true, jetMult: 1.5,
            fuelRefillThreshold: 20, fuelRegen: 0.5, fuelDrain: 1.0,
        },
        heavy: {
            hp: 18, shield: 12, spd: 3.5,
            fuel: 100, maxFuel: 100, canFly: false, jetMult: 1,
            dashCost: 40, dashSpeed: 10, dashDuration: 8, dashInv: 12, dashKnockback: 30,
            fuelRegen: 0.5,
        },
        scout: {
            hp: 10, shield: 4, spd: 5.0,
            fuel: 300, maxFuel: 300, canFly: true, jetMult: 2.0,
            fuelRefillThreshold: 50, fuelRegen: 0.5, fuelDrain: 1.0,
        },
    },

    ENEMIES: {
        zombie:    { hp: 2,   spd: 2,   w: 32, h: 32, sc: 10, blood: '#a00', scaleWithDifficulty: true, contact: 1, weapons: [],           shield: 0,  maxShield: 0 },
        stalker:   { hp: 3,   spd: 5.0, w: 32, h: 32, sc: 50, blood: '#a00', scaleWithDifficulty: true, contact: 1, weapons: [],           shield: 0,  maxShield: 0 },
        gunner:    { hp: 4,   spd: 1.5, w: 32, h: 32, sc: 30, blood: 'oil',  scaleWithDifficulty: true, contact: 1, weapons: ['pistol'],   shield: 0,  maxShield: 0 },
        shotman:   { hp: 5,   spd: 2,   w: 32, h: 32, sc: 30, blood: 'oil',  scaleWithDifficulty: true, contact: 1, weapons: ['shotgun'],  shield: 0,  maxShield: 0, aiCd: 45, pellets: 6 },
        commando:  { hp: 7,   spd: 2.8, w: 32, h: 32, sc: 50, blood: 'oil',  scaleWithDifficulty: true, contact: 1, weapons: ['mg'],       shield: 3,  maxShield: 3 },
        tank:      { hp: 20,  spd: 1,   w: 48, h: 48, sc: 150, blood: 'oil', scaleWithDifficulty: true, contact: 1, weapons: ['rpg'],      shield: 10, maxShield: 10, aiCd: 150 },
        sniper:    { hp: 1,   spd: 3,   w: 32, h: 32, sc: 80, blood: '#a00', scaleWithDifficulty: true, contact: 1, weapons: ['laser'],   shield: 1,  maxShield: 1 },
        mantis:    { hp: 150, spd: 5.5, w: 48, h: 48, sc: 5000, blood: '#a00', scaleWithDifficulty: true, contact: 1, weapons: ['shotgun'], shield: 0, maxShield: 0 },
        fortress:  { hp: 250, spd: 0.5, w: 64, h: 64, sc: 5000, blood: 'oil',  scaleWithDifficulty: true, contact: 1, weapons: ['mg','rpg'], shield: 0, maxShield: 0 },
        eye:       { hp: 130, spd: 4,   w: 48, h: 48, sc: 5000, blood: '#000', scaleWithDifficulty: true, contact: 1, weapons: ['laser'],  shield: 0, maxShield: 0 },
    },

    DAMAGE: {
        contact: 1,
        dash: 3,
        emp: 3,
        explodeFriend: 4,
        explodeFriendPush: 1,
        explodeVsMech: 4,
        explodeVsMechPush: 1,
        explodeEnemyVsMech: 1,
        turretExplode: 5,
        mineHp: 4,
    },

    PICKUPS: {
        repair: 3,
        shield: 3,
    },

    TURRET: {
        hp: 10,
        size: 16,
        fireCd: 10,
        weapon: 'mg',
        weaponLevel: 1,
    },

    GRAV_WELL: {
        life: 180,
        pullForce: 4,
        deadzoneSq: 100,
    },

    IFRAMES: {
        shieldHit: 20,
        hpHit: 30,
    },

    CRIT: {
        chance: 0.1,
        mult: 2,
    },

    PROGRESSION: {
        baseXp: 26,
        xpStep: 13,
        choiceCount: 3,
        rareWeight: 0.25,
    },

    UPGRADES: {
        targetingMatrix: {
            title: 'TARGETING MATRIX',
            description: 'CRIT CHANCE +5%',
            tag: '+5% CRIT',
            hue: 'crit',
            rarity: 'common',
            effects: [{ stat: 'critChance', add: 0.05, max: 0.5 }],
        },
        shieldCycler: {
            title: 'SHIELD CYCLER',
            description: 'SHIELD REGEN -15F',
            tag: 'REGEN -15F',
            hue: 'shield',
            rarity: 'common',
            effects: [{ stat: 'shieldRegenRate', add: -15, min: 60 }],
        },
        reinforcedFrame: {
            title: 'REINFORCED FRAME',
            description: 'MAX HP +2 DU',
            tag: '+2 ARMOR',
            hue: 'hp',
            rarity: 'common',
            effects: [{ stat: 'maxHp', add: 2 }],
        },
        overclockedFeed: {
            title: 'OVERCLOCKED FEED',
            description: 'FIRE COOLDOWN -8%',
            tag: 'FIRE -8%',
            hue: 'fire',
            rarity: 'common',
            effects: [{ stat: 'fireRateMult', mult: 0.92, min: 0.55 }],
        },
        servoBoost: {
            title: 'SERVO BOOST',
            description: 'MOVE SPEED +0.25',
            tag: '+SPD',
            hue: 'speed',
            rarity: 'common',
            effects: [{ stat: 'spd', add: 0.25 }],
        },
        auxiliaryTank: {
            title: 'AUXILIARY TANK',
            description: 'MAX FUEL +15%',
            tag: '+15% FUEL',
            hue: 'fuel',
            rarity: 'common',
            effects: [{ stat: 'maxFuel', basePercent: 0.15 }],
        },
        naniteSurge: {
            title: 'NANITE SURGE',
            description: 'FULL ARMOR + SHIELD RESTORE',
            tag: 'FULL ARMOR',
            hue: 'ui',
            rarity: 'common',
            effects: [{ action: 'fullHeal' }],
        },
        assaultCore: {
            title: 'ASSAULT CORE',
            description: 'MAX HP +2 DU / SPEED +0.25',
            tag: '+2 ARMOR +SPD',
            rarity: 'rare',
            effects: [{ stat: 'maxHp', add: 2 }, { stat: 'spd', add: 0.25 }],
        },
        reactorMatrix: {
            title: 'REACTOR MATRIX',
            description: 'SHIELD REGEN -15F / MAX FUEL +15%',
            tag: 'REGEN +FUEL',
            rarity: 'rare',
            effects: [{ stat: 'shieldRegenRate', add: -15, min: 60 }, { stat: 'maxFuel', basePercent: 0.15 }],
        },
        predatorProtocol: {
            title: 'PREDATOR PROTOCOL',
            description: 'CRIT +5% / FIRE COOLDOWN -8%',
            tag: 'CRIT +FIRE',
            rarity: 'rare',
            effects: [{ stat: 'critChance', add: 0.05, max: 0.5 }, { stat: 'fireRateMult', mult: 0.92, min: 0.55 }],
        },
        companionProtocol: {
            title: 'COMPANION PROTOCOL',
            description: 'DEPLOY A FOLLOWER MECH',
            tag: '+COMPANION',
            hue: 'ui',
            rarity: 'rare',
            audience: 'human',
            effects: [{ stat: 'companionCapacity', add: 1, max: 1 }],
        },
    },

    QUAD: {
        duration: 240,
        mult: 4,
    },
    FREEZE_DURATION: 240,

    MODULE_COOLDOWN: { turret: 900, warp: 1200, emp: 1200, grav: 900, overclock: 1200 },
    MODULE_DURATION: { warp: 240, overclock: 300 },

    TURRET_RANGE_SQ: 90000, // 300^2
    GRAV_WELL_RADIUS_SQ: 160000, // 400^2
    BOT_AVOID_RADIUS_SQ: 22500, // 150^2
    BOT_NEAR_RADIUS_SQ: 160000, // 400^2
    BOTS: {
        classes: ['battle', 'heavy', 'scout'],
        rivalGroupMin: 1,
        rivalGroupMax: 3,
        respawnDelay: 180,
        companionRespawnDelay: 180,
        followDistanceSq: 48400, // 220^2
        leashDistanceSq: 176400, // 420^2
    },
    ENEMY_SEPARATION_SQ: 1024, // 32^2
    COMMANDO_DODGE_RADIUS_SQ: 6400, // 80^2
};
