import { BALANCE } from '../config/balance.js';

function unitRoll(rng) {
    return Math.min(Math.max(rng(), 0), 1 - Number.EPSILON);
}

export function randomMechClass(rng=Math.random) {
    const classes = BALANCE.BOTS.classes;
    return classes[Math.floor(unitRoll(rng) * classes.length)];
}

export function randomRivalGroupSize(rng=Math.random) {
    const { rivalGroupMin, rivalGroupMax } = BALANCE.BOTS;
    return rivalGroupMin + Math.floor(unitRoll(rng) * (rivalGroupMax - rivalGroupMin + 1));
}
