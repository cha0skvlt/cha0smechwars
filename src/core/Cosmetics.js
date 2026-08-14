// Persistent cosmetic ownership (v8 section 8.1) - survives new runs/game-over, unlike the
// CE wallet and tactical upgrades. Zero effect on DU physics/balance, pure metagame sink.

const KEY = 'cmwCosmetics';

function safeParse(raw) {
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

export const Cosmetics = {
    load() {
        let parsed = null;
        try {
            parsed = safeParse(localStorage.getItem(KEY));
        } catch (_) {}
        return {
            owned: Array.isArray(parsed?.owned) && parsed.owned.length ? parsed.owned : ['hudDefault'],
            active: typeof parsed?.active === 'string' ? parsed.active : 'hudDefault',
        };
    },

    save(owned, active) {
        try {
            localStorage.setItem(KEY, JSON.stringify({ owned: [...owned], active }));
        } catch (_) {}
    },
};
