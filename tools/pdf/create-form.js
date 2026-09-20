// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/create-form.js — click-to-place AcroForm builder. pdf-lib only, static ES module.
import { shell } from '../_lib/page.js';
import { PINS } from '../../vendor/cdn-pins.js';

const PDF_LIB_PIN = PINS['pdf-lib']?.version || '1.17.1';
const PDF_LIB_ESM = PINS['pdf-lib']?.esm || ['https://esm.sh/pdf-lib@1.17.1'];
const PDF_LIB_UMD = PINS['pdf-lib']?.umd || [];
const PDFJS_UMD = PINS['pdf.js']?.umd || [];
const PDFJS_WORKER = PINS['pdf.js']?.worker || [];

export async function mount(el, ctx = {}) {
  const tool = (ctx && ctx.tool) || {};
  const page = shell(el, tool, ctx);
  const status = page.status;
  const setProgress = page.setProgress;
  const q = (s) => page.root.querySelector(`[data-f="${s}"]`);

  page.optionsEl.innerHTML = `
    <label>Password (if encrypted)
      <input type="password" data-f="pw" placeholder="Optional" />
    </label>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">New field</legend>
      <label>Type
        <select data-f="ftype">
          <option value="text">Text</option>
          <option value="checkbox">Checkbox</option>
          <option value="radio">Radio group</option>
          <option value="dropdown">Combo (dropdown)</option>
          <option value="button">Button</option>
          <option value="signature">Signature</option>
        </select>
      </label>
      <p class="muted" style="margin:0;font-size:12px">Click on the page preview to place the field. Click a placed field to select it, drag to move.</p>
    </fieldset>
    <fieldset style="border:1px solid var(--line);border-radius:8px;padding:10px;display:grid;gap:8px">
      <legend style="font-weight:600;font-size:13px">Properties <span class="muted" data-f="sel-label" style="font-weight:400"></span></legend>
      <label>Name <input type="text" data-f="name" value="field_1" /></label>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" data-f="required" /> Required
      </label>
      <label>Options (radio / combo, comma-separated)
        <input type="text" data-f="options" value="Yes,No" placeholder="Yes,No" />
      </label>
      <label>Font
        <select data-f="font">
          <option value="Helvetica">Helvetica</option>
          <option value="Times-Roman">Times Roman</option>
          <option value="Courier">Courier</option>
        </select>
      </label>
      <label>Font size <input type="number" data-f="size" value="12" min="6" max="72" step="1" /></label>
      <div class="btnrow">
        <button type="button" class="secondary" data-f="apply">Apply to selected</button>
        <button type="button" class="secondary" data-f="delete">Delete selected</button>
      </div>
    </fieldset>
    <label>Page
      <select data-f="page-select"><option value="0">Page 1</option></select>
    </label>
    <div data-f="list" style="display:grid;gap:6px"></div>`;

  const infoEl = document.createElement('div');
  infoEl.dataset.f = 'info';
  infoEl.className = 'muted';
  infoEl.style.cssText = 'font-size:13px;margin-bottom:8px';
  page.outputEl.append(infoEl);

  const canvasWrap = document.createElement('div');
  canvasWrap.dataset.f = 'canvas-wrap';
  canvasWrap.style.cssText = 'position:relative;border:1px solid var(--line);border-radius:8px;overflow:auto;background:#f8fafc;max-width:100%';
  page.outputEl.append(canvasWrap);

  const canvas = document.createElement('canvas');
  canvas.dataset.f = 'canvas';
  canvas.style.cssText = 'display:block;touch-action:none;cursor:crosshair;max-width:100%;height:auto';
  canvasWrap.appendChild(canvas);

  const overlay = document.createElement('div');
  overlay.dataset.f = 'overlay';
  overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none';
  canvasWrap.appendChild(overlay);

  let files = [];
  let pdfDoc = null;
  let pdfjsLib = null;
  let currentPageIndex = 0;
  let scale = 1.0;
  let viewport = null;
  let fields = [];
  let selectedId = null;
  let dragState = null;
  let seq = 0;

  const liveUrls = new Set();
  const track = (url) => { liveUrls.add(url); return url; };
  const revokeAll = () => { for (const u of liveUrls) { try { URL.revokeObjectURL(u); } catch {} } liveUrls.clear(); };

  function checkCaps(list, opts) {
    try {
      if (typeof ctx.checkFiles === 'function') {
        const r = ctx.checkFiles(list, opts);
        if (r && r.rejected && r.rejected.length) {
          status('Rejected: ' + r.rejected.map((x) => `${x.file?.name || 'file'}: ${x.reason}`).join(' | '));
        }
        return r;
      }
    } catch {}
    return null;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  async function loadPdfLib() {
    if (globalThis.PDFLib?.PDFDocument) return globalThis.PDFLib;
    try {
      const m = await import(PDF_LIB_ESM[0]);
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch {}
    for (const src of PDF_LIB_UMD) {
      try {
        await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        if (globalThis.PDFLib?.PDFDocument) return globalThis.PDFLib;
      } catch {}
    }
    throw new Error('Could not load pdf-lib@' + PDF_LIB_PIN);
  }

  async function loadPdfJs() {
    if (globalThis.pdfjsLib?.getDocument) return globalThis.pdfjsLib;
    for (const src of PDFJS_UMD) {
      try {
        await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        if (globalThis.pdfjsLib?.getDocument) {
          try { globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER[0]; } catch {}
          return globalThis.pdfjsLib;
        }
      } catch {}
    }
    throw new Error('Could not load pdf.js');
  }

  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) throw new Error('Not a PDF (missing %PDF header)');
  }

  async function openPdfWithPassword(lib, data, getPassword) {
    assertPdfHeader(data);
    const pw = (getPassword && getPassword()) || '';
    try {
      const task = lib.getDocument(pw ? { data: data.slice(), password: pw } : { data: data.slice() });
      return await task.promise;
    } catch (e) {
      if ((e && e.name === 'PasswordNeededException') || /password|encrypted/i.test(String((e && e.message) || e))) {
        if (!pw) throw new Error('This PDF is encrypted — enter its password and try again.');
        try { return await lib.getDocument({ data: data.slice(), password: pw }).promise; }
        catch (e2) { if (e2 && e2.name === 'PasswordNeededException') throw new Error('Wrong password for this encrypted PDF.'); throw new Error('Could not open encrypted PDF: ' + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }

  function defaultSize(type) {
    if (type === 'checkbox') return { w: 18, h: 18 };
    if (type === 'radio') return { w: 150, h: 44 };
    if (type === 'button') return { w: 110, h: 28 };
    if (type === 'signature') return { w: 160, h: 40 };
    if (type === 'dropdown') return { w: 160, h: 24 };
    return { w: 160, h: 22 };
  }

  function screenToPdf(x, y) {
    return { x: x / scale, y: (canvas.height - y) / scale };
  }

  function parseOptions(raw) {
    return String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  async function renderPage() {
    if (!pdfDoc) return;
    const pg = await pdfDoc.getPage(currentPageIndex + 1);
    viewport = pg.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = viewport.width + 'px';
    overlay.style.width = viewport.width + 'px';
    overlay.style.height = viewport.height + 'px';
    const c2d = canvas.getContext('2d');
    c2d.fillStyle = '#fff';
    c2d.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: c2d, viewport }).promise;
    renderOverlay();
  }

  function renderOverlay() {
    overlay.innerHTML = '';
    fields.filter((f) => f.page === currentPageIndex).forEach((f) => {
      const d = document.createElement('div');
      d.dataset.fid = f.id;
      d.title = `${f.name} (${f.type})`;
      d.style.cssText = `position:absolute;left:${f.x * scale}px;top:${canvas.height - (f.y + f.h) * scale}px;`
        + `width:${f.w * scale}px;height:${f.h * scale}px;border:2px ${f.id === selectedId ? 'solid' : 'dashed'} var(--blue);`
        + 'border-radius:4px;background:rgba(59,130,246,0.12);font-size:10px;color:var(--blue);'
        + 'display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:auto;cursor:move;white-space:nowrap';
      d.textContent = `${f.name} · ${f.type}`;
      overlay.appendChild(d);
    });
    renderList();
  }

  function renderList() {
    const list = q('list');
    if (!fields.length) { list.innerHTML = '<p class="muted" style="margin:0;font-size:12px">No fields yet — click the page to add one.</p>'; return; }
    list.innerHTML = '';
    fields.forEach((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'secondary';
      b.style.cssText = 'text-align:left;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' + (f.id === selectedId ? ';border-color:var(--blue)' : '');
      b.textContent = `p${f.page + 1} · ${f.name} (${f.type})${f.required ? ' *' : ''}`;
      b.addEventListener('click', () => { selectedId = f.id; syncProps(); renderOverlay(); });
      list.appendChild(b);
    });
    infoEl.textContent = pdfDoc ? `${pdfDoc.numPages} page(s) · ${fields.length} field(s) placed` : `${fields.length} field(s) placed`;
  }

  function syncProps() {
    const f = fields.find((x) => x.id === selectedId);
    try { q('sel-label').textContent = f ? `— editing ${f.name}` : ''; } catch {}
    if (!f) return;
    q('name').value = f.name;
    q('required').checked = !!f.required;
    q('options').value = (f.options || []).join(',');
    q('font').value = f.font;
    q('size').value = String(f.size);
    q('ftype').value = f.type;
  }

  function uniqueName(base) {
    const taken = new Set(fields.map((f) => f.name));
    if (!taken.has(base)) return base;
    let i = 2;
    while (taken.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  }

  canvasWrap.addEventListener('pointerdown', (e) => {
    if (!pdfDoc) return;
    const item = e.target.closest?.('[data-fid]');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (item?.dataset?.fid) {
      const f = fields.find((v) => v.id === item.dataset.fid);
      if (f) {
        selectedId = f.id;
        dragState = { id: f.id, startX: x, startY: y, fx: f.x, fy: f.y };
        syncProps();
        renderOverlay();
        e.preventDefault();
      }
      return;
    }
    if (e.target !== canvas) return;
    const type = q('ftype').value || 'text';
    const { w, h } = defaultSize(type);
    const pt = screenToPdf(x, y);
    seq += 1;
    const f = {
      id: `f${Date.now()}_${seq}`,
      name: uniqueName((q('name').value || 'field').trim().replace(/\s+/g, '_') || `field_${seq}`),
      type,
      page: currentPageIndex,
      x: Math.max(0, pt.x - w / 2),
      y: Math.max(0, pt.y - h / 2),
      w, h,
      required: !!q('required').checked,
      options: parseOptions(q('options').value),
      font: q('font').value || 'Helvetica',
      size: Math.max(6, Math.min(72, parseFloat(q('size').value) || 12)),
    };
    fields.push(f);
    selectedId = f.id;
    try { q('name').value = `field_${seq + 1}`; } catch {}
    status(`Added ${f.type} “${f.name}” on page ${f.page + 1}.`);
    renderOverlay();
  });

  window.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const f = fields.find((v) => v.id === dragState.id);
    if (!f) { dragState = null; return; }
    const dx = (x - dragState.startX) / scale;
    const dy = (y - dragState.startY) / scale;
    f.x = Math.max(0, dragState.fx + dx);
    f.y = Math.max(0, dragState.fy - dy);
    renderOverlay();
  });
  window.addEventListener('pointerup', () => { dragState = null; });

  q('apply').addEventListener('click', () => {
    const f = fields.find((x) => x.id === selectedId);
    if (!f) { status('Select a field first.'); return; }
    const nm = (q('name').value || '').trim().replace(/\s+/g, '_');
    if (nm && nm !== f.name) {
      if (fields.some((v) => v.id !== f.id && v.name === nm)) { status(`Name “${nm}” is already used.`); return; }
      if (f.type === 'radio') {
        const old = f.name;
        fields.forEach((v) => { if (v.type === 'radio' && v.name === old && v !== f) v.name = nm; });
      }
      f.name = nm;
    }
    f.required = !!q('required').checked;
    f.options = parseOptions(q('options').value);
    f.font = q('font').value || 'Helvetica';
    f.size = Math.max(6, Math.min(72, parseFloat(q('size').value) || 12));
    f.type = q('ftype').value || f.type;
    const ds = defaultSize(f.type);
    if (f.type === 'checkbox') { f.w = ds.w; f.h = ds.h; }
    status(`Updated “${f.name}”.`);
    renderOverlay();
  });

  q('delete').addEventListener('click', () => {
    if (!selectedId) { status('Nothing selected.'); return; }
    fields = fields.filter((f) => f.id !== selectedId);
    selectedId = null;
    renderOverlay();
  });

  q('page-select').addEventListener('change', async () => {
    currentPageIndex = parseInt(q('page-select').value, 10) || 0;
    setProgress(0);
    await renderPage().catch((e) => status('Error: ' + (e?.message || e)));
  });

  async function loadAndPreview(file) {
    status('Loading pdf.js…');
    setProgress(0.2);
    pdfjsLib = await loadPdfJs();
    pdfDoc = await openPdfWithPassword(pdfjsLib, new Uint8Array(await file.arrayBuffer()), () => q('pw').value);
    const sel = q('page-select');
    sel.innerHTML = '';
    const n = Math.min(pdfDoc.numPages, 50);
    for (let i = 0; i < n; i++) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `Page ${i + 1}`;
      sel.appendChild(o);
    }
    currentPageIndex = 0;
    setProgress(0.6);
    await renderPage();
    setProgress(1);
    status(`Loaded ${pdfDoc.numPages} page(s). Click the page to add ${q('ftype').value} fields.`);
  }

  page.onFiles(async (accepted) => {
    files = [...accepted];
    if (files[0]) {
      fields = [];
      selectedId = null;
      await loadAndPreview(files[0]).catch((err) => status('Error: ' + (err?.message || err)));
    }
  });

  function stdFont(pdfLib, name) {
    const SF = pdfLib.StandardFonts;
    if (name === 'Times-Roman') return SF.TimesRoman;
    if (name === 'Courier') return SF.Courier;
    return SF.Helvetica;
  }

  page.runBtn('Download form PDF', async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status('Pick a PDF.'); return; }
      const chk = checkCaps([f], { toolId: 'pdf-create-form', accept: '.pdf,application/pdf', multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;
      if (!fields.length) { status('Add at least one field first (click the page).'); return; }

      status('Loading pdf-lib…');
      setProgress(0.2);
      const pdfLib = await loadPdfLib();
      const bytes = new Uint8Array(await file.arrayBuffer());
      assertPdfHeader(bytes);
      const pdf = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = pdf.getForm();
      const pages = pdf.getPages();
      const helv = await pdf.embedFont(pdfLib.StandardFonts.Helvetica);
      const times = await pdf.embedFont(pdfLib.StandardFonts.TimesRoman);
      const courier = await pdf.embedFont(pdfLib.StandardFonts.Courier);
      const fontFor = (n) => (n === 'Times-Roman' ? times : n === 'Courier' ? courier : helv);

      const radioGroups = new Map();
      let created = 0;

      for (const fld of fields) {
        if (fld.page >= pages.length) continue;
        const pg = pages[fld.page];
        const { height: ph } = pg.getSize();
        // Stored coords use bottom-left origin in pdf.js points; pdf-lib uses bottom-left too.
        const yFlip = fld.y;
        void ph;
        const rect = { x: fld.x, y: yFlip, width: Math.max(8, fld.w), height: Math.max(8, fld.h) };
        try {
          if (fld.type === 'text' || fld.type === 'signature') {
            const tf = form.createTextField(fld.name);
            tf.addToPage(pg, rect);
            tf.setFontSize(fld.size || 12);
            if (fld.required) { try { tf.enableRequired(); } catch {} }
            try { tf.updateAppearances(fontFor(fld.font)); } catch {}
            if (fld.type === 'signature') { try { tf.setText(''); } catch {} }
          } else if (fld.type === 'checkbox') {
            const cb = form.createCheckBox(fld.name);
            cb.addToPage(pg, rect);
            if (fld.required) { try { cb.enableRequired(); } catch {} }
          } else if (fld.type === 'radio') {
            let g = radioGroups.get(fld.name);
            if (!g) { g = form.createRadioGroup(fld.name); radioGroups.set(fld.name, g); }
            const opts = fld.options.length ? fld.options : [fld.name];
            const rowH = rect.height / opts.length;
            opts.forEach((opt, i) => {
              g.addOptionToPage(opt, pg, { x: rect.x, y: rect.y + rect.height - rowH * (i + 1), width: Math.min(rect.width, rowH), height: rowH });
            });
            if (fld.required) { try { g.enableRequired(); } catch {} }
          } else if (fld.type === 'dropdown') {
            const dd = form.createDropdown(fld.name);
            dd.addToPage(pg, rect);
            const opts = fld.options.length ? fld.options : ['Option 1'];
            try { dd.setOptions(opts); } catch {}
            try { dd.select(opts[0]); } catch {}
            if (fld.required) { try { dd.enableRequired(); } catch {} }
            try { dd.updateAppearances(fontFor(fld.font)); } catch {}
          } else if (fld.type === 'button') {
            const btn = form.createButton(fld.name);
            btn.addToPage(pg, rect);
          }
          created++;
        } catch (err) {
          console.warn('create-form: skip field', fld.name, err);
        }
      }

      try { form.updateFieldAppearances(helv); } catch {}
      setProgress(0.8);
      const out = await pdf.save({ useObjectStreams: true });
      const blob = new Blob([out], { type: 'application/pdf' });
      const download = ctx.download || ((b, name) => {
        const url = track(URL.createObjectURL(b));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
      download(blob, file.name.replace(/\.pdf$/i, '') + '-form.pdf', 'application/pdf');
      status(`Done — ${created} field(s) created via pdf-lib form API.`);
      setProgress(1);
      try { q('pw').value = ''; } catch {}
    } catch (e) { status('Error: ' + (e?.message || e)); }
  });

  return () => {
    files = [];
    fields = [];
    selectedId = null;
    pdfDoc = null;
    revokeAll();
    try { q('pw').value = ''; } catch {}
    page.cleanup();
  };
}
