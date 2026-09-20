// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/pdf/fill-form.js — detect & fill AcroForm fields, flatten option. pdf-lib only, static ES module.
import { shell } from '../_lib/page.js';

const PDF_LIB_PIN = '1.17.1';

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
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
      <input type="checkbox" data-f="flatten" /> Flatten after fill (make fields non-editable)
    </label>
    <div data-f="fields" style="display:grid;gap:8px;margin-top:8px">
      <p class="muted" style="margin:0;font-size:12px">Load a PDF with form fields to see them here.</p>
    </div>`;

  const infoEl = document.createElement('div');
  infoEl.dataset.f = 'info';
  infoEl.className = 'muted';
  infoEl.style.cssText = 'font-size:13px;margin-bottom:8px';
  page.outputEl.append(infoEl);

  const previewEl = document.createElement('div');
  previewEl.dataset.f = 'preview';
  previewEl.style.cssText = 'border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#f8fafc;min-height:200px';
  page.outputEl.append(previewEl);

  let files = [];
  let pdfDoc = null;
  let pdfjsLib = null;
  let formFields = [];
  let fieldValues = {};
  let currentPageIndex = 0;
  let scale = 1.0;
  let viewport = null;

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

  async function loadPdfLib() {
    if (globalThis.PDFLib) return globalThis.PDFLib;
    try {
      const m = await import('https://esm.sh/pdf-lib@1.17.1');
      const lib = m.default ?? m;
      if (lib?.PDFDocument) { globalThis.PDFLib = lib; return lib; }
    } catch {}
    for (const src of [
      'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    ]) {
      try { await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); if (globalThis.PDFLib) return globalThis.PDFLib; } catch {}
    }
    throw new Error('Could not load pdf-lib@1.17.1');
  }

  async function loadPdfJs() {
    if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
    for (const src of [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    ]) {
      try {
        await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
        if (globalThis.pdfjsLib) {
          globalThis.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          return globalThis.pdfjsLib;
        }
      } catch {}
    }
    throw new Error('Could not load pdf.js');
  }

  function assertPdfHeader(bytes) {
    if (!bytes || bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46 || bytes[4] !== 0x2D) throw new Error('Not a PDF (missing %PDF header)');
  }

  async function openPdfWithPassword(pdfjsLib, data, getPassword) {
    assertPdfHeader(data);
    const pw = (getPassword && getPassword()) || '';
    try {
      const task = pdfjsLib.getDocument(pw ? { data: data.slice(), password: pw } : { data: data.slice() });
      return await task.promise;
    } catch (e) {
      if ((e && e.name === 'PasswordNeededException') || /password|encrypted/i.test(String((e && e.message) || e))) {
        if (!pw) throw new Error('This PDF is encrypted — enter its password and try again.');
        try { return await pdfjsLib.getDocument({ data: data.slice(), password: pw }).promise; }
        catch (e2) { if (e2 && e2.name === 'PasswordNeededException') throw new Error('Wrong password for this encrypted PDF.'); throw new Error('Could not open encrypted PDF: ' + ((e2 && e2.message) || e2)); }
      }
      throw e;
    }
  }

  async function extractFormFields(pdfLib, pdfBytes) {
    const pdf = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const fields = form.getFields();
    const result = [];

    for (const field of fields) {
      const type = field.constructor.name;
      let fieldType = 'text';
      let options = [];

      if (type === 'PDFCheckBox') fieldType = 'checkbox';
      else if (type === 'PDFRadioGroup') fieldType = 'radio';
      else if (type === 'PDFDropdown') fieldType = 'dropdown';
      else if (type === 'PDFOptionList') fieldType = 'listbox';
      else if (type === 'PDFTextField') fieldType = field.getMaxLength() === 1 ? 'text' : (field.isMultiline() ? 'textarea' : 'text');
      else if (type === 'PDFButton') fieldType = 'button';
      else if (type === 'PDFSig') fieldType = 'signature';

      if (fieldType === 'dropdown' || fieldType === 'listbox') {
        options = field.getOptions();
      } else if (fieldType === 'radio') {
        options = field.getOptions();
      }

      const widgets = field.getWidgets();
      const pageRefs = widgets.map(w => w.getPageRef?.());
      const pageIndices = pageRefs.map(ref => {
        if (!ref) return 0;
        try { return pdf.getPageIndex(ref); } catch { return 0; }
      });
      const uniquePages = [...new Set(pageIndices)];

      result.push({
        name: field.getName(),
        type: fieldType,
        value: fieldType === 'checkbox' ? field.isChecked() : (field.getText?.() || ''),
        options,
        required: field.isRequired?.() || false,
        pages: uniquePages,
        widgets: widgets.map(w => ({
          rect: w.getRectangle?.(),
          page: w.getPageRef?.()
        }))
      });
    }
    return result;
  }

  async function renderPreview(pdf, pageNum) {
    const pg = await pdf.getPage(pageNum);
    viewport = pg.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.cssText = 'display:block;max-width:100%;height:auto';
    const c2d = canvas.getContext('2d');
    c2d.fillStyle = '#fff';
    c2d.fillRect(0, 0, canvas.width, canvas.height);
    await pg.render({ canvasContext: c2d, viewport }).promise;
    previewEl.innerHTML = '';
    previewEl.appendChild(canvas);

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;top:0;left:0;width:' + viewport.width + 'px;height:' + viewport.height + 'px;pointer-events:none';
    previewEl.style.position = 'relative';
    previewEl.appendChild(overlay);

    formFields.filter(f => f.pages.includes(pageNum - 1)).forEach(field => {
      field.widgets.forEach((w, wi) => {
        if (w.page && w.rect) {
          try {
            const pageIdx = pdf.getPageIndex(w.page);
            if (pageIdx === pageNum - 1) {
              const [x, y, x2, y2] = w.rect;
              const div = document.createElement('div');
              div.style.cssText = `position:absolute;left:${x}px;top:${viewport.height - y2}px;width:${x2 - x}px;height:${y2 - y}px;border:2px dashed var(--blue);background:rgba(59,130,246,0.1);font-size:10px;color:var(--blue);display:flex;align-items:center;justify-content:center;pointer-events:none`;
              div.title = field.name;
              div.textContent = field.name;
              overlay.appendChild(div);
            }
          } catch {}
        }
      });
    });
  }

  function buildFieldUI() {
    const container = q('fields');
    container.innerHTML = '';

    if (!formFields.length) {
      container.innerHTML = '<p class="muted" style="margin:0;font-size:12px">No form fields found in this PDF.</p>';
      return;
    }

    formFields.forEach((field, idx) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'padding:10px;border:1px solid var(--line);border-radius:8px;background:#fff;display:grid;gap:6px';
      wrapper.dataset.fieldIdx = idx;

      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';
      header.innerHTML = `
        <strong style="font-size:13px">${escapeHtml(field.name)}</strong>
        <span class="pill" style="font-size:10px">${field.type}</span>
        ${field.required ? '<span class="pill red" style="font-size:10px">Required</span>' : ''}
        <span class="muted" style="font-size:11px;margin-left:auto">Pages: ${field.pages.map(p => p + 1).join(', ')}</span>
      `;
      wrapper.appendChild(header);

      let input;
      if (field.type === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = field.value;
        input.dataset.fieldIdx = idx;
      } else if (field.type === 'radio') {
        const group = document.createElement('div');
        group.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap';
        field.options.forEach(opt => {
          const label = document.createElement('label');
          label.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `field-${idx}`;
          radio.value = opt;
          radio.checked = field.value === opt;
          radio.dataset.fieldIdx = idx;
          label.appendChild(radio);
          label.appendChild(document.createTextNode(opt));
          group.appendChild(label);
        });
        input = group;
      } else if (field.type === 'dropdown' || field.type === 'listbox') {
        input = document.createElement('select');
        if (field.type === 'listbox') input.multiple = true;
        input.dataset.fieldIdx = idx;
        field.options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          o.selected = field.value === opt;
          input.appendChild(o);
        });
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.value = field.value || '';
        input.dataset.fieldIdx = idx;
        input.style.cssText = 'min-height:60px;padding:8px;border:1px solid var(--line);border-radius:8px;font-size:14px';
      } else if (field.type === 'signature') {
        input = document.createElement('div');
        input.innerHTML = '<button type="button" class="secondary" data-sig-field="' + idx + '">Draw signature</button>';
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 100;
        canvas.style.cssText = 'border:1px solid var(--line);border-radius:4px;margin-top:4px;display:none';
        canvas.dataset.sigCanvas = idx;
        input.appendChild(canvas);
        input.querySelector('button').addEventListener('click', () => openSigCanvas(idx, canvas));
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = field.value || '';
        input.dataset.fieldIdx = idx;
        input.style.cssText = 'padding:8px;border:1px solid var(--line);border-radius:8px;font-size:14px';
      }

      if (input && input.nodeName !== 'DIV') {
        input.style.cssText = 'padding:8px;border:1px solid var(--line);border-radius:8px;font-size:14px';
        wrapper.appendChild(input);
      } else if (input) {
        wrapper.appendChild(input);
      }

      container.appendChild(wrapper);
    });

    container.addEventListener('change', (e) => {
      const target = e.target.closest('[data-field-idx]');
      if (!target) return;
      const idx = parseInt(target.dataset.fieldIdx);
      const field = formFields[idx];
      if (field.type === 'checkbox') fieldValues[field.name] = target.checked;
      else if (field.type === 'radio') fieldValues[field.name] = target.value;
      else if (field.type === 'dropdown' || field.type === 'listbox') {
        if (target.multiple) fieldValues[field.name] = Array.from(target.selectedOptions).map(o => o.value);
        else fieldValues[field.name] = target.value;
      } else if (field.type !== 'signature') {
        fieldValues[field.name] = target.value;
      }
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&', '<': '<', '>': '>', '"': '"', "'": ''',
    }[c]));
  }

  function openSigCanvas(fieldIdx, canvas) {
    canvas.style.display = 'block';
    const c2d = canvas.getContext('2d');
    c2d.fillStyle = '#fff';
    c2d.fillRect(0, 0, canvas.width, canvas.height);
    c2d.strokeStyle = '#0f172a';
    c2d.lineWidth = 2;
    c2d.lineCap = 'round';
    c2d.lineJoin = 'round';

    let drawing = false, last = null;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const p = e.touches?.[0] ?? e;
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    };
    const down = (e) => { e.preventDefault(); drawing = true; last = pos(e); c2d.beginPath(); c2d.moveTo(last.x, last.y); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const p = pos(e); c2d.lineTo(p.x, p.y); c2d.stroke(); c2d.beginPath(); c2d.moveTo(p.x, p.y); last = p; };
    const up = () => { drawing = false; last = null; };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.dataset.listeners = '1';

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'secondary';
    doneBtn.style.marginTop = '4px';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => {
      canvas.toBlob(blob => {
        fieldValues[formFields[fieldIdx].name] = blob;
        canvas.style.display = 'none';
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', up);
      }, 'image/png');
    });
    canvas.parentNode.insertBefore(doneBtn, canvas.nextSibling);
  }

  async function loadAndPreview(file) {
    status('Loading pdf.js…');
    pdfjsLib = await loadPdfJs();
    pdfDoc = await openPdfWithPassword(pdfjsLib, new Uint8Array(await file.arrayBuffer()), () => q('pw').value);

    status('Loading pdf-lib…');
    const pdfLib = await loadPdfLib();
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    formFields = await extractFormFields(pdfLib, pdfBytes);
    fieldValues = {};

    q('info').textContent = `${pdfDoc.numPages} page(s) · ${formFields.length} form field(s) detected`;
    buildFieldUI();

    const pageSelect = document.createElement('select');
    pageSelect.dataset.f = 'page-nav';
    pageSelect.style.cssText = 'margin-bottom:8px;padding:6px;border:1px solid var(--line);border-radius:6px';
    for (let i = 1; i <= Math.min(pdfDoc.numPages, 20); i++) {
      const opt = document.createElement('option');
      opt.value = i - 1;
      opt.textContent = `Page ${i}`;
      pageSelect.appendChild(opt);
    }
    previewEl.insertBefore(pageSelect, previewEl.firstChild);
    pageSelect.addEventListener('change', () => {
      currentPageIndex = parseInt(pageSelect.value);
      renderPreview(pdfDoc, currentPageIndex + 1);
    });
    await renderPreview(pdfDoc, 1);
  }

  page.onFiles(async (accepted) => {
    files = [...accepted];
    if (files[0]) {
      formFields = [];
      fieldValues = {};
      await loadAndPreview(files[0]).catch(err => status('Error: ' + (err?.message || err)));
    }
  });

  page.runBtn('Fill & download', async (got) => {
    try {
      files = [...(got || [])];
      const f = files[0];
      if (!f) { status('Pick a PDF.'); return; }
      const chk = checkCaps([f], { toolId: 'pdf-fill-form', accept: '.pdf,application/pdf', multiple: false });
      const file = (chk && chk.accepted && chk.accepted.length) ? chk.accepted[0] : f;
      if (chk && chk.accepted && !chk.accepted.length) return;

      status('Loading pdf-lib…');
      const pdfLib = await loadPdfLib();
      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const form = pdf.getForm();

      for (const field of formFields) {
        const value = fieldValues[field.name];
        if (value === undefined) continue;

        try {
          const pdfField = form.getField(field.name);
          if (field.type === 'checkbox') {
            if (value) pdfField.check(); else pdfField.uncheck();
          } else if (field.type === 'radio') {
            pdfField.select(value);
          } else if (field.type === 'dropdown' || field.type === 'listbox') {
            if (Array.isArray(value)) pdfField.select(...value); else pdfField.select(value);
          } else if (field.type === 'signature' && value instanceof Blob) {
            const pngBytes = new Uint8Array(await value.arrayBuffer());
            const png = await pdf.embedPng(pngBytes);
            const widgets = pdfField.getWidgets();
            if (widgets.length) {
              const widget = widgets[0];
              const rect = widget.getRectangle();
              widget.setImage(png);
            }
          } else {
            pdfField.setText(String(value));
          }
        } catch (e) {
          console.warn('Failed to fill field', field.name, e);
        }
      }

      if (q('flatten').checked) {
        form.flatten();
      }

      const bytes = await pdf.save({ useObjectStreams: true });
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const download = ctx.download || ((b, name, mime) => {
        const url = track(URL.createObjectURL(b));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
      });
      download(blob, file.name.replace(/\.pdf$/i, '') + '-filled.pdf', 'application/pdf');
      status(`Done — ${Object.keys(fieldValues).length} field(s) filled${q('flatten').checked ? ' and flattened' : ''}.`);
      try { q('pw').value = ''; } catch {}
    } catch (e) { status('Error: ' + (e?.message || e)); }
  });

  return () => {
    files = [];
    formFields = [];
    fieldValues = {};
    revokeAll();
    try { q('pw').value = ''; } catch {}
    page.cleanup();
  };
}