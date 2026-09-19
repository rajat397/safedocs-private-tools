# SCOPE PROPOSAL: Premium Image Tools for SafeDocs/Private Toolbox

**Date:** 2026-09-20  
**Project:** SafeDocs / Private Toolbox (privacy-first, 100% on-device, zero upload)  
**Current State:** 34 tools across 10 categories. Image tools: Convert (JPEG/PNG/WebP), EXIF Inspector (view & strip), Compress (resize + re-encode)  
**Goal:** Extend to match premium paid image tool functionality — privacy-first, honest limits, verify-don't-trust, super user-friendly

---

## 1. TOP 15 PREMIUM IMAGE FEATURES (with paid tool examples & pricing)

| # | Premium Feature | Top 3 Paid Tools Charging for This | Pricing Model | Typical Price | Free Tier? |
|---|----------------|-----------------------------------|---------------|---------------|------------|
| 1 | **Background Removal** | remove.bg, PhotoRoom Pro, Canva Pro | Per-image credits / Subscription | $0.001–$0.02/img (API); $9.99–$14.99/mo (Pro) | Yes (low-res, watermarked) |
| 2 | **AI Upscaling (2×–4×, up to 16×)** | Topaz Gigapixel AI, Upscayl Pro, Let's Enhance | One-time / Subscription / Credits | $99 (Topaz perpetual); $4.50–$39/mo (Upscayl); $9–$24/mo (Let's Enhance) | Yes (watermarked, capped) |
| 3 | **AI Denoising / Sharpening** | Topaz DeNoise AI, DxO DeepPRIME, Adobe Lightroom | One-time / Subscription | $79–$199 (Topaz); $199 (DxO); $19.99/mo (Adobe) | Limited (Adobe 7-day trial) |
| 4 | **Object Removal / Inpainting** | Photoshop Generative Fill, Cleanup.pictures, Luminar Neo | Subscription / Credits | $19.99/mo (PS); $0.01–$0.05/img (Cleanup); $129 (Luminar perpetual) | Yes (watermarked, limited) |
| 5 | **Face Enhancement / Restoration** | GFPGAN (API), CodeFormer (API), Topaz Photo AI | Credits / One-time | $0.01–$0.05/img (APIs); $199 (Topaz) | Demo only |
| 6 | **RAW Processing** | Capture One, DxO PhotoLab, Adobe Lightroom | Subscription / Perpetual | $299 (Capture One); $199 (DxO); $19.99/mo (Adobe) | 30-day trial |
| 7 | **HDR / Exposure Blending** | Aurora HDR, Photomatix Pro, Lightroom HDR | One-time | $99 (Aurora); $99 (Photomatix); included in LR | Trial only |
| 8 | **Color Grading / LUTs** | DaVinci Resolve Studio, Luminar, Capture One | One-time / Subscription | $295 (DaVinci); $129 (Luminar); $299 (C1) | Free tier (DaVinci) |
| 9 | **Sky Replacement** | Luminar Neo, Photoshop, ON1 Photo RAW | One-time / Subscription | $129 (Luminar); $19.99/mo (PS); $99 (ON1) | No |
| 10 | **Batch Processing / Automation** | Photoshop Actions, Lightroom Presets, PhotoRoom Batch | Subscription | $19.99/mo (PS); $14.99/mo (Canva); $9.99/mo (PhotoRoom) | Limited |
| 11 | **Panorama Stitching** | PTGui, Hugin (free), Photoshop | One-time | $149 (PTGui); free (Hugin); $19.99/mo (PS) | Hugin is free/OSS |
| 12 | **Focus Stacking** | Helicon Focus, Zerene Stacker, Photoshop | One-time | $115 (Helicon); $89 (Zerene); $19.99/mo (PS) | Trial only |
| 13 | **Lens Correction / Geometry** | DxO ViewPoint, PTLens, Lightroom | One-time / Subscription | $99 (DxO); $25 (PTLens); $19.99/mo (LR) | Trial only |
| 14 | **AI Style Transfer / Neural Filters** | Photoshop Neural Filters, Luminar AI, Topaz Studio | Subscription | $19.99/mo (PS); $129 (Luminar); $99 (Topaz) | Limited free filters |
| 15 | **Watermark Removal** | WatermarkRemover.io, Inpaint, SnapEdit | Credits / Subscription | $0.01–$0.10/img; $6–$25/mo | Yes (watermarked output) |

**Sources:** remove.bg pricing, PhotoRoom pricing, Upscayl pricing, Topaz Labs pricing, Canva Pro pricing, Luminar Neo pricing, Adobe Photography Plan pricing, SnapEdit pricing, EdMyPic pricing, tasarim.ai tool comparison (2026).

---

## 2. FEASIBILITY ASSESSMENT: ON-DEVICE BROWSER VIABILITY (WebAssembly / WebGPU)

| # | Feature | Viability | Key Libraries / Models | Model Size (ONNX) | Mobile WebGPU Support | Notes |
|---|---------|-----------|------------------------|-------------------|----------------------|-------|
| 1 | **Background Removal** | ✅ **HIGH** | u2netp (4.7 MB), RMBG-1.4 (~170 MB fp32, ~44M params), MODNet (~20 MB), BEN2 | 4.7–170 MB | ✅ Chrome/Edge Android, ❌ iOS/Safari | u2netp is production-ready in browser (rembg-webgpu, transformers.js). RMBG-1.4 higher quality but 170 MB download. |
| 2 | **AI Upscaling** | ✅ **HIGH** | Real-ESRGAN (general-x4v3 ~64 MB, anime 6B ~17 MB), SwinIR (~110 MB SR, ~45 MB denoise), UltraSharp (~64 MB) | 17–110 MB | ✅ Chrome/Edge Android, ❌ iOS/Safari | Real-ESRGAN general-x4v3 runs in browser today (real-esrgan.org). Tiled inference needed for >2MP images. |
| 3 | **AI Denoising / Sharpening** | ✅ **HIGH** | SwinIR denoising (~45 MB), NAFNet (~20–60 MB), Restormer (large), Kim2091 DeJPEG (~9 MB) | 9–110 MB | ✅ Chrome/Edge Android | SwinIR color denoising at σ=25 is 45 MB. NAFNet smaller but less tested in browser. |
| 4 | **Object Removal / Inpainting** | ⚠️ **MEDIUM** | LaMa (big-lama ~100 MB, fixed 512×512), Moebius (~1.27 GB!), MAT, Stable Diffusion Inpainting (~2–4 GB) | 100 MB – 4 GB | ⚠️ WebGPU only, VRAM heavy | LaMa is only viable on-device model (100 MB, 512×512 fixed). Moebius/SD too large for browser. Needs tiling for large images. |
| 5 | **Face Enhancement** | ⚠️ **MEDIUM** | CodeFormer (~50 MB + face detection), GFPGAN (~50 MB + face detection), GPEN (~30 MB) | 30–100 MB (total pipeline) | ⚠️ WebGPU only | Requires face detection (BlazeFace/MediaPipe ~3 MB) + restoration model. Two-stage pipeline. |
| 6 | **RAW Processing** | ❌ **LOW** | libraw (WASM), raw.js, custom demosaicing | N/A (algorithmic) | ✅ WASM works everywhere | Demosaicing + color science is CPU-bound. WASM viable but complex. No ML model needed. |
| 7 | **HDR / Exposure Blending** | ✅ **HIGH** | Algorithmic (no ML) — Mertens fusion, exposure fusion | N/A | ✅ WASM/WebGPU | Pure image processing. Can use WebGPU compute shaders for speed. |
| 8 | **Color Grading / LUTs** | ✅ **HIGH** | 3D LUT application (WebGL/WebGPU fragment shader) | <1 MB (LUT files) | ✅ All browsers | Trivial GPU shader work. No ML. |
| 9 | **Sky Replacement** | ⚠️ **MEDIUM** | Segmentation (RMBG/u2net) + sky detection + blending | ~50–170 MB | ⚠️ WebGPU only | Composite of segmentation + harmonization. Sky detection needs separate model. |
| 10 | **Batch Processing** | ✅ **HIGH** | Queue + Web Workers + existing models | N/A | ✅ All | Architecture feature, not a model. |
| 11 | **Panorama Stitching** | ✅ **HIGH** | OpenCV.js (WASM), custom feature matching | ~10 MB (OpenCV.js) | ✅ WASM | Heavy CPU compute. WASM viable but slow on mobile. |
| 12 | **Focus Stacking** | ⚠️ **MEDIUM** | OpenCV.js (WASM) — alignment + blending | ~10 MB | ✅ WASM | Alignment is compute-heavy. Better on desktop. |
| 13 | **Lens Correction** | ✅ **HIGH** | Algorithmic (Brown-Conrady model), lensfun database (WASM) | <5 MB (lens DB) | ✅ WASM | No ML. Database of lens profiles + distortion correction math. |
| 14 | **Style Transfer / Neural Filters** | ⚠️ **MEDIUM** | AdaIN, WCT, or small stylization nets (~10–50 MB) | 10–50 MB | ⚠️ WebGPU | Fast style transfer nets are small. Quality vs. Photoshop filters is gap. |
| 15 | **Watermark Removal** | ⚠️ **MEDIUM** | Inpainting (LaMa) + detection | ~100 MB | ⚠️ WebGPU | Same as object removal. Detection model adds complexity. |

