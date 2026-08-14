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

    // knockback: cosmetic feel only (px shoved along the bullet's travel direction on a landed
    // hit) - zero effect on DU damage/balance, purely "does this weapon feel like it lands".
    WEAPONS: {
        pistol:  { damage: 1, speed: 15, baseCd: 18, minCd: 5, size: 6, sizeH: 6, knockback: 3 },
        shotgun: { damage: 1, speed: 15, baseCd: 45, minCd: 20, size: 6, sizeH: 6, knockback: 4,
                   pelletsBase: 5, spreadL2: 0.48, spreadL1: 0.8, explodeRadiusL3: 30 },
        mg:      { damage: 1, speed: 15, baseCd: 6,  minCd: 2, size: 6, sizeH: 6, knockback: 2, speedMultL3: 1.5 },
        laser:   { damage: 2, speed: 30, baseCd: 50, minCd: 30, size: 30, sizeH: 2, knockback: 2, sizeL3: 45, sizeHL3: 3 },
        rpg:     { damage: 3, speed: 8,  baseCd: 80, minCd: 40, size: 8, sizeH: 8, knockback: 8,
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
            // Juggernaut Dash (v8): held-button ground rush, drains fuel per frame instead of a fixed cost/duration.
            dashSpeed: 10, dashFuelDrain: 1.5, dashPostInv: 12, dashKnockback: 30,
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
        // Player mechs self-throttle repeat contact damage via IFRAMES (shieldHit/hpHit); Enemy has
        // no equivalent i-frame mechanic, so mech->enemy contact damage needs its own cooldown or a
        // mech standing inside a monster would deal a full hit every single frame.
        contactCooldown: 30,
        dash: 3,
        dashMk2: 5, // Juggernaut Dash Mk.2 tactical upgrade (heavy branch)
        emp: 3,
        explodeFriend: 4,
        explodeFriendPush: 1,
        explodeVsMech: 4,
        explodeVsMechPush: 1,
        explodeEnemyVsMech: 1,
        turretExplode: 5,
        mineHp: 4,
        seismicSlam: 6, // Seismic Slam tactical upgrade (heavy branch) - dash-end shockwave
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

    // Battle turret variants (v8) - default is free (mg), rocket/laser are TACTICAL_UPGRADES.battle purchases.
    // Damage comes from the shared WEAPONS table (no separate turret damage numbers).
    TURRET_VARIANTS: {
        mg:     { weapon: 'mg',    weaponLevel: 1, barrels: 1, fireCd: 10 },
        rocket: { weapon: 'rpg',   weaponLevel: 1, barrels: 2, fireCd: 26 },
        laser:  { weapon: 'laser', weaponLevel: 1, barrels: 2, fireCd: 22 },
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
    },
    ENEMY_SEPARATION_SQ: 1024, // 32^2
    MECH_SEPARATION_SQ: 1600, // 40^2 - lance/rival mechs (all 6 are the same 32x32 hitbox) push apart when this close
    // Mech<->enemy separation is size-aware (enemies range 32-64px, unlike the two uniform-size
    // pairings above) - MECH_ENEMY_SEPARATION_PAD is added to (mechHalf + enemyHalf) rather than a
    // fixed squared-distance constant. SEPARATION_PUSH_MULT is the shared push strength the three
    // separation systems all use (the other two still hardcode this same 1.5 inline - untouched).
    MECH_ENEMY_SEPARATION_PAD: 8,
    SEPARATION_PUSH_MULT: 1.5,
    COMMANDO_DODGE_RADIUS_SQ: 6400, // 80^2

    // --- v8.0 LANCE UPDATE -------------------------------------------------

    // Combat Experience: 1 DU = 1 CE. Mech kill = maxHP (shield excluded) x THE VICTIM'S level
    // (a leveled-up mech is worth more to kill; killer level is not part of the formula).
    // Boss kill = full maxHP. Monsters = maxHP x hpMult (existing enemy exp, same formula).
    // Symmetric for both lances. Unspent CE is a persistent wallet (metagame currency).
    CE: {
        unit: 1, // documents the 1 DU = 1 CE identity; readers must not hardcode
        raceLossShare: 0.5,  // player share of mission CE when the RIVAL lance kills the boss first
        wipeShare: 0.5,       // player share of mission CE when the player's whole lance is wiped - same 50% penalty as any other mission loss
    },

    LANCE: {
        size: 3,
        triangleSpacing: 90,      // wing-mech offset from leader in formation (px)
        triangleAngle: 0.6,       // radians of spread either side of due-behind the leader heading (~34deg)
        followRadiusSq: 48400,    // 220^2 - AI mech starts closing back to leader
        leashRadiusSq: 176400,    // 420^2 - AI mech must return to leader, ignoring combat
        tightFollowRadiusSq: 8100,  // 90^2 - Formation Tactics: tight lock-step radius
        tightLeashRadiusSq: 24336,  // 156^2 - Formation Tactics: tight hard leash
        cornerMargin: 260,        // distance from a map corner used to anchor lance spawn
        cornerPairs: [ // opposite (non-adjacent) corners, picked randomly each mission
            [{ x: 1, y: 1 }, { x: -1, y: -1 }],
            [{ x: -1, y: 1 }, { x: 1, y: -1 }],
        ],
    },

    // Rival Budget: persistent CE wallet for the enemy lance, spent on the same TACTICAL_UPGRADES
    // catalog as the player. Grows only on player mission wins, so a losing player can never
    // spiral the rival further ahead.
    RIVAL: {
        gainPerWin: 70, // ~40% of avg boss CE ((150+250+130)/3 ~= 176.7) - player stays ahead on wins
        companyNames: [
            'BLACK VISOR SYNDICATE', 'IRON COFFIN COMPANY', 'RED LEDGER CARTEL',
            'ASHFALL CONTRACTORS', 'NULL POINT MERCS', 'GRAVE MARKET LANCE',
        ],
    },

    // Contract price streaks: win streak discounts tactical upgrades, loss streak surcharges them.
    // A win resets the loss streak (and vice versa) - streaks never run concurrently.
    STREAK: {
        discountStep: 0.05, discountMax: 0.25, // -5%/win, capped -25%
        surchargeStep: 0.05, surchargeMax: 0.25, // +5%/loss, capped +25%
    },

    // Tactical Upgrades shop catalog (v8). Purchased per lance slot (slot+class); reset when a
    // slot's mech class changes. `lance` branch entries apply to the whole squad, not one slot.
    // `flag` upgrades change behavior (read by Player.js/Turret.js/BotController.js);
    // `effects` upgrades reuse the same stat-add shape as progression.js level-up perks.
    TACTICAL_UPGRADES: {
        maxPerMech: 4,
        heavy: {
            improvedHeavy: {
                title: 'IMPROVED HEAVY', tag: '+3 HP / +2 SHIELD', cost: 50,
                effects: [{ stat: 'maxHp', add: 3 }, { stat: 'maxShield', add: 2 }],
            },
            bastionShield: {
                title: 'BASTION SHIELD', tag: 'SHIELD x2 RADIUS - SHELTERS LANCE', cost: 150,
                flag: 'bastionShield',
            },
            seismicSlam: {
                title: 'SEISMIC SLAM', tag: `DASH-END SHOCKWAVE ${6} DU`, cost: 130,
                flag: 'seismicSlam',
            },
            juggernautMk2: {
                title: 'JUGGERNAUT DASH MK.2', tag: 'DASH DAMAGE 3->5 DU / +FUEL EFFICIENCY', cost: 120,
                flag: 'juggernautMk2',
            },
        },
        battle: {
            improvedBattle: {
                title: 'IMPROVED BATTLE', tag: '+2 HP / +1 SHIELD', cost: 50,
                effects: [{ stat: 'maxHp', add: 2 }, { stat: 'maxShield', add: 1 }],
            },
            turretRocket: {
                title: 'ROCKET TURRET', tag: 'TURRET: DUAL RPG BARRELS', cost: 140,
                flag: 'turretVariant', value: 'rocket',
            },
            turretLaser: {
                title: 'LASER TURRET', tag: 'TURRET: DUAL LASER BARRELS', cost: 130,
                flag: 'turretVariant', value: 'laser',
            },
        },
        scout: {
            improvedScout: {
                title: 'IMPROVED SCOUT', tag: '+2 HP / +1 SHIELD', cost: 50,
                effects: [{ stat: 'maxHp', add: 2 }, { stat: 'maxShield', add: 1 }],
            },
            permaFlight: {
                title: 'PERMA-FLIGHT', tag: 'ALWAYS AIRBORNE - [SPACE] TO LAND', cost: 130,
                flag: 'permaFlight',
            },
        },
        lance: {
            formationTactics: {
                title: 'FORMATION TACTICS', tag: 'TIGHT TRIANGLE LOCK - BASTION COVERS LANCE', cost: 100,
                flag: 'formationTactics',
            },
        },
    },

    // Heavy branch ability numbers referenced by TACTICAL_UPGRADES.heavy flags.
    HEAVY_ABILITIES: {
        bastionShieldRadiusMult: 2,
        seismicSlamRadius: 100,
    },

    // Cosmetic metagame branch (v8.1) - zero effect on DU physics/balance, pure CE sink.
    // Applied as CSS classes on #game-container; extend this catalog to add more items.
    COSMETICS: {
        hudThemes: {
            hudDefault:  { title: 'DEFAULT CYAN', cost: 0,  cssClass: null },
            hudEmber:    { title: 'EMBER ORANGE', cost: 80, cssClass: 'hud-theme-ember' },
            hudToxic:    { title: 'TOXIC LIME',   cost: 80, cssClass: 'hud-theme-toxic' },
            hudMagenta:  { title: 'SIGNAL MAGENTA', cost: 80, cssClass: 'hud-theme-magenta' },
            hudBlood:    { title: 'BLOOD RED', cost: 120, cssClass: 'hud-theme-blood' },
        },
    },
};
