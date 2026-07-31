const TRANSPARENT = [0, 0, 0, 0];

export function normalizeHex(value) {
    if(typeof value !== 'string' || !value.startsWith('#')) throw new Error(`Invalid color: ${value}`);
    const hex = value.slice(1);
    if(hex.length === 3 || hex.length === 4) {
        return `#${[...hex].map(char => char + char).join('')}`.toLowerCase();
    }
    if(hex.length === 6 || hex.length === 8) return `#${hex}`.toLowerCase();
    throw new Error(`Invalid hex color: ${value}`);
}

export function hexToRgba(value) {
    const hex = normalizeHex(value).slice(1);
    const withAlpha = hex.length === 6 ? `${hex}ff` : hex;
    return [
        Number.parseInt(withAlpha.slice(0, 2), 16),
        Number.parseInt(withAlpha.slice(2, 4), 16),
        Number.parseInt(withAlpha.slice(4, 6), 16),
        Number.parseInt(withAlpha.slice(6, 8), 16),
    ];
}

export function fnv1a(input) {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
    let hash = 0x811c9dc5;
    for(const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function seededRandom(seed) {
    let state = 2166136261;
    for(const char of String(seed)) {
        state ^= char.charCodeAt(0);
        state = Math.imul(state, 16777619);
    }
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function cellularMask({ width, height, seed, fillProbability = 0.45, steps = 2 }) {
    const random = seededRandom(seed);
    let cells = Array.from({ length: height }, () => (
        Array.from({ length: width }, () => random() < fillProbability ? '1' : '.')
    ));
    for(let step = 0; step < steps; step++) {
        cells = cells.map((row, y) => row.map((cell, x) => {
            let neighbors = 0;
            for(let oy = -1; oy <= 1; oy++) {
                for(let ox = -1; ox <= 1; ox++) {
                    if(ox === 0 && oy === 0) continue;
                    const nx = x + ox;
                    const ny = y + oy;
                    if(nx < 0 || ny < 0 || nx >= width || ny >= height || cells[ny][nx] !== '.') neighbors++;
                }
            }
            return neighbors >= 5 ? '1' : '.';
        }));
    }
    return cells.map(row => row.join(''));
}

function validateRows(rows) {
    if(!Array.isArray(rows) || rows.length === 0) throw new Error('Mask rows are required');
    const width = rows[0].length;
    if(width === 0 || rows.some(row => typeof row !== 'string' || row.length !== width)) {
        throw new Error('Mask rows must be non-empty strings with equal widths');
    }
    return { width, height: rows.length };
}

function outlineGrid(grid, semantic) {
    const height = grid.length;
    const width = grid[0].length;
    const result = grid.map(row => row.slice());
    for(let y = 0; y < height; y++) {
        for(let x = 0; x < width; x++) {
            if(grid[y][x] !== '.') continue;
            const touches = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([ox, oy]) => {
                const nx = x + ox;
                const ny = y + oy;
                return nx >= 0 && ny >= 0 && nx < width && ny < height && grid[ny][nx] !== '.';
            });
            if(touches) result[y][x] = semantic;
        }
    }
    return result;
}

function shadeGrid(grid, { semantic, fromSemantic = 'base', every = 2 }) {
    return grid.map((row, y) => row.map((cell, x) => (
        cell === fromSemantic && (x + y) % every === every - 1 ? semantic : cell
    )));
}

export function forgeAsset(recipe) {
    let rows = recipe.mask?.rows;
    if(recipe.mask?.type === 'cellular') rows = cellularMask(recipe.mask);
    const { width, height } = validateRows(rows);
    if(recipe.width !== undefined && recipe.width !== width) throw new Error(`${recipe.id}: width mismatch`);
    if(recipe.height !== undefined && recipe.height !== height) throw new Error(`${recipe.id}: height mismatch`);

    const symbols = recipe.mask?.semanticMap || { '1': 'base', '.': '.' };
    let grid = rows.map(row => [...row].map(symbol => symbols[symbol] ?? symbol));
    if(recipe.outline) grid = outlineGrid(grid, recipe.outline.semantic);
    if(recipe.shading) grid = shadeGrid(grid, recipe.shading);

    const pixels = new Uint8ClampedArray(width * height * 4);
    for(let y = 0; y < height; y++) {
        for(let x = 0; x < width; x++) {
            const semantic = grid[y][x];
            const rgba = semantic === '.' ? TRANSPARENT : hexToRgba(recipe.semanticColors[semantic]);
            pixels.set(rgba, (y * width + x) * 4);
        }
    }
    const anchor = normalizeAnchor(recipe.anchor || [0.5, 1]);
    const hashInput = new Uint8Array(pixels.length + 4);
    hashInput.set(pixels);
    hashInput.set([
        Math.round(anchor[0] * 255),
        Math.round(anchor[1] * 255),
        width & 255,
        height & 255,
    ], pixels.length);
    return { id: recipe.id, width, height, anchor, pixels, hash: fnv1a(hashInput), grid };
}

export function normalizeAnchor(anchor) {
    if(!Array.isArray(anchor) || anchor.length !== 2 || anchor.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
        throw new Error(`Invalid anchor: ${JSON.stringify(anchor)}`);
    }
    return [anchor[0], anchor[1]];
}

export function orphanPixels(asset) {
    const occupied = (x, y) => {
        if(x < 0 || y < 0 || x >= asset.width || y >= asset.height) return false;
        return asset.pixels[(y * asset.width + x) * 4 + 3] !== 0;
    };
    const orphans = [];
    for(let y = 0; y < asset.height; y++) {
        for(let x = 0; x < asset.width; x++) {
            if(!occupied(x, y)) continue;
            const connected = [-1, 0, 1].some(oy => [-1, 0, 1].some(ox => (
                (ox !== 0 || oy !== 0) && occupied(x + ox, y + oy)
            )));
            if(!connected) orphans.push([x, y]);
        }
    }
    return orphans;
}

export function validateTileEdges(tiles) {
    const errors = [];
    const opposite = { north: 'south', east: 'west', south: 'north', west: 'east' };
    const directions = Object.keys(opposite);
    for(const tile of tiles) {
        if(!tile.wang || directions.some(direction => typeof tile.wang[direction] !== 'string')) {
            errors.push(`${tile.id}: incomplete Wang metadata`);
            continue;
        }
        for(const adjacency of tile.adjacent || []) {
            const other = tiles.find(candidate => candidate.id === adjacency.id);
            if(!other) {
                errors.push(`${tile.id}: missing adjacent tile ${adjacency.id}`);
                continue;
            }
            if(tile.wang[adjacency.direction] !== other.wang[opposite[adjacency.direction]]) {
                errors.push(`${tile.id}: ${adjacency.direction} seam does not match ${other.id}`);
            }
        }
    }
    return errors;
}

export function stableStringify(value) {
    if(Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if(value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
