import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 32 * 1024 * 1024;

function ensureLogsDir(root) {
    const dir = path.join(root, 'logs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function logPath(root) {
    return path.join(ensureLogsDir(root), 'game.ndjson');
}

function rotateIfNeeded(file) {
    try {
        if (!fs.existsSync(file)) return;
        const st = fs.statSync(file);
        if (st.size < MAX_BYTES) return;
        const bak = file + '.1';
        if (fs.existsSync(bak)) fs.unlinkSync(bak);
        fs.renameSync(file, bak);
    } catch (_) {}
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function parseLines(raw) {
    const out = [];
    if (!raw || !raw.trim()) return out;
    try {
        const j = JSON.parse(raw);
        if (Array.isArray(j.lines)) return j.lines;
        if (Array.isArray(j)) return j;
        if (j && typeof j === 'object') return [j];
    } catch (_) {
        for (const line of raw.split('\n')) {
            const t = line.trim();
            if (!t) continue;
            try { out.push(JSON.parse(t)); } catch (_) {}
        }
    }
    return out;
}

function tailLines(file, n) {
    if (!fs.existsSync(file)) return [];
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n').filter(Boolean);
    const slice = lines.slice(-Math.max(1, n));
    const recs = [];
    for (const line of slice) {
        try { recs.push(JSON.parse(line)); } catch (_) {}
    }
    return recs;
}

function stats(file) {
    const byLvl = {};
    const byCat = {};
    let lines = 0;
    let size = 0;
    if (fs.existsSync(file)) {
        size = fs.statSync(file).size;
        const text = fs.readFileSync(file, 'utf8');
        for (const line of text.split('\n')) {
            if (!line.trim()) continue;
            lines++;
            try {
                const r = JSON.parse(line);
                byLvl[r.lvl] = (byLvl[r.lvl] || 0) + 1;
                byCat[r.cat] = (byCat[r.cat] || 0) + 1;
            } catch (_) {}
        }
    }
    return { lines, size, byLvl, byCat, path: file };
}

function sendJson(res, code, obj) {
    const body = JSON.stringify(obj);
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(body);
}

export function cmwLog() {
    return {
        name: 'cmw-log',
        configureServer(server) {
            const root = server.config.root || process.cwd();
            const file = logPath(root);
            if (!fs.existsSync(file)) fs.writeFileSync(file, '');

            server.middlewares.use(async (req, res, next) => {
                const url = req.url || '';
                if (!url.startsWith('/__cmw/log')) return next();

                if (req.method === 'OPTIONS') {
                    res.statusCode = 204;
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                    return res.end();
                }

                if (url.startsWith('/__cmw/log/tail') && req.method === 'GET') {
                    const u = new URL(url, 'http://127.0.0.1');
                    const n = Math.min(5000, Math.max(1, parseInt(u.searchParams.get('n') || '200', 10)));
                    return sendJson(res, 200, { lines: tailLines(file, n) });
                }

                if (url.startsWith('/__cmw/log/stats') && req.method === 'GET') {
                    return sendJson(res, 200, stats(file));
                }

                if (url.startsWith('/__cmw/log/clear') && req.method === 'POST') {
                    fs.writeFileSync(file, '');
                    return sendJson(res, 200, { ok: true });
                }

                if ((url === '/__cmw/log' || url.startsWith('/__cmw/log?')) && req.method === 'POST') {
                    try {
                        const raw = await readBody(req);
                        const lines = parseLines(raw);
                        if (lines.length) {
                            rotateIfNeeded(file);
                            const nd = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
                            fs.appendFileSync(file, nd);
                        }
                        return sendJson(res, 200, { ok: true, written: lines.length });
                    } catch (e) {
                        return sendJson(res, 500, { ok: false, error: String(e) });
                    }
                }

                return next();
            });
        },
    };
}

export default cmwLog;
