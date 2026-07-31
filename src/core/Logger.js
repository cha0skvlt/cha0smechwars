// Structured realtime logger for AI agents (NDJSON via Vite /__cmw/log)

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const RING_MAX = 2048;
const BATCH_MAX = 32;
const FLUSH_MS = 200;
const ENDPOINT = '/__cmw/log';

function resolveMinLevel() {
    try {
        const q = new URLSearchParams(location.search).get('log');
        if (q && LEVELS[q] != null) return q;
        const ls = localStorage.getItem('cmwLogLevel');
        if (ls && LEVELS[ls] != null) return ls;
    } catch (_) {}
    return 'info';
}

function ctxFrame() {
    try {
        if (typeof window !== 'undefined' && window.__CMW_GAME__) {
            const g = window.__CMW_GAME__;
            return { frame: g.frame|0, wave: g.wave|0 };
        }
    } catch (_) {}
    return { frame: 0, wave: 0 };
}

export const Logger = {
    minLevel: 'info',
    ring: [],
    queue: [],
    _flushTimer: null,
    _timers: Object.create(null),
    enabled: true,

    init() {
        this.minLevel = resolveMinLevel();
        this.info('system', 'boot', 'Logger online', { minLevel: this.minLevel });
    },

    setLevel(lvl) {
        if (LEVELS[lvl] != null) {
            this.minLevel = lvl;
            try { localStorage.setItem('cmwLogLevel', lvl); } catch (_) {}
        }
    },

    _ok(lvl) {
        return this.enabled && LEVELS[lvl] >= LEVELS[this.minLevel];
    },

    _push(lvl, cat, evt, msg, data, extra = {}) {
        if (!this._ok(lvl)) return null;
        const now = Date.now();
        const { frame, wave } = ctxFrame();
        const rec = {
            ts: now,
            t: new Date(now).toISOString(),
            lvl,
            cat: cat || 'system',
            evt: evt || 'log',
            msg: msg || '',
            frame,
            wave,
            data: data == null ? null : data,
            durMs: extra.durMs != null ? extra.durMs : null,
            stack: extra.stack || null,
        };
        this.ring.push(rec);
        if (this.ring.length > RING_MAX) this.ring.splice(0, this.ring.length - RING_MAX);
        this.queue.push(rec);
        if (this.queue.length >= BATCH_MAX) this.flush();
        else this._scheduleFlush();
        return rec;
    },

    _scheduleFlush() {
        if (this._flushTimer) return;
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null;
            this.flush();
        }, FLUSH_MS);
    },

    flush() {
        if (!this.queue.length) return;
        const lines = this.queue.splice(0, this.queue.length);
        try {
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lines }),
                keepalive: true,
            }).catch(() => {});
        } catch (_) {}
    },

    log(lvl, cat, evt, msg, data, extra) { return this._push(lvl, cat, evt, msg, data, extra); },
    debug(cat, evt, msg, data) { return this._push('debug', cat, evt, msg, data); },
    info(cat, evt, msg, data) { return this._push('info', cat, evt, msg, data); },
    warn(cat, evt, msg, data) { return this._push('warn', cat, evt, msg, data); },
    error(cat, evt, msg, data, stack) { return this._push('error', cat, evt, msg, data, { stack: stack || null }); },
    event(cat, evt, msg, data) { return this._push('info', cat, evt, msg, data); },

    time(label) {
        this._timers[label] = performance.now();
    },

    timeEnd(label, cat = 'perf', evt = 'timing', data = null) {
        const t0 = this._timers[label];
        if (t0 == null) return null;
        delete this._timers[label];
        const durMs = +(performance.now() - t0).toFixed(2);
        return this._push('info', cat, evt, label, data, { durMs });
    },

    getRecent(n = 100) {
        return this.ring.slice(-n);
    },
};

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => Logger.flush());
    window.addEventListener('pagehide', () => Logger.flush());
}
