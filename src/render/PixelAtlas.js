import { forgeAsset } from './pixelForgeCore.js';
import { BITMAP_ASSETS, getVisual } from './visualManifest.js';

export class PixelAtlas {
    constructor(recipes = BITMAP_ASSETS) {
        this.recipes = recipes;
        this.assets = new Map();
        this.metadata = new Map();
    }

    build(documentRef = globalThis.document) {
        if(!documentRef) throw new Error('PixelAtlas.build requires a document');
        this.assets.clear();
        this.metadata.clear();
        for(const recipe of this.recipes) {
            const forged = forgeAsset(recipe);
            const canvas = documentRef.createElement('canvas');
            canvas.width = forged.width;
            canvas.height = forged.height;
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = false;
            const imageData = context.createImageData(forged.width, forged.height);
            imageData.data.set(forged.pixels);
            context.putImageData(imageData, 0, 0);
            this.assets.set(recipe.id, canvas);
            this.metadata.set(recipe.id, {
                id: recipe.id,
                width: forged.width,
                height: forged.height,
                anchor: forged.anchor,
                hash: forged.hash,
            });
        }
        return this;
    }

    get(id) {
        getVisual(id);
        const asset = this.assets.get(id);
        if(!asset) throw new Error(`PixelAtlas is not built or asset is not bitmap: ${id}`);
        return asset;
    }

    has(id) {
        return this.assets.has(id);
    }

    info(id) {
        return this.metadata.get(id) || getVisual(id);
    }
}

export const pixelAtlas = new PixelAtlas();
