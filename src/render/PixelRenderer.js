import { Ctx } from '../core/runtime.js';
import { pixelAtlas } from './PixelAtlas.js';
import { ART_TOKENS } from './artTokens.generated.js';
import { getVisual } from './visualManifest.js';

const PICKUPS = Object.freeze({
    shotgun: { id: 'pickup.shotgun', char: 'S', color: '#f90' },
    mg: { id: 'pickup.mg', char: 'M', color: '#bf0' },
    rpg: { id: 'pickup.rpg', char: 'R', color: '#ff0' },
    laser: { id: 'pickup.laser', char: 'L', color: '#f0f' },
    repair: { id: 'pickup.repair', char: 'A', color: '#00eaff' },
    quad: { id: 'pickup.quad', char: 'Q', color: '#f0f' },
    freeze: { id: 'pickup.freeze', char: 'Z', color: '#60f' },
    mine: { id: 'pickup.mine', char: 'M', color: '#f00' },
    shield: { id: 'pickup.shield', char: 'O', color: '#00eaff' },
    resurrect: { id: 'pickup.resurrect', char: 'V', color: '#0f0' },
    turret: { id: 'pickup.turret', char: 'E', color: '#0ff' },
    warp: { id: 'pickup.warp', char: 'E', color: '#0ff' },
    emp: { id: 'pickup.emp', char: 'E', color: '#0ff' },
    grav: { id: 'pickup.grav', char: 'E', color: '#0ff' },
    overclock: { id: 'pickup.overclock', char: 'E', color: '#0ff' },
});

export function pickupVisual(type) {
    return PICKUPS[type] || PICKUPS.turret;
}

function contextOf(params) {
    return params.context || Ctx;
}

function drawBitmap(id, params) {
    const context = contextOf(params);
    const image = pixelAtlas.get(id);
    context.imageSmoothingEnabled = false;
    context.drawImage(
        image,
        params.x,
        params.y,
        params.width ?? image.width,
        params.height ?? image.height,
    );
}

function drawRing(context, { x, y, radius, color, fillColor, lineWidth = 2 }) {
    context.strokeStyle = color;
    context.fillStyle = fillColor;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    if(fillColor) context.fill();
    context.stroke();
}

function drawPickup(id, params) {
    const context = contextOf(params);
    const descriptor = Object.values(PICKUPS).find(item => item.id === id);
    context.save();
    context.shadowBlur = 0;
    context.globalCompositeOperation = 'lighter';
    context.fillStyle = descriptor.color;
    context.globalAlpha = 0.5;
    context.fillRect(params.x - 5, params.y - 5, 34, 34);
    context.globalAlpha = 1;
    context.fillRect(params.x, params.y, 24, 24);
    context.restore();
    context.fillStyle = '#000';
    context.font = '16px monospace';
    context.fillText(descriptor.char, params.x + 6, params.y + 18);
}

