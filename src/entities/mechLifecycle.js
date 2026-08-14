import { BALANCE } from '../config/balance.js';

function unitRoll(rng) {
    return Math.min(Math.max(rng(), 0), 1 - Number.EPSILON);
}

export function randomMechClass(rng=Math.random) {
    const classes = BALANCE.BOTS.classes;
    return classes[Math.floor(unitRoll(rng) * classes.length)];
}

/** Rival lance composition: 3 slots, each an equiprobable class roll (v8 Lance Update). */
export function randomLanceComposition(rng=Math.random) {
    const size = BALANCE.LANCE.size;
    const composition = [];
    for(let i=0; i<size; i++) composition.push(randomMechClass(rng));
    return composition;
}
