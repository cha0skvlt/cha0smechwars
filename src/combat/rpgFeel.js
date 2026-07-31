import { BALANCE } from '../config/balance.js';

/** Recoil kick when the mech fires an RPG (dual L2+ still ×1.5). */
export function rpgFireKick(level=1, feel=BALANCE.WEAPONS.rpg.feel) {
    let kick = feel.fireKick;
    if(level >= 2) kick *= 1.5;
    return kick;
}

/** Screen shake amplitude for RPG muzzle punch. */
export function rpgFireShake(level=1, feel=BALANCE.WEAPONS.rpg.feel) {
    let shake = feel.fireShake;
    if(level >= 2) shake *= 1.5;
    return shake;
}

/** Shake + trauma for an RPG detonation (softer than generic explode). */
export function rpgExplodeFx({ isBotSource=false, isBigExplosion=false }={}, feel=BALANCE.WEAPONS.rpg.feel) {
    let shake = isBotSource ? feel.explodeShakeBot : feel.explodeShake;
    if(isBigExplosion) shake = Math.max(shake, feel.explodeShake);
    const trauma = (isBotSource && !isBigExplosion)
        ? feel.explodeTrauma * 0.5
        : feel.explodeTrauma;
    return { shake, trauma };
}
