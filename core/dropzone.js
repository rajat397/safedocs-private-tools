// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * Reusable file dropzone. Drag & drop + click-to-browse + keyboard.
 * Files stay in memory — this module performs zero network I/O.
 */
import { checkFiles } from './caps.js';
import { fmtBytes, escapeHtml } from './utils.js';

export function createDropzone({
  accept = '*/*',
  multiple = true,
  toolId = '',
  label = 'Drop files here or click to browse',
  sub = 'Files never leave this device.',
  onFiles = () => {},
} = {}) {
  const root = document.createElement('div');
  root.className = 'dropzone';
  root.tabIndex = 0;
  root.setAttribute('role', 'button');
  root.setAttribute('aria-label', label);

  root.innerHTML = `
    <div class="dz-title">${escapeHtml(label)}</div>
    <div class="dz-sub">${escapeHtml(sub)}</div>
    <ul class="filelist" hidden></ul>`;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = !!multiple;
  input.hidden = true;
  root.append(input);

  const list = root.querySelector('.filelist');
  let dragDepth = 0;

  function renderSelection(result) {
    const items = [
      ...result.accepted.map((f) => `<li><span>${escapeHtml(f.name)}</span><span class="muted">${fmtBytes(f.size)}</span></li>`),
      ...result.rejected.map(({ file: f, reason }) => `<li class="rej"><span>${escapeHtml(f.name)}</span><span>${escapeHtml(reason)}</span></li>`),
    ];
    list.hidden = items.length === 0;
    list.innerHTML = items.join('');
  }

  function handle(raw) {
    const files = [...(raw || [])];
    if (!files.length) return;
    const result = checkFiles(files, { toolId, accept, multiple });
    renderSelection(result);
    if (result.accepted.length) onFiles(result.accepted, result);
  }

  root.addEventListener('click', (e) => {
    if (e.target !== input) input.click();
  });
  input.addEventListener('change', () => {
    handle(input.files);
    input.value = '';
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  root.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    root.classList.add('drag');
  });
  root.addEventListener('dragover', (e) => e.preventDefault());
  root.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (--dragDepth <= 0) { dragDepth = 0; root.classList.remove('drag'); }
  });
  root.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    root.classList.remove('drag');
    handle(e.dataTransfer?.files);
  });

  return {
    element: root,
    destroy() { root.remove(); },
  };
}
