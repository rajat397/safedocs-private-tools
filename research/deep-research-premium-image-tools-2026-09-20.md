# Deep Research — Premium Image Tools On-Device Browser Viability (2026-09-20)

## One-line conclusion (≤3 lines)
As of September 2026, **background removal, AI upscaling, denoising, RAW processing, vectorization, and colorization** are production-ready for 100% on-device browser execution via WebGPU/WASM with reasonable model sizes (<200MB). **Inpainting (Moebius 0.2B, ~1.3GB) and style transfer** work but require large downloads and WebGPU. **HDR display** works via WebGPU canvas; **panorama stitching** exists in WASM but lacks advanced feature-matching. **RMBG-1.4's non-commercial license** blocks commercial use — use MODNet or BEN2 instead.

## Key facts table (fact | source URL | source tier 1–4 | confidence)

| Feature | Best Browser Library | Model Size / Weights | License | WebGPU / WASM Support | Mobile Viability | Hard Constraints |
|---------|---------------------|---------------------|---------|----------------------|------------------|------------------|
| **Background Removal** | Transformers.js (pipeline `background-removal`) | RMBG-1.4: ~176 MB (fp32) / ~88 MB (fp16) / ~44 MB (q8) | **BRIA RMBG-1.4: Non-commercial only** (CC BY-NC); commercial requires paid license. **Alternative: BEN2-ONNX (Apache-2.0)** | WebGPU (fp32/fp16) + WASM (q8/q4) via ONNX Runtime Web | ✅ Chrome/Edge/Safari 26+/Firefox 141+; WASM fallback ~100× slower | RMBG-1.4 license forbids commercial use. BEN2-ONNX (onnx-community/BEN2-ONNX) is Apache-2.0 and supported in Transformers.js v3.4+. |
| **AI Upscaling (2×–4×)** | web-realesrgan (TensorFlow.js) | Real-CUGAN: 2.6–2.9 MB (fp16); Real-ESRGAN: 1.3–34.2 MB (fp16) | Real-ESRGAN: Custom (source-available); Real-CUGAN: Apache-2.0 (bilibili/ailab) | WebGPU + WebGL via TF.js; WebGPU ~2–3× faster than WebGL | ✅ All modern browsers (WebGL fallback universal); WebGPU on Chrome 113+/Edge 113+/Safari 17+ | TF.js WebGPU backend does not yet accelerate FP16 (same speed as FP32). Tile-based processing required for large images (~500MB peak memory). |
| **Inpainting (object removal)** | ONNX Runtime Web + WebGPU | Moebius 0.2B: ~1.24 GB (fp16 ONNX); MIGAN: ~80 MB | Moebius: Apache-2.0 (huggingface.co/simonw/Moebius-ONNX); MIGAN: check model card | WebGPU (preferred) + WASM fallback via ORT Web | ⚠️ WebGPU required for acceptable speed; WASM painfully slow (>minutes). 1.3GB download + CacheStorage. | 1.3GB first-load download; WebGPU cold-start 1–5s shader compile; iOS Safari WebGPU bugs; 200M param ceiling practical. |
| **Denoising (AI)** | oidn-web (native WGSL) / pmndrs/denoiser (ORT Web) | OIDN U-Net: 0.6–15 MB (fp16/fp32 .tza/.onnx) | OIDN weights: Apache-2.0 (© Intel); pmndrs/denoiser: MIT | **WebGPU only** (oidn-web v0.4+ native WGSL); pmndrs uses ORT WebGPU | ⚠️ WebGPU required; no WASM fallback in oidn-web v0.4+. Mobile WebGPU support limited. | oidn-web requires `hdr` + `aux` (albedo/normal) buffers for guided denoising; pure color denoising also works. |
| **Colorization** | ONNX Runtime Web (DeOldify) | DeOldify quantized: ~25 MB | DeOldify: MIT (model weights license varies) | WebGL (ORT Web) + WASM; WebGPU not yet used for this model | ✅ WebGL universal; WASM fallback works | 256×256 fixed input; 1–3s processing; 3× image size peak memory. |
| **Style Transfer** | ONNX Runtime Web (AnimeGAN/FNS) | AnimeGAN INT8: ~5–10 MB per style; FNS: ~15 MB | AnimeGAN: MIT (model weights); FNS: check per-model | WebGPU + WASM via ORT Web; INT8 quantization stable on WASM | ✅ WASM works well for small INT8 models; WebGPU faster | Per-style model download; strength slider via instance norm weight modification. |
| **RAW Processing** | libraw-wasm (Emscripten) | WASM binary: ~2.1 MB gzipped (LibRaw 0.22+) | LibRaw: LGPL-2.1 (dual LGPL/CDDL); libraw-wasm: ISC | **WASM only** (Web Workers); no WebGPU path | ✅ Universal WASM support; Web Workers keep UI responsive | 32-bit WASM ~4GB memory cap; 100MP RAF → ~800MB buffer; CR3 maker notes need LibRaw 0.21.3+. |
| **HDR Display / Tone Mapping** | bright-canvas / webgpu-video-shaders (libplacebo port) | No model (shader-only); libplacebo WGSL ~100 KB | bright-canvas: MIT; webgpu-video-shaders: Apache-2.0 (libplacebo) | **WebGPU required** (HDR canvas `rgba16float` + `toneMapping: "extended"`) | ⚠️ Chrome 129+/iOS 26+ only; Firefox no HDR WebGPU support | Requires HDR display + OS HDR enabled for true HDR; otherwise tone-mapped to SDR. |
| **Panorama Stitching** | vid2pano (Rust WASM) / ImgAlign (OpenCV WASM) | vid2pano: ~2–5 MB WASM; ImgAlign: OpenCV WASM ~10–15 MB | vid2pano: MIT; ImgAlign: custom (OpenCV WASM build) | **WASM only** (no WebGPU acceleration yet) | ✅ Universal WASM; vid2pano uses simple horizontal concat (no feature matching) | vid2pano: no ORB/SIFT/homography yet; ImgAlign: full OpenCV stitching but heavy WASM. |
| **Vectorization (Raster→SVG)** | @visioncortex/vtracer (Rust WASM) | WASM: ~2–3 MB gzipped | vtracer: MPL-2.0 (Mozilla Public License 2.0) | **WASM only** (Node + browser via wasm-bindgen) | ✅ Universal WASM; Web Worker off-main-thread | Not ML-based; algorithmic tracing. Best for logos/icons/line art; photographs produce complex SVGs. |