export function renderVisual(id, params = {}) {
    const visual = getVisual(id);
    const context = contextOf(params);
    if(visual.kind === 'bitmap') {
        drawBitmap(id, params);
        return;
    }

    if(id === 'shadow.ground') {
        context.save();
        context.globalAlpha = 0.5;
        context.fillStyle = '#000';
        context.beginPath();
        context.ellipse(params.x + params.width / 2, params.y + 8, params.width / 2, 8, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
        return;
    }
    if(id.startsWith('effect.shield.')) {
        context.save();
        context.globalCompositeOperation = 'lighter';
        drawRing(context, {
            ...params,
            color: `rgba(${params.rgb}, ${params.pulse})`,
            fillColor: `rgba(${params.rgb}, 0.15)`,
        });
        context.restore();
        return;
    }
    if(id === 'effect.dash.echo') {
        context.save();
        context.globalAlpha = 0.5;
        drawBitmap(params.spriteId, params);
        context.restore();
        return;
    }
    if(id === 'effect.overclock') {
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.fillStyle = `rgba(255,0,0,${params.alpha})`;
        context.fillRect(params.x, params.y, params.width, params.height);
        context.restore();
        return;
    }
    if(id === 'effect.mantis.rage') {
        context.save();
        context.globalCompositeOperation = 'source-atop';
        context.fillStyle = '#f00';
        drawBitmap(params.spriteId, params);
        context.globalCompositeOperation = 'lighter';
        context.fillStyle = 'rgba(255,0,0,0.5)';
        context.fillRect(params.x, params.y, params.width, params.height);
        context.restore();
        return;
    }
    if(id === 'effect.damage.smoke') {
        context.save();
        context.translate(params.x, params.y);
        context.fillStyle = `rgba(0,0,0,${params.alpha})`;
        context.beginPath();
        context.arc(0, 0, params.radius, 0, Math.PI * 2);
        context.fill();
        if(params.spark) {
            context.fillStyle = '#fff';
            context.fillRect(params.spark.x, params.spark.y, 2, 2);
        }
        context.restore();
        return;
    }
    if(id === 'projectile.bullet') {
        context.fillStyle = params.color;
        context.fillRect(params.x, params.y, params.width, params.height);
        return;
    }
    if(id === 'projectile.laser') {
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.shadowBlur = 0;
        context.translate(params.x, params.y);
        context.rotate(params.angle);
        context.fillStyle = params.color;
        context.fillRect(0, 0, params.width, params.height);
        context.fillStyle = '#fff';
        context.fillRect(0, 1, params.width, params.height / 2);
        context.restore();
        return;
    }
    if(id === 'effect.turret.flash') {
        context.save();
        context.globalCompositeOperation = 'lighter';
        context.fillStyle = 'rgba(255, 255, 0, 0.5)';
        context.fillRect(params.x - 2, params.y - 2, 20, 20);
        context.restore();
        return;
    }
    if(id === 'module.gravity.well') {
        context.save();
        drawRing(context, {
            x: params.x,
            y: params.y,
            radius: params.radius * params.pulse,
            color: `rgba(240, 0, 255, ${0.3 * params.pulse})`,
            lineWidth: 2,
        });
        drawRing(context, {
            x: params.x,
            y: params.y,
            radius: params.radius * 0.5 * params.pulse,
            color: `rgba(240, 0, 255, ${0.5 * params.pulse})`,
            lineWidth: 1,
        });
        context.fillStyle = '#000';
        context.strokeStyle = '#f0f';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(params.x, params.y, params.coreRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.restore();
        return;
    }
    if(id === 'obstacle.tree.trunk') {
        context.fillStyle = '#432';
        context.fillRect(params.x + 12, params.y + 28, 8, 8);
        return;
    }
    if(id === 'obstacle.house') {
        context.fillStyle = '#854';
        context.fillRect(params.x, params.y + 20, params.width, params.height - 20);
        context.fillStyle = '#632';
        context.beginPath();
        context.moveTo(params.x - 5, params.y + 20);
        context.lineTo(params.x + params.width / 2, params.y);
        context.lineTo(params.x + params.width + 5, params.y + 20);
        context.fill();
        context.fillStyle = '#000';
        context.fillRect(params.x + 30, params.y + 40, 15, 20);
        return;
    }
    if(id === 'obstacle.water') {
        context.fillStyle = params.color;
        context.fillRect(params.x, params.y, params.width, params.height);
        return;
    }
    if(id === 'effect.particle' || id.startsWith('effect.weather.')) {
        context.save();
        if(params.additive) context.globalCompositeOperation = 'lighter';
        context.fillStyle = params.color;
        context.fillRect(params.x, params.y, params.size, params.size);
        context.restore();
        return;
    }
    if(id === 'effect.debris') {
        context.save();
        context.translate(params.x, params.y);
        context.rotate(params.angle);
        context.fillStyle = params.color;
        context.fillRect(-params.size / 2, -params.size / 2, params.size, params.size);
        context.restore();
        return;
    }
    if(id === 'effect.shockwave') {
        context.save();
        drawRing(context, {
            x: params.x,
            y: params.y,
            radius: params.radius,
            color: `rgba(255,255,255,${params.alpha})`,
            lineWidth: 2,
        });
        context.restore();
        return;
    }
    if(id === 'effect.floater') {
        context.save();
        if(params.glow) {
            context.shadowBlur = 10;
            context.shadowColor = params.color;
        } else {
            context.shadowBlur = 0;
        }
        context.font = `${params.fontSize}px "Press Start 2P"`;
        context.fillStyle = params.color;
        context.fillText(params.text, params.x, params.y);
        context.restore();
        return;
    }
    if(id === 'effect.decal') {
        context.fillStyle = params.color;
        for(const blob of params.blobs) {
            context.beginPath();
            context.arc(params.x + blob.ox, params.y + blob.oy, blob.r, 0, Math.PI * 2);
            context.fill();
        }
        return;
    }
    if(id === 'background.biome') {
        const colors = { forest: '#051005', ruins: '#101520', dungeon: '#1a0505' };
        context.fillStyle = colors[params.biome];
        context.fillRect(0, 0, params.width, params.height);
        return;
    }
    if(id === 'background.map') {
        context.imageSmoothingEnabled = false;
        context.drawImage(params.image, params.x || 0, params.y || 0);
        return;
    }
    if(id === 'background.grid') {
        context.strokeStyle = 'rgba(0,255,255,0.1)';
        context.lineWidth = 1;
        context.beginPath();
        for(let i = 0; i <= params.size; i += 100) {
            context.moveTo(i, 0);
            context.lineTo(i, params.size);
            context.moveTo(0, i);
            context.lineTo(params.size, i);
        }
        context.stroke();
        context.strokeStyle = '#f00';
        context.strokeRect(0, 0, params.size, params.size);
        return;
    }
    if(id === 'background.darkness') {
        context.fillStyle = params.color;
        context.fillRect(0, 0, params.width, params.height);
        return;
    }
    if(id === 'background.warp') {
        context.save();
        context.globalCompositeOperation = 'overlay';
        for(let y = 0; y < params.height; y += 5) {
            context.fillStyle = params.color;
            context.fillRect(0, y, params.width, 2);
        }
        context.restore();
        return;
    }
    if(id === 'background.death') {
        context.save();
        context.globalCompositeOperation = 'multiply';
        context.fillStyle = `rgba(255, 0, 0, ${params.redAlpha})`;
        context.fillRect(0, 0, params.width, params.height);
        if(params.flash) {
            context.globalCompositeOperation = 'source-over';
            context.fillStyle = `rgba(255,255,255,${params.flashAlpha})`;
            context.fillRect(0, params.flashY, params.width, 20);
        }
        context.restore();
        return;
    }
    if(id === 'hud.boss') {
        const { x, y, width, height, percentage, text } = params;
        context.fillStyle = 'rgba(0,0,0,0.8)';
        context.fillRect(x, y, width, height);
        context.strokeStyle = '#f00';
        context.lineWidth = 2;
        context.strokeRect(x, y, width, height);
        const gradient = context.createLinearGradient(x, 0, x + width, 0);
        gradient.addColorStop(0, '#f00');
        gradient.addColorStop(1, '#800');
        context.fillStyle = gradient;
        context.fillRect(x, y, width * percentage, height);
        context.fillStyle = '#f00';
        context.font = '16px "Press Start 2P"';
        context.textAlign = 'center';
        context.fillText(text, x + width / 2, y - 10);
        return;
    }
    if(id === 'hud.combo') {
        context.save();
        context.fillStyle = `rgba(255, 0, 0, ${params.alpha})`;
        context.font = '20px "Press Start 2P"';
        context.textAlign = 'center';
        context.translate(params.x, params.y);
        context.scale(params.scale, params.scale);
        context.fillText(`${params.combo}x COMBO`, 0, 0);
        if(params.callout) {
            context.fillStyle = '#f00';
            context.font = '30px "Press Start 2P"';
            context.fillText(params.callout, 0, 40);
        }
        context.restore();
        return;
    }
    if(id.startsWith('pickup.')) {
        drawPickup(id, params);
        return;
    }
    throw new Error(`Visual renderer missing implementation: ${id}`);
}

export const HUD_COLORS = ART_TOKENS.palette;
