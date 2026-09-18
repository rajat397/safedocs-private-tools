// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava — Commercial use: contact rajat242003@gmail.com
// tools/ocr/fixture.js — self-test fixture for OCR (vanilla ES module).
// FIXTURE_TEXT is the canonical string the acceptance check looks for.
// drawFixture(canvas) renders it big + high-contrast so local OCR finds it.
// Contract: no imports, no network.

export const FIXTURE_TEXT = 'HELLO OCR 123';

export function drawFixture(canvas, { text = FIXTURE_TEXT } = {}) {
  const w = 640, h = 200;
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#000000';
  c.font = 'bold 72px system-ui, sans-serif';
  c.textBaseline = 'middle';
  c.fillText(text, 40, h / 2);
  // underline to aid segmentation
  c.fillRect(40, h / 2 + 52, 560, 6);
  return canvas;
}

export default { FIXTURE_TEXT, drawFixture };
