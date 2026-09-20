# EXECUTION PLAN — SafeDocs Image Tools MVP

## Phase 0: Architecture Foundation (Week 1-2)
- [ ] Core infrastructure files (owner: builder-arch)
- [ ] Model loader singleton (owner: builder-arch)
- [ ] Capability detector (owner: builder-arch)
- [ ] OPFS cache manager (owner: builder-arch)
- [ ] Comparison slider component (owner: builder-ui)

## Phase 1: Background Removal (Week 2-3)
- [ ] tools/image-bgremove/index.ts (owner: builder-bg)
- [ ] Worker: bgremove-worker.ts (owner: builder-bg)
- [ ] CDN pins for BEN2-ONNX/Transformers.js v4 (owner: builder-arch)
- [ ] Registry entry (owner: builder-arch)
- [ ] E2E smoke test (owner: builder-bg)

## Phase 2: AI Upscaling (Week 3-4)
- [ ] tools/image-upscale/index.ts (owner: builder-up)
- [ ] Worker: upscale-worker.ts (owner: builder-up)
- [ ] CDN pins for Real-CUGAN/web-realesrgan (owner: builder-arch)
- [ ] Tiled inference (256x256, 32px overlap)
- [ ] E2E smoke test

## Phase 3: Colorization (Week 4-5)
- [ ] tools/image-colorize/index.ts (owner: builder-col)
- [ ] Worker: colorize-worker.ts (owner: builder-col)
- [ ] CDN pins for DeOldify-q
- [ ] E2E smoke test

## Phase 4: Vectorization (Week 5-6)
- [ ] tools/image-vectorize/index.ts (owner: builder-vec)
- [ ] Worker: vectorize-worker.ts (owner: builder-vec)
- [ ] CDN pins for VTracer
- [ ] E2E smoke test

## Phase 5: Integration & Polish (Week 6-7)
- [ ] Cross-tool integration tests
- [ ] Mobile cap enforcement tests
- [ ] OPFS cache hit rate validation
- [ ] iOS WASM path verification
- [ ] Comparison slider polish
- [ ] Docs/CHANGELOG updates

## File Ownership Map (disjoint)
| File | Owner |
|------|-------|
| core/model-loader.ts | builder-arch |
| core/capability-detector.ts | builder-arch |
| core/opfs-cache.ts | builder-arch |
| core/registry.ts | builder-arch |
| ui/comparison-slider.ts | builder-ui |
| tools/image-bgremove/index.ts | builder-bg |
| tools/image-bgremove/bgremove-worker.ts | builder-bg |
| tools/image-upscale/index.ts | builder-up |
| tools/image-upscale/upscale-worker.ts | builder-up |
| tools/image-colorize/index.ts | builder-col |
| tools/image-colorize/colorize-worker.ts | builder-col |
| tools/image-vectorize/index.ts | builder-vec |
| tools/image-vectorize/vectorize-worker.ts | builder-vec |
| vendor/cdn-pins.js | builder-arch |
| tests/e2e/bgremove-smoke.spec.js | builder-bg |
| tests/e2e/upscale-smoke.spec.js | builder-up |
| tests/e2e/colorize-smoke.spec.js | builder-col |
| tests/e2e/vectorize-smoke.spec.js | builder-vec |

## Acceptance Criteria (measurable)
| Tool | Latency (desktop) | Latency (mobile) | Quality Gate | Privacy Gate |
|------|-------------------|------------------|--------------|--------------|
| BG Removal | < 3s @ 1MP | < 5s @ 1MP | IoU > 0.85 vs ground truth | Zero network after model load |
| Upscaling (2x) | < 4s @ 1MP | < 8s @ 1MP | PSNR > 28dB / SSIM > 0.85 | Zero network after model load |
| Colorization | < 3s @ 1MP | < 5s @ 1MP | ΔE < 15 vs reference | Zero network after model load |
| Vectorization | < 2s @ 1MP | < 4s @ 1MP | Hausdorff < 2px | Zero network after model load |
| **All** | Model load < 10s | Model load < 15s | — | OPFS hit rate > 90% |

## Research Needed
- [ ] Confirm BEN2-ONNX model URL and Transformers.js v4 compatibility
- [ ] Verify web-realesrgan WASM bundle size for mobile cap
- [ ] Validate DeOldify-q ONNX export exists and runs in browser
- [ ] Confirm VTracer WASM module size and licensing
- [ ] Benchmark OPFS vs IndexedDB on iOS Safari 17+
- [ ] Determine optimal tile size for Real-CUGAN on mobile GPUs