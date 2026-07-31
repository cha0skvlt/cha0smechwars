import { pixelAtlas } from './PixelAtlas.js';

export const Cache = {};

const LEGACY_KEYS = Object.freeze({
    player: 'sprite.player.battle',
    player_q: 'sprite.player.battle.quad',
    heavy: 'sprite.player.heavy',
    heavy_q: 'sprite.player.heavy.quad',
    scout: 'sprite.player.scout',
    scout_q: 'sprite.player.scout.quad',
    bot_battle: 'sprite.rival.battle',
    bot_heavy: 'sprite.rival.heavy',
    bot_scout: 'sprite.rival.scout',
    tree: 'sprite.obstacle.tree',
    box: 'sprite.obstacle.box',
    wall_ruin: 'sprite.obstacle.wall.ruins',
    wall_cave: 'sprite.obstacle.wall.dungeon',
    turret: 'sprite.module.turret',
});

export function bakeSprites() {
    pixelAtlas.build(document);
    for(const [legacy, id] of Object.entries(LEGACY_KEYS)) Cache[legacy] = pixelAtlas.get(id);
    for(const name of ['zombie', 'gunner', 'shotman', 'sniper', 'tank', 'mantis', 'fortress', 'eye', 'stalker', 'commando']) {
        Cache[name] = pixelAtlas.get(`sprite.enemy.${name}`);
        Cache[`${name}_w`] = pixelAtlas.get(`sprite.enemy.${name}.hit`);
        Cache[`${name}_b`] = pixelAtlas.get(`sprite.enemy.${name}.freeze`);
    }
    renderPreview('preview-battle', 'player'); renderPreview('preview-heavy', 'heavy'); renderPreview('preview-scout', 'scout');
}
export function renderPreview(id, key) { const cv = document.getElementById(id); if(!cv) return; const ctx = cv.getContext('2d'); cv.width = 96; cv.height = 96; ctx.imageSmoothingEnabled = false; if(Cache[key]) ctx.drawImage(Cache[key], 0, 0, 96, 96); }