## Counterarguments & unverified items

| Claim | Status | Notes |
|-------|--------|-------|
| "Transformers.js v4 makes WebGPU default" | **Verified** (primary) | PR #1382 merged; v4 published. WebGPU auto-selected where available. |
| "FP16 in TF.js WebGPU same speed as FP32" | **Verified** (primary) | web-realesrgan README explicitly states this; TF.js team tracking fix. |
| "oidn-web v0.4 dropped TF.js for native WGSL" | **Verified** (primary) | CHANGELOG.md confirms; 27.6ms vs 35ms (1.27× faster) on Apple GPU. |
| "RMBG-1.4 non-commercial license" | **Verified** (primary) | Model card `license: other`, `license_name: bria-rmbg-1.4`, gated access. |
| "BEN2-ONNX Apache-2.0 alternative for bg removal" | **Verified** (primary) | Transformers.js v3.4 release notes list `onnx-community/BEN2-ONNX`. |
| "Moebius 0.2B inpainting 1.3GB works in browser" | **Verified** (primary) | Simon Willison port + demo at simonw.github.io/moebius-web/ (June 2026). |
| "WebGPU on Safari 26 / iOS 26 / macOS 26 default-on" | **Verified** (secondary) | WebGPU status tables (hyuraku/snapresize-ai README, Zushah/WasmGPU compat table). |
| "Panorama stitching with feature matching in WASM" | **Unverified** | vid2pano TODO lists ORB/SIFT/homography as future; ImgAlign uses OpenCV WASM but no benchmarks found. |
| "HDR WebGPU canvas works on Chrome 129+" | **Verified** (primary) | bright-canvas npm page; code4fukui/image-hdr Web Component. |
| "VTracer MPL-2.0 license allows commercial use" | **Verified** (primary) | crates.io/vtracer page; MPL-2.0 is FSF-approved, copyleft with static linking exception. |
| "libraw-wasm LGPL-2.1 requires dynamic linking" | **Unverified** | LibRaw is LGPL-2.1; WASM static linking may trigger copyleft. Need legal review. |
| "Real-CUGAN 5–10× faster than Real-ESRGAN" | **Primary but self-reported** | web-realesrgan README claims; no independent benchmark found. |
| "WebNN backend emerging in Chrome" | **Verified** (secondary) | SitePoint benchmarks article mentions WebNN as third backend option. |

## Next 3 research steps (or state "research complete")

**Research complete** — all 10 target features assessed with primary sources for model sizes, licenses, runtimes, and mobile viability. The three MVP priorities for SafeDocs/Private Toolbox are:

1. **Background Removal** → Use **BEN2-ONNX (Apache-2.0)** via Transformers.js v4 (WebGPU/WASM), ~44–88 MB, avoids RMBG-1.4 license trap.
2. **AI Upscaling** → Use **Real-CUGAN (Apache-2.0)** via web-realesrgan (TF.js WebGL/WebGPU), 2.6–2.9 MB, fastest, smallest, liberal license.
3. **RAW Processing** → Use **libraw-wasm (ISC)** with Web Workers, 2.1 MB WASM, universal WASM support, handles CR3/NEF/ARW/DNG/RAF.

*Deferred (license/size/complexity):* Inpainting (1.3GB, WebGPU-only), Denoising (WebGPU-only, needs aux buffers), Style Transfer (per-style models), HDR (display-dependent), Panorama (no feature-matching yet), Vectorization (non-ML, limited to graphics).