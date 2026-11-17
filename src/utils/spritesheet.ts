export interface SpriteRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Split horizontal bands, then sprites within each band, using fully transparent gaps. */
export function detectSpriteRegions(pixels: Pick<ImageData, 'width' | 'height' | 'data'>): SpriteRegion[] {
    const { width, height, data } = pixels;
    const occupiedRows = new Uint8Array(height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3]) { occupiedRows[y] = 1; break; }
    }
    const regions: SpriteRegion[] = [];
    for (let y = 0; y < height; y++) {
        if (!occupiedRows[y]) continue;
        const top = y;
        while (y + 1 < height && occupiedRows[y + 1]) y++;
        const bottom = y;
        const columns = new Uint8Array(width);
        for (let py = top; py <= bottom; py++) for (let x = 0; x < width; x++) {
            if (data[(py * width + x) * 4 + 3]) columns[x] = 1;
        }
        for (let x = 0; x < width; x++) {
            if (!columns[x]) continue;
            const left = x;
            while (x + 1 < width && columns[x + 1]) x++;
            let spriteTop = bottom, spriteBottom = top;
            for (let py = top; py <= bottom; py++) for (let px = left; px <= x; px++) {
                if (!data[(py * width + px) * 4 + 3]) continue;
                spriteTop = Math.min(spriteTop, py);
                spriteBottom = Math.max(spriteBottom, py);
            }
            regions.push({ x: left, y: spriteTop, width: x - left + 1, height: spriteBottom - spriteTop + 1 });
            // Avoid allocating millions of regions for noisy images. Fall back to the grid.
            if (regions.length > 4096) return [];
        }
    }
    return regions;
}