**Key Technical Sources:**
- ONNX Runtime Web WebGPU support matrix: Chrome/Edge (Win/Mac/Android) ✅, Safari/iOS ❌, Firefox ❌ (as of 2024)
- WebGPU global support ~70% (caniuse.com, Oct 2024)
- Transformers.js + ONNX Runtime Web = primary browser ML stack
- ONNX Runtime Web WASM fallback works everywhere (including iOS/Safari)
- Tiled inference mandatory for >512×512 on mobile (VRAM limits)

---

## 3. RECOMMENDED MVP WEDGE (3–5 Tools)

### **MVP WEDGE: "The Privacy-First Power Trio"**

| Priority | Tool | Why This Wins | Model(s) | Est. Bundle Impact | Mobile Strategy |
|----------|------|---------------|----------|-------------------|-----------------|
| **1** | **Background Removal (Pro)** | #1 paid feature; u2netp 4.7 MB is tiny; users *feel* magic instantly; e-commerce/avatar use cases drive viral adoption | u2netp.onnx (4.7 MB, Apache-2.0) — primary; RMBG-1.4 (170 MB, non-commercial) as "Max Quality" opt-in | **+5 MB** (WASM) / **+5 MB + 170 MB lazy** (WebGPU) | u2netp runs fast on WASM (~300ms CPU). WebGPU ~30ms. Lazy-load RMBG only when user clicks "Max Quality". |
| **2** | **AI Upscaling (2×/4× Photo + Anime)** | Topaz Gigapixel is $99; Real-ESRGAN general-x4v3 (64 MB) matches quality; anime model (17 MB) covers illustrations; users pay for this daily | realesr-general-x4v3.onnx (64 MB, BSD-3); realesrgan-x4plus-anime.onnx (17 MB) | **+80 MB** (lazy-loaded per model) | Tiled inference (256×256 tiles). 2× mode for mobile. WebGPU 2–5s per megapixel; WASM 10–30s. Show honest time estimate. |
| **3** | **AI Denoising + JPEG Artifact Removal** | Topaz DeNoise is $79; SwinIR color denoising (45 MB) + Kim2091 DeJPEG (9 MB) cover the two biggest "fix my photo" pains; runs on same SwinIR architecture as upscaling | swinir_denoising_color_25.onnx (45 MB); Kim2091-DeJpeg-v0.onnx (9 MB) | **+54 MB** | Same tiling strategy. Denoising is 128×128 tiles — faster than upscaling. |
| **4** | **Object Removal (LaMa Inpainting)** | Photoshop Generative Fill is $20/mo; LaMa (100 MB) is only viable on-device inpainting; 512×512 fixed input → tile large images | lama_fp32.onnx (100 MB, Apache-2.0) | **+100 MB** | **Desktop-first**. Mobile: warn "best on desktop", process in 512×512 tiles. WebGPU required (WASM too slow). |
| **5** | **Batch Queue + Presets** | PhotoRoom Pro charges $9.99/mo for batch; this is pure architecture — no model cost; makes tools 1–3 feel "pro" | N/A (JS logic) | **+0 MB** | Works everywhere. Web Workers for parallelism. |

**Total MVP Model Footprint:** ~240 MB (lazy-loaded, not in initial bundle)  
**Initial JS Bundle:** ~2 MB (ONNX Runtime Web WASM ~1 MB + app logic)  
**WebGPU Bundle:** ~3 MB (ort.webgpu.min.js)

**Rationale for Wedge:**
1. **Background Removal** — highest user intent, smallest model, works on WASM (universal)
2. **Upscaling** — highest willingness-to-pay ($99 Topaz), Real-ESRGAN is SOTA open
3. **Denoise/DeJPEG** — adjacent to upscaling (same SwinIR family), solves "blurry photo" + "JPEG artifacts" in one tool
4. **Object Removal** — differentiates from Canva/PhotoRoom (they do BG removal but not object removal on-device)
5. **Batch** — turns single-image tools into workflow; zero model cost

**Deferred to v2+:** Face restoration (needs face detect pipeline), RAW processing (complex color science), Sky replacement (needs sky segmentation), HDR/panorama/focus stacking (algorithmic but niche), Lens correction (database licensing), Neural filters (quality gap vs. Photoshop).

---

## 4. TECHNICAL REQUIREMENTS

### Core Stack
| Component | Version / Spec | CDN Pin (SRI) | Notes |
|-----------|----------------|---------------|-------|
| **ONNX Runtime Web (WASM)** | `onnxruntime-web@1.19+` | `sha384-<hash>` from jsDelivr/npm | `ort.min.js` ~1.1 MB gzipped. Multi-threaded WASM via `ort-wasm.wasm` + `ort-wasm-threaded.wasm`. |
| **ONNX Runtime Web (WebGPU)** | `onnxruntime-web/webgpu@1.19+` | `sha384-<hash>` | `ort.webgpu.min.js` ~2.5 MB. Requires `webgpu` executionProvider. FP16 needs Chrome 121+/Edge 122+. |
| **Transformers.js** | `@huggingface/transformers@3.x` | `sha384-<hash>` | High-level pipelines (background-removal, super-resolution). Handles pre/post-processing. |
| **OpenCV.js** | `opencv.js@4.10+` (custom build) | Self-hosted | For panorama, focus stacking, lens correction. Build only needed modules (~2 MB vs 10 MB full). |
| **Web Workers** | Native API | N/A | Offload all inference to workers. Main thread stays 60fps. |
| **IndexedDB (idb)** | `idb@8+` | `sha384-<hash>` | Cache models (OPFS for large files). Pin model versions via hash in manifest. |

### Model Hosting & Integrity
- **Primary CDN:** Hugging Face Hub (`huggingface.co/.../resolve/main/...`) — use `?download=true` for direct links
- **Mirror / Pin:** GitHub Releases (tagged) + jsDelivr for SRI + version pinning
- **Integrity:** SHA-256 in `models-manifest.json` (version → {url, sha256, size, license})
- **License Check:** Only Apache-2.0, BSD-3, MIT, CC0 models in MVP. RMBG-1.4 flagged non-commercial → opt-in only.

