import { assertResources } from './editorResources';
import type { CanvasState, FrameData } from '../type/editor';
import { canvasToPixelData, loadPixelData, makeCanvas } from './pixelOps';

/** Append without replacing project metadata, tags, or existing artwork. */
export async function appendSpritesheet(current: CanvasState, imported: CanvasState): Promise<CanvasState> {
    const width = Math.max(current.width, imported.width);
    const height = Math.max(current.height, imported.height);
    assertResources({ ...current, width, height, frames: [...current.frames, ...imported.frames] }, current);
    const padFrames = async (source: CanvasState, align: 'center' | 'bottom-center'): Promise<FrameData[]> => {
        if (source.width === width && source.height === height) return source.frames;
        return Promise.all(source.frames.map(async frame => ({
            ...frame,
            layers: await Promise.all(frame.layers.map(async layer => {
                const image = await loadPixelData(layer.pixelData, source.width, source.height);
                if (!image) return layer;
                const canvas = makeCanvas(width, height);
                const x = Math.floor((width - source.width) / 2);
                const y = align === 'bottom-center' ? height - source.height : Math.floor((height - source.height) / 2);
                canvas.getContext('2d')!.drawImage(image, x, y);
                return { ...layer, pixelData: canvasToPixelData(canvas) };
            })),
        })));
    };
    const existing = await padFrames(current, 'center');
    const added = await padFrames(imported, 'bottom-center');
    return {
        ...current, width, height,
        frames: [...existing, ...added].map((frame, frameOrder) => ({ ...frame, frameOrder })),
    };
}
