// Live per-run kill / rival counters (source of truth for game-over + highscore)
// v8: SCORE removed in favor of Combat Experience (CE) - see BALANCE.CE / GAME_SYS.md.

function emptyBag() {
    return Object.create(null);
}

function sumBag(bag) {
    let n = 0;
    for (const k in bag) n += bag[k] | 0;
    return n;
}

function bump(bag, type) {
    const t = type || 'unknown';
    bag[t] = (bag[t] | 0) + 1;
}

export const RunStats = {
    class: null,
    biome: null,
    wave: 1,
    ce: 0,
    missionsCleared: 0,
    rivalKills: 0,
    playerKills: emptyBag(),
    botKills: emptyBag(),
    bossKillsPlayer: 0,
    bossKillsBot: 0,

    reset(meta = {}) {
        this.class = meta.class || null;
        this.biome = meta.biome || null;
        this.wave = 1;
        this.ce = 0;
        this.missionsCleared = 0;
        this.rivalKills = 0;
        this.playerKills = emptyBag();
        this.botKills = emptyBag();
        this.bossKillsPlayer = 0;
        this.bossKillsBot = 0;
    },

    setMeta(meta = {}) {
        if (meta.class != null) this.class = meta.class;
        if (meta.biome != null) this.biome = meta.biome;
        if (meta.wave != null) this.wave = meta.wave;
    },

    kill(type, byPlayer, isBoss = false) {
        if (byPlayer) {
            bump(this.playerKills, type);
            if (isBoss) this.bossKillsPlayer++;
        } else {
            bump(this.botKills, type);
            if (isBoss) this.bossKillsBot++;
        }
    },

    rival() {
        this.rivalKills++;
    },

    /** Credit Combat Experience to the run total (wallet-share already applied by the caller). */
    ceEarned(amount) {
        this.ce += Math.max(0, amount | 0);
    },

    missionCleared() {
        this.missionsCleared++;
    },

    snapshot(reason) {
        const playerKills = { ...this.playerKills };
        const botKills = { ...this.botKills };
        return {
            class: this.class,
            biome: this.biome,
            wave: this.wave | 0,
            ce: this.ce | 0,
            missionsCleared: this.missionsCleared | 0,
            rivalKills: this.rivalKills | 0,
            reason: reason || null,
            endedAt: Date.now(),
            playerKills,
            botKills,
            playerTotal: sumBag(playerKills),
            botTotal: sumBag(botKills),
            bossKillsPlayer: this.bossKillsPlayer | 0,
            bossKillsBot: this.bossKillsBot | 0,
        };
    },
};
