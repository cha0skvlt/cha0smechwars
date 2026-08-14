// Pure physical-separation math for the mech<->enemy body-collision pairing. The existing
// enemy-enemy (Enemy.js) and mech-mech (Player.js) separations are same-size, single-file, and
// keep their own inline math - this pairing is size-aware (enemies range 32-64px) and computed
// independently from two different files (Player.js pushes a mech away from enemies, Enemy.js
// pushes an enemy away from mechs), so the shared math lives here once instead of risking the two
// copies drifting apart.

/**
 * Push vector for entity A, away from entity B, given both entities' centers and half-widths.
 * Returns null when the two aren't close enough to separate (or sit on the exact same point,
 * where a push direction is undefined).
 */
export function separationPush(ax, ay, aHalf, bx, by, bHalf, pad = 0, mult = 1) {
    const dx = ax - bx, dy = ay - by;
    const distSq = dx * dx + dy * dy;
    if (distSq === 0) return null;
    const threshold = aHalf + bHalf + pad;
    if (distSq >= threshold * threshold) return null;
    const invD = 1 / Math.sqrt(distSq);
    return { x: dx * invD * mult, y: dy * invD * mult };
}
