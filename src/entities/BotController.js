import { BALANCE } from '../config/balance.js';
import { Cam, Input } from '../core/runtime.js';
import { Game } from '../game/Game.js';
import { isHostile } from '../combat/damage.js';
import { botTargetCandidates, ownerFollowState } from './botTactics.js';

// @meta:BotController - AI controller for bot player - handles movement, targeting, and module usage
export class BotController {
    constructor(player) {
        this.p = player;
        this.input = { w:false, a:false, s:false, d:false, space:false, mouse:{x:0,y:0,down:false,wx:0,wy:0}, shift:false };
        this.target = null;
        this.changeDirTimer = 0;
        this.strafeDir = 1;
        this.modCheckTimer = 0;
    }
    update() {
        this.input.w = false; this.input.s = false; this.input.a = false; this.input.d = false; this.input.space = false; this.input.mouse.down = false; this.input.shift = false;
        const center = this.p.center();
        let avoidVec = {x:0, y:0};
        for(let i=0; i<Game.bullets.length; i++) {
            let b = Game.bullets[i];
            if (!isHostile(b.source, this.p) || b.dead) continue;
            const dx = b.x - center.x, dy = b.y - center.y;
            const dSq = dx*dx + dy*dy;
            if (dSq < BALANCE.BOT_AVOID_RADIUS_SQ) {
                const bulletToBot = {x: -dx, y: -dy};
                const dot = bulletToBot.x * b.vx + bulletToBot.y * b.vy;
                if (dot > 0) {
                    let perpX = -b.vy; let perpY = b.vx;
                    const magSq = perpX*perpX + perpY*perpY;
                    if(magSq > 0) {
                        const invMag = 1 / Math.sqrt(magSq);
                        const invD = 1 / Math.sqrt(dSq);
                        avoidVec.x += perpX * invMag * 2000 * invD;
                        avoidVec.y += perpY * invMag * 2000 * invD;
                    }
                }
            }
        }
        let lootTarget = null; let maxScore = 0;
        for(let i=0; i<Game.pows.length; i++) {
            let pow = Game.pows[i];
            const dx = pow.x - center.x, dy = pow.y - center.y;
            const dSq = dx*dx + dy*dy;
            // Use squared distance for comparison, only calculate sqrt when needed for scoring
            let score = 1000 / (Math.sqrt(dSq) + 10);
            if (pow.t === 'repair' && this.p.hp < this.p.maxHp * 0.6) score *= 10;
            if (['turret','warp','emp','grav','overclock'].includes(pow.t)) score *= 8; // High priority for modules
            if (pow.t === 'quad') score *= 5;
            if (pow.t === 'shield') score *= 3;
            if (pow.t === this.p.wep) score *= 5;
            if (score > maxScore) { maxScore = score; lootTarget = pow; }
        }
        let enemyTarget = null; let minDistSq = 9999999;
        const potentialTargets = botTargetCandidates(this.p, Game.getDamageableTargets());
        for(let i=0; i<potentialTargets.length; i++) {
            let e = potentialTargets[i];
            const dx = e.x - center.x, dy = e.y - center.y;
            const dSq = dx*dx + dy*dy;
            if (dSq < minDistSq) { minDistSq = dSq; enemyTarget = e; }
        }
        // Only calculate sqrt when actually needed for distance-based logic
        const minDist = enemyTarget ? Math.sqrt(minDistSq) : 9999;
        const follow = ownerFollowState(this.p, this.p.owner);

        // BOT MODULE USAGE
        this.modCheckTimer++;
        if(this.p.module && this.p.moduleCd <= 0 && this.modCheckTimer > 30) {
            this.modCheckTimer = 0;
            let enemiesNear = 0;
            for(let i=0; i<potentialTargets.length; i++) {
                let e = potentialTargets[i];
                const dx = e.x-center.x, dy = e.y-center.y;
                if(dx*dx + dy*dy < BALANCE.BOT_NEAR_RADIUS_SQ) enemiesNear++;
            }

            if(this.p.module === 'turret' && enemiesNear > 0) this.input.shift = true;
            if(this.p.module === 'emp' && (enemiesNear > 3 || this.p.hp < this.p.maxHp*0.4)) this.input.shift = true;
            if(this.p.module === 'warp' && this.p.hp < this.p.maxHp*0.5) this.input.shift = true;
            if(this.p.module === 'grav' && enemiesNear > 2) this.input.shift = true;
            if(this.p.module === 'overclock' && enemyTarget && enemiesNear > 0) this.input.shift = true;
        }

        let finalVx = 0; let finalVy = 0;
        if (follow.mustFollow) {
            finalVx = follow.vector.x;
            finalVy = follow.vector.y;
        }
        else if (this.p.hp < this.p.maxHp * 0.3) {
            if (lootTarget && lootTarget.t === 'repair') { this.moveTo(lootTarget, center); }
            else { if (enemyTarget) { const ang = Math.atan2(center.y - enemyTarget.y, center.x - enemyTarget.x); finalVx = Math.cos(ang); finalVy = Math.sin(ang); } }
        }
        else if (lootTarget && maxScore > 2) { this.moveTo(lootTarget, center); finalVx = this.moveVec.x; finalVy = this.moveVec.y; }
        else if (enemyTarget) {
            this.target = enemyTarget;
            const tCenter = {x: enemyTarget.x + enemyTarget.w/2, y: enemyTarget.y + enemyTarget.h/2};
            this.input.mouse.wx = tCenter.x + (enemyTarget.vx||0)*10;
            this.input.mouse.wy = tCenter.y + (enemyTarget.vy||0)*10;
            this.input.mouse.down = true;
            const dist = minDist;
            let desiredDist = 300;
            if (this.p.wep === 'shotgun') desiredDist = 120;
            if (this.p.wep === 'sniper' || this.p.wep === 'rpg') desiredDist = 500;
            const angToEnemy = Math.atan2(tCenter.y - center.y, tCenter.x - center.x);
            if (dist > desiredDist + 50) { finalVx = Math.cos(angToEnemy); finalVy = Math.sin(angToEnemy); if (this.p.wep === 'shotgun' && dist > 200) this.input.space = true; }
            else if (dist < desiredDist - 50) { finalVx = -Math.cos(angToEnemy); finalVy = -Math.sin(angToEnemy); }
            else { this.changeDirTimer++; if (this.changeDirTimer > 60) { this.strafeDir *= -1; this.changeDirTimer = 0; } finalVx = Math.cos(angToEnemy + Math.PI/2) * this.strafeDir; finalVy = Math.sin(angToEnemy + Math.PI/2) * this.strafeDir; }
        }
        else if(follow.shouldFollow) {
            finalVx = follow.vector.x;
            finalVy = follow.vector.y;
        }
        finalVx += avoidVec.x * 2.0; finalVy += avoidVec.y * 2.0;
        if (center.x < 100) finalVx += 1; if (center.x > 2900) finalVx -= 1;
        if (center.y < 100) finalVy += 1; if (center.y > 2900) finalVy -= 1;
        const lenSq = finalVx*finalVx + finalVy*finalVy;
        if (lenSq > 0.01) { // 0.1^2 - avoid sqrt when possible
            const len = Math.sqrt(lenSq);
            finalVx /= len; finalVy /= len;
            if (finalVy < -0.5) this.input.w = true;
            if (finalVy > 0.5) this.input.s = true;
            if (finalVx < -0.5) this.input.a = true;
            if (finalVx > 0.5) this.input.d = true;
        }
        if (Math.random() < 0.01 && this.p.fuel > 50) this.input.space = true;
    }
    moveTo(target, center) { const ang = Math.atan2(target.y - center.y, target.x - center.x); this.moveVec = {x: Math.cos(ang), y: Math.sin(ang)}; }
}