### Model Manifest Example
```json
{
  "version": "2026.09.20",
  "models": {
    "u2netp": { "url": "https://huggingface.co/edgetools/u2netp/resolve/main/u2netp.onnx", "sha256": "309c84...", "size": 4574861, "license": "Apache-2.0", "task": "background-removal", "variant": "fast" },
    "rmbg-1.4": { "url": "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx", "sha256": "...", "size": 170000000, "license": "BRIA-RMBG-1.4 (non-commercial)", "task": "background-removal", "variant": "max-quality" },
    "realesr-general-x4v3": { "url": "https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/real_esrgan_x4.onnx", "sha256": "...", "size": 64000000, "license": "BSD-3-Clause", "task": "upscaling", "variant": "photo" },
    "realesr-anime-x4": { "url": "https://huggingface.co/SceneWorks/real-esrgan-onnx/resolve/main/realesrgan_x4plus_anime.onnx", "sha256": "...", "size": 17000000, "license": "BSD-3-Clause", "task": "upscaling", "variant": "anime" },
    "swinir-denoise": { "url": "https://huggingface.co/Heliosoph/swinir-onnx/resolve/main/swinir_denoising_color_25.onnx", "sha256": "...", "size": 45000000, "license": "Apache-2.0", "task": "denoising" },
    "kim2091-dejpeg": { "url": "https://huggingface.co/notaneimu/onnx-image-models/resolve/main/1x-Kim2091-DeJpeg-v0.onnx", "sha256": "...", "size": 9000000, "license": "CC-BY-NC-SA-4.0", "task": "jpeg-artifact-removal" },
    "lama-inpaint": { "url": "https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx", "sha256": "...", "size": 100000000, "license": "Apache-2.0", "task": "inpainting", "input": "512x512 fixed" }
  }
}
```

### Mobile Constraints & Mitigations
| Constraint | Limit | Mitigation |
|------------|-------|------------|
| **WebGPU VRAM** | 256–512 MB typical mobile | Tiled inference (256×256 tiles, 16px overlap); 2× mode default on mobile; stream tiles sequentially |
| **WASM Memory** | 4 GB (64-bit), but practical ~1 GB | Single-thread WASM for iOS; multi-thread WASM for Android/desktop |
| **Download Size** | User patience ~5 MB initial | Lazy-load models on first use; show progress; cache in IndexedDB/OPFS; reuse across tools |
| **Battery / Thermal** | Throttling after ~30s sustained | Chunk work; yield to main thread; show "processing..." with cancel |
| **iOS/Safari WebGPU** | ❌ Not supported (2024) | WASM fallback for ALL models; WebGPU = progressive enhancement |

### Build / Dev Requirements
- **Bundler:** Vite / esbuild (WASM asset handling, code-splitting)
- **TypeScript:** Strict, typed ONNX Runtime Web API
- **Testing:** Playwright (Chromium WebGPU, Firefox WASM, WebKit WASM)
- **CI:** GitHub Actions with Chrome (WebGPU) + Firefox (WASM) runners

---

## 5. RISK AREAS

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **WebGPU unavailable on iOS/Safari** | 🔴 High | 100% (2024) | WASM fallback for all models. Document honestly: "Best on Chrome/Edge/Android". Don't hide the fallback. |
| **Model download size → user abandonment** | 🔴 High | High | Lazy-load with progress bar. Cache in OPFS/IndexedDB. Show "First run downloads X MB". Offer "Lite" models (u2netp, anime upscaler) as default. |
| **Mobile VRAM OOM on large images** | 🔴 High | High | Auto-tile large images. Detect device memory (`navigator.deviceMemory`). Default to 2× on mobile. Show honest time estimate. |
| **WASM performance too slow for upscaling/inpainting** | 🟡 Medium | Medium | WebGPU primary path. WASM = "it works but slow" badge. Consider WebGL backend for ONNX Runtime (deprecated but faster than WASM for some ops). |
| **License compliance (RMBG non-commercial, CC-BY-NC-SA models)** | 🔴 High | Medium | Default to Apache-2.0/BSD/MIT/CC0 models only. RMBG-1.4 behind "Max Quality" toggle with license notice. Audit every model. |
| **Model quality gap vs. paid tools** | 🟡 Medium | High | Benchmark against Topaz/PhotoRoom on test set. Publish honest comparison (PSNR/SSIM + visual). "Good enough for 90% of users" is the bar. |
| **Browser API instability (WebGPU, OPFS, WASM threads)** | 🟡 Medium | Medium | Pin ONNX Runtime Web version. Test on Chrome Canary. Feature-detect everything. Graceful degradation. |
| **Bundle size bloat from multiple models** | 🟡 Medium | Medium | Code-split per tool. Dynamic `import()` for each tool's worker. Shared ONNX Runtime instance. |
| **Competitor catch-up (PhotoRoom/Canva add on-device)** | 🟡 Medium | Medium | Moat = privacy + zero upload + open source + no account + batch free. Move fast on UX. |
| **User trust: "Is it really local?"** | 🟡 Medium | Medium | Network tab shows zero requests. Open source. "Verify don't trust" — add "View Network Activity" panel. Content Security Policy `connect-src 'none'` for worker. |

