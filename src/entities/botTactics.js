import { BALANCE } from '../config/balance.js';
import { isHostile } from '../combat/damage.js';

export function botTargetCandidates(actor, candidates) {
    return candidates.filter(target => (
        target
        && target.hp > 0
        && !target.dead
        && !target.flying
        && isHostile(actor, target)
    ));
}

export function ownerFollowState(actor, owner) {
    if(!actor || !owner) return { shouldFollow: false, mustFollow: false, vector: { x: 0, y: 0 } };
    const actorCenter = actor.center();
    const ownerCenter = owner.center();
    const dx = ownerCenter.x - actorCenter.x;
    const dy = ownerCenter.y - actorCenter.y;
    const distanceSq = dx*dx + dy*dy;
    const invDistance = distanceSq > 0 ? 1 / Math.sqrt(distanceSq) : 0;
    return {
        shouldFollow: distanceSq > BALANCE.BOTS.followDistanceSq,
        mustFollow: distanceSq > BALANCE.BOTS.leashDistanceSq,
        vector: { x: dx * invDistance, y: dy * invDistance },
    };
}
