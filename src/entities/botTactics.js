import { BALANCE } from '../config/balance.js';
import { isHostile } from '../combat/damage.js';

export function botTargetCandidates(actor, candidates) {
    return candidates.filter(target => (
        target
        && target.hp > 0
        && !target.dead
        && isHostile(actor, target)
    ));
}

/**
 * Which wing role (1 or 2) a non-leader lance mech currently occupies. Leadership moves at
 * runtime (player switches control with [C]; a rival leader can die and hand off) but a mech's
 * own `lanceSlot` is fixed at construction - so wing role must be derived from "rank among the
 * mechs that aren't leading right now", not read off the mech's static slot number. Otherwise a
 * mech built at lanceSlot 0 would keep asking for the leader's exact position (offset zero) even
 * after someone else took over leading, and pile up on top of them.
 */
export function wingIndexOf(mech, lance, leader) {
    const wings = lance.filter(m => m !== leader).sort((a, b) => a.lanceSlot - b.lanceSlot);
    return wings.indexOf(mech) === 0 ? 1 : 2;
}

/**
 * Triangle formation slot position for a lance mech, relative to its leader.
 * Slot 0 (leader) sits at the leader's own position (point of the triangle).
 * Slots 1/2 (wings) trail behind the leader's facing, splayed left/right.
 */
export function formationSlotTarget(leader, slotIndex) {
    if(!leader) return null;
    if(slotIndex === 0) return { x: leader.x, y: leader.y };
    const spacing = BALANCE.LANCE.triangleSpacing;
    const angleOffset = BALANCE.LANCE.triangleAngle;
    const facing = Number.isFinite(leader.facing) ? leader.facing : 0;
    const sign = slotIndex === 1 ? -1 : 1;
    const ang = facing + Math.PI + sign * angleOffset;
    return { x: leader.x + Math.cos(ang) * spacing, y: leader.y + Math.sin(ang) * spacing };
}

/**
 * Follow state of `actor` relative to a formation slot target (not the leader's raw position).
 * `tight` selects the Formation Tactics radii (hard triangle lock) over the default soft radii.
 */
export function ownerFollowState(actor, slotTarget, tight=false) {
    if(!actor || !slotTarget) return { shouldFollow: false, mustFollow: false, vector: { x: 0, y: 0 } };
    const actorCenter = actor.center();
    const dx = slotTarget.x - actorCenter.x;
    const dy = slotTarget.y - actorCenter.y;
    const distanceSq = dx*dx + dy*dy;
    const followSq = tight ? BALANCE.LANCE.tightFollowRadiusSq : BALANCE.LANCE.followRadiusSq;
    const leashSq = tight ? BALANCE.LANCE.tightLeashRadiusSq : BALANCE.LANCE.leashRadiusSq;
    const invDistance = distanceSq > 0 ? 1 / Math.sqrt(distanceSq) : 0;
    return {
        shouldFollow: distanceSq > followSq,
        mustFollow: distanceSq > leashSq,
        vector: { x: dx * invDistance, y: dy * invDistance },
    };
}
