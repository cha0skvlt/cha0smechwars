// Rival "blood debt" identity (company name + player-mech kill tally) - persists for the
// browser session (sessionStorage): the same nemesis company and running kill count survive
// every new run started in this tab, and only clear when the tab/browser session actually ends.
// Unlike Cosmetics/HighScores (localStorage - forever), this is deliberately session-scoped.

const KEY = 'cmwRivalIdentity';

function safeParse(raw) {
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

export const RivalIdentity = {
    load() {
        let parsed = null;
        try {
            parsed = safeParse(sessionStorage.getItem(KEY));
        } catch (_) {}
        return {
            companyName: typeof parsed?.companyName === 'string' && parsed.companyName ? parsed.companyName : null,
            mechKills: Number.isInteger(parsed?.mechKills) ? parsed.mechKills : 0,
        };
    },

    save(companyName, mechKills) {
        try {
            sessionStorage.setItem(KEY, JSON.stringify({ companyName, mechKills }));
        } catch (_) {}
    },
};
