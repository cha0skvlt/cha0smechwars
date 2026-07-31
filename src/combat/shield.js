import { BALANCE } from '../config/balance.js';

/** Monster shield ring radius — sits clear of the sprite like mech rings. */
export function shieldRingRadius(w, h, padding=BALANCE.SHIELD.ringPadding) {
    if(!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        throw new TypeError('Shield ring size must be positive finite values');
    }
    if(!Number.isFinite(padding) || padding < 0) {
        throw new TypeError('Shield ring padding must be a non-negative finite value');
    }
    return Math.max(w, h) / 2 + padding;
}
