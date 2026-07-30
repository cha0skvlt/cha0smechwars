// Balance constants extracted from balance.json for performance
export const BALANCE = {
    WEAPON_SPEED: {pistol:15, shotgun:15, mg:15, rpg:8, laser:30},
    WEAPON_DAMAGE: {pistol:1, shotgun:1, mg:1, rpg:10, laser:5},
    MODULE_COOLDOWN: {turret:900, warp:1200, emp:1200, grav:900, overclock:1200},
    MODULE_DURATION: {warp:240, overclock:300},
    TURRET_RANGE_SQ: 90000, // 300^2
    GRAV_WELL_RADIUS_SQ: 160000, // 400^2
    BOT_AVOID_RADIUS_SQ: 22500, // 150^2
    BOT_NEAR_RADIUS_SQ: 160000, // 400^2
    ENEMY_SEPARATION_SQ: 1024, // 32^2
    COMMANDO_DODGE_RADIUS_SQ: 6400 // 80^2
};
