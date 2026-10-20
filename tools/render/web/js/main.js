// Punkt wejścia strony renderującej — wystawia window.LIVEO.render(job) dla sterownika (Playwright).
import * as THREE from 'three';
import { Engine } from './engine.js';
import { setMaxAnisotropy } from './textures.js';
import * as TX from './textures.js';
import { renderPackshot } from './studio.js';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const engine = new Engine(canvas);
setMaxAnisotropy(Math.min(16, engine.renderer.capabilities.getMaxAnisotropy()));
THREE.ColorManagement.enabled = true;

async function renderTexture(job) {
  const t0 = performance.now();
  let tex;
  if (job.name === 'wood') tex = TX.woodTexture(job.color || '#c49a6c', job.style || 'oak', job.variant || 0).map;
  else if (job.name === 'floor') tex = TX.floorTexture(job.color || '#c9ab86', { size: job.size || 2048, sizeM: job.sizeM || 3.2 }).map;
  else if (job.name === 'plaster') tex = TX.plasterTexture(job.color || '#ece7df').data;
  else if (job.name === 'fabric') tex = TX.fabricTexture(job.style || 'linen').data;
  else if (job.name === 'rug') tex = TX.rugTexture(job).map;
  else if (job.name === 'art') tex = TX.artTexture(job.style || 'arches', job.palette || {});
  return { dataURL: tex.image.toDataURL('image/png'), info: { ms: performance.now() - t0 } };
}

window.LIVEO = {
  ready: true,
  engine,
  async render(job) {
    try {
      if (job.kind === 'packshot') return await renderPackshot(engine, job);
      if (job.kind === 'room') {
        const { renderRoom } = await import('./room.js');
        return await renderRoom(engine, job);
      }
      if (job.kind === 'texture') return await renderTexture(job);
      return { error: 'nieznany typ zadania: ' + job.kind };
    } catch (e) {
      console.error(e);
      return { error: String((e && e.stack) || e) };
    }
  },
};
