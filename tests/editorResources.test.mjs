import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/editorResources.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { resourceError, projectResources, MAX_PROJECT_PIXELS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const project = (width, height, counts) => ({ width, height, frames: counts.map((n, i) => ({
    id: `frame-${i}`, layers: Array.from({ length: n }, () => ({ isVisible: false, pixelData: '' }))
})) });

test('counts hidden and empty layers across every frame', () => {
    assert.equal(projectResources(project(32, 64, [2, 3])).pixels, 32 * 64 * 5);
});
test('pixel budget allows the boundary and rejects one layer over', () => {
    assert.equal(resourceError(project(1024, 1024, [16])), null);
    assert.ok(resourceError(project(1024, 1024, [17])));
    assert.equal(projectResources(project(1024, 1024, [16])).pixels, MAX_PROJECT_PIXELS);
});
test('hard limits apply even to a one pixel canvas', () => {
    assert.equal(resourceError(project(1, 1, Array(100).fill(1))), null);
    assert.ok(resourceError(project(1, 1, Array(101).fill(1))));
    assert.equal(resourceError(project(1, 1, [20])), null);
    assert.ok(resourceError(project(1, 1, [21])));
});
test('oversized legacy projects can shrink or edit but cannot grow', () => {
    const old = project(1024, 1024, [22]);
    assert.equal(resourceError(project(1024, 1024, [21]), old), null);
    assert.equal(resourceError(old, old), null);
    assert.ok(resourceError(project(1024, 1024, [23]), old));
});
test('a duplicated frame with too many layers is rejected even if the peak is unchanged', () => {
    const old = project(1, 1, [21]);
    assert.ok(resourceError(project(1, 1, [21, 21]), old));
});
test('sheet expansion includes the cost of resizing existing layers', () => {
    const old = project(32, 32, [20]);
    assert.ok(resourceError(project(1024, 1024, [20, 1]), old));
});
