// Browser high scores — top 5 by score in localStorage

const KEY = 'cmwHighScores';
const MAX = 5;

function safeParse(raw) {
    try {
        const j = JSON.parse(raw);
        return Array.isArray(j) ? j : [];
    } catch (_) {
        return [];
    }
}

function cmp(a, b) {
    if ((b.ce | 0) !== (a.ce | 0)) return (b.ce | 0) - (a.ce | 0);
    if ((b.missionsCleared | 0) !== (a.missionsCleared | 0)) return (b.missionsCleared | 0) - (a.missionsCleared | 0);
    return (b.endedAt | 0) - (a.endedAt | 0);
}

export const HighScores = {
    load() {
        try {
            return safeParse(localStorage.getItem(KEY)).sort(cmp).slice(0, MAX);
        } catch (_) {
            return [];
        }
    },

    save(entries) {
        try {
            localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
        } catch (_) {}
    },

    submit(snap) {
        if (!snap) return { entries: this.load(), rank: null };
        const entries = this.load();
        entries.push({ ...snap });
        entries.sort(cmp);
        const trimmed = entries.slice(0, MAX);
        this.save(trimmed);
        const endedAt = snap.endedAt;
        const rankIdx = trimmed.findIndex(
            (e) => e.endedAt === endedAt && (e.ce | 0) === (snap.ce | 0)
        );
        return { entries: trimmed, rank: rankIdx >= 0 ? rankIdx + 1 : null };
    },
};