---

## 6. DECISION MATRIX: MVP SCOPE CONFIRMATION

| Criterion | Background Removal | Upscaling | Denoise/DeJPEG | Object Removal | Batch |
|-----------|-------------------|-----------|----------------|----------------|-------|
| **User Demand (paid market)** | 🔥🔥🔥 | 🔥🔥🔥 | 🔥🔥 | 🔥🔥 | 🔥 |
| **On-device viability** | ✅ WASM + WebGPU | ✅ WebGPU (tiled) | ✅ WebGPU (tiled) | ⚠️ WebGPU only | ✅ JS only |
| **Model size (download)** | 4.7 MB (lite) | 64 + 17 MB | 45 + 9 MB | 100 MB | 0 |
| **License (commercial-safe)** | ✅ Apache-2.0 | ✅ BSD-3 | ✅ Apache-2.0 / CC-BY-NC-SA* | ✅ Apache-2.0 | N/A |
| **Mobile support** | ✅ Full (WASM) | ⚠️ 2× tiled | ✅ Fast (128px tiles) | ❌ Desktop only | ✅ Full |
| **Differentiation vs. paid** | Match remove.bg free | Match Topaz $99 | Match Topaz $79 | Beat PS $20/mo | Beat PhotoRoom $10/mo |
| **Dev effort (weeks)** | 2 | 3 | 2 | 4 | 2 |
| **Total MVP Weeks** | | | | | **~13 weeks** |

*Kim2091 DeJPEG is CC-BY-NC-SA — swap to Apache-2.0 alternative (e.g., `1x-DeJPG-SRFormer-light` CC-BY-4.0) for MVP.

---

## 7. NEXT STEPS

1. **Legal Review** — Confirm all MVP model licenses allow commercial distribution in a privacy-first tool.
2. **Prototype** — Build background removal with u2netp (WASM + WebGPU) in 1 week. Measure: load time, inference time, memory, quality vs. remove.bg.
3. **Benchmark Suite** — Create 50-image test set (portraits, products, animals, hair, text) for each tool. Automate PSNR/SSIM + visual regression.
4. **Architecture Spike** — Worker pool + model cache + tiled inference + progress streaming. Validate on low-end Android (Pixel 6a) and iPhone 13 (WASM only).
5. **UX Spec** — "Honest limits" UI: show model size, estimated time, quality tier (Fast/Max), fallback notice before every run.

---

## APPENDIX: COMPETITOR POSITIONING SNAPSHOT

| Competitor | Moat | Privacy | On-Device | Price | Our Wedge |
|------------|------|---------|-----------|-------|-----------|
| **remove.bg** | API + accuracy | ❌ Upload | ❌ | $0.001–$0.02/img | Free, local, batch |
| **PhotoRoom** | E-commerce UX | ❌ Upload | ❌ | $9.99/mo | Free, local, batch + upscale + denoise |
| **Topaz Gigapixel** | Quality | ✅ Local | ✅ Native | $99 | Free, in-browser, no install |
| **Canva Pro** | Ecosystem | ❌ Upload | ❌ | $14.99/mo | No account, no upload, open source |
| **Luminar Neo** | Perpetual license | ✅ Local | ✅ Native | $129 | Free, in-browser, no install |
| **Photoshop** | Ecosystem | ❌ Cloud | ❌ (some neural) | $19.99/mo | Free, local, zero-lock-in |

**Our Unoccupied Terrain:** *"The only toolbox that does background removal + upscaling + denoising + object removal 100% in your browser, zero upload, zero account, zero cost, open source — with honest limits shown upfront."*

---

*End of Scope Proposal*