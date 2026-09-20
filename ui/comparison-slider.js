// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Rajat Srivastava. Source-available - see /LICENSE. Commercial use requires permission: rajat242003@gmail.com.
/**
 * ui/comparison-slider.js — Side-by-side comparison slider component.
 * Mandatory for BG Removal and Upscaling tools to prove quality parity.
 * Shows original vs processed image with draggable divider.
 */

export function createComparisonSlider(options) {
  const { beforeSrc, afterSrc, beforeLabel = 'Before', afterLabel = 'After', onDownload, downloadFilename = 'comparison.png' } = options;

  const container = document.createElement('div');
  container.className = 'comparison-slider';
  container.style.cssText = `
    position: relative;
    width: 100%;
    max-width: 800px;
    margin: 16px auto;
    border-radius: 8px;
    overflow: hidden;
    background: #f5f5f5;
    font-family: system-ui, sans-serif;
  `;

  container.innerHTML = `
    <style>
      .comparison-slider * { box-sizing: border-box; }
      .comparison-slider .slider-track {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        max-height: 600px;
        overflow: hidden;
      }
      .comparison-slider .slider-image {
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        object-fit: contain;
        background: #fff;
      }
      .comparison-slider .slider-before {
        z-index: 2;
        clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
        transition: clip-path 0.1s linear;
      }
      .comparison-slider .slider-after {
        z-index: 1;
      }
      .comparison-slider .slider-handle {
        position: absolute;
        top: 0; bottom: 0; left: 50%;
        width: 4px;
        background: #fff;
        border: 2px solid #0f172a;
        border-radius: 2px;
        cursor: ew-resize;
        z-index: 3;
        pointer-events: none;
        transform: translateX(-50%);
        box-shadow: 0 0 8px rgba(0,0,0,0.3);
      }
      .comparison-slider .slider-handle::before,
      .comparison-slider .slider-handle::after {
        content: '';
        position: absolute;
        left: 50%;
        width: 24px; height: 24px;
        border: 2px solid #0f172a;
        border-radius: 50%;
        background: #fff;
        transform: translateX(-50%);
        pointer-events: auto;
      }
      .comparison-slider .slider-handle::before { top: calc(50% - 30px); }
      .comparison-slider .slider-handle::after { bottom: calc(50% - 30px); }
      .comparison-slider .slider-labels {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        background: #0f172a;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
      }
      .comparison-slider .slider-actions {
        display: flex;
        gap: 8px;
        padding: 12px;
        background: #fff;
        border-top: 1px solid #e2e8f0;
      }
      .comparison-slider .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
      }
      .comparison-slider .btn-primary {
        background: #0f172a;
        color: #fff;
      }
      .comparison-slider .btn-primary:hover { background: #1e293b; }
      .comparison-slider .btn-secondary {
        background: #e2e8f0;
        color: #0f172a;
      }
      .comparison-slider .btn-secondary:hover { background: #cbd5e1; }
      .comparison-slider .slider-badge {
        position: absolute;
        top: 8px; right: 8px;
        background: rgba(15, 23, 42, 0.9);
        color: #22c55e;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        z-index: 4;
        pointer-events: none;
      }
    </style>
    <div class="slider-track">
      <img class="slider-image slider-after" src="${afterSrc}" alt="${afterLabel}" />
      <img class="slider-image slider-before" src="${beforeSrc}" alt="${beforeLabel}" />
      <div class="slider-handle" aria-label="Drag to compare" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" tabindex="0"></div>
      <div class="slider-badge">Processed on your device</div>
    </div>
    <div class="slider-labels">
      <span class="label-before">${beforeLabel}</span>
      <span class="label-after">${afterLabel}</span>
    </div>
    <div class="slider-actions">
      <button class="btn btn-primary" data-action="download">Download Result</button>
      <button class="btn btn-secondary" data-action="reset">Reset View</button>
    </div>
  `;

  const beforeImg = container.querySelector('.slider-before');
  const handle = container.querySelector('.slider-handle');
  const track = container.querySelector('.slider-track');
  const downloadBtn = container.querySelector('[data-action="download"]');
  const resetBtn = container.querySelector('[data-action="reset"]');

  let isDragging = false;
  let startX = 0;
  let startPercent = 50;

  function updateSlider(percent) {
    const clamped = Math.max(0, Math.min(100, percent));
    beforeImg.style.clipPath = `polygon(0 0, ${clamped}% 0, ${clamped}% 100%, 0 100%)`;
    handle.style.left = `${clamped}%`;
    handle.setAttribute('aria-valuenow', String(Math.round(clamped)));
  }

  function onPointerDown(e) {
    isDragging = true;
    startX = e.clientX;
    startPercent = parseFloat(handle.style.left) || 50;
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const rect = track.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    updateSlider(percent);
  }

  function onPointerUp() {
    if (isDragging) {
      isDragging = false;
    }
  }

  handle.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', onPointerUp);
  track.addEventListener('pointerleave', onPointerUp);

  // Keyboard support
  handle.addEventListener('keydown', (e) => {
    let percent = parseFloat(handle.style.left) || 50;
    if (e.key === 'ArrowLeft') percent -= 5;
    else if (e.key === 'ArrowRight') percent += 5;
    else if (e.key === 'Home') percent = 0;
    else if (e.key === 'End') percent = 100;
    else return;
    updateSlider(percent);
    e.preventDefault();
  });

  // Touch support
  track.addEventListener('touchstart', (e) => onPointerDown(e.touches[0]), { passive: false });
  track.addEventListener('touchmove', (e) => onPointerMove(e.touches[0]), { passive: false });
  track.addEventListener('touchend', onPointerUp);

  // Download button
  downloadBtn.addEventListener('click', async () => {
    if (onDownload) {
      try {
        const response = await fetch(afterSrc);
        const blob = await response.blob();
        onDownload(blob, downloadFilename);
      } catch (e) {
        console.error('[comparison-slider] Download failed:', e);
      }
    } else {
      // Fallback: trigger download via anchor
      const a = document.createElement('a');
      a.href = afterSrc;
      a.download = downloadFilename;
      a.click();
    }
  });

  // Reset button
  resetBtn.addEventListener('click', () => updateSlider(50));

  // Cleanup
  container.destroy = () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    track.removeEventListener('pointermove', onPointerMove);
    track.removeEventListener('pointerup', onPointerUp);
    track.removeEventListener('pointerleave', onPointerUp);
    track.removeEventListener('touchstart', onPointerDown);
    track.removeEventListener('touchmove', onPointerMove);
    track.removeEventListener('touchend', onPointerUp);
  };

  return container;
}

export function mountComparisonSlider(
  parent,
  options
) {
  const slider = createComparisonSlider(options);
  parent.appendChild(slider);
  return {
    destroy: () => {
      slider.destroy?.();
      slider.remove();
    },
  };
}