# Fisherman's Bait 2 — WebAssembly performance renderer

## Validated change

This project still recompiles the PlayStation MIPS program to C / WebAssembly and consumes a locally staged user-owned PS1 disc. It does not embed an emulator in the web launcher.

On the original Chrome headless measurement, the browser software-presenter path was CPU-bound: roughly 26–29 guest vblanks/s in the menu, with about 16–18 ms per software frame spent in conversion/SDL update/present (not in the frame limiter). The average measured pacing wait was close to zero, so simply changing the FPS cap would not solve the problem.

The **WebGL2 direct presentation** path:
1. Keeps the same PS1 software GPU and recompiled guest; game logic, memory, SIO controls, CD-ROM and PT-BR BIN/CUE are unchanged.
2. Converts the 15-bit PS1 VRAM image in a tight, byte-exact scanout loop; 65,536 input pixel values were verified against the original conversion.
3. Asynchronously submits that ARGB frame from the worker to a dedicated main-thread WebGL2 canvas.
4. Uses a fullscreen shader to swap BGRA memory bytes into proper RGBA colors, with nearest-neighbor scaling (no new graphics content).
5. Skips Emscripten SDL software texture upload/present on the direct path. SDL software renderer still exists as the compatibility fallback.

**Isolated Chromium canary results (AEROCOOL, 2026-10-16):**

| Measurement | Original software | WebGL2 direct |
| --- | ---: | ---: |
| Mode-select/intro guest cycles per second | ~26–29 | ~48 |
| Software presenter time per frame | ~16–18 ms | ~0.24 ms spent scheduling/scanout |
| Later spot-select guest cycles/s | Not separately profiled | ~54.5 |
| Brief intro measurement after warm-up | ~26 | ~58.9 |

The spot-select test pressed Start, X, X, and reached FISH LAKE. Chromium showed no uncaught JS errors. This is evidence of substantial improvement **in those tested scenes**, not a guarantee of 60 fps in the fishing gameplay or on every device.

## Graceful compatibility path

WebGL2 is used automatically only if the browser successfully creates and links the dedicated WebGL2 program. If initialization fails, SDL's original software presenter remains active. The player contains a **Gráficos** control that restarts the page in compatible mode (`?video=compat`); switching renderers in place is unsafe because Emscripten SDL may not reattach its canvas cleanly. Loss of the WebGL2 context also restarts in compatible mode.

The new drawing canvas is visual-only; the original SDL canvas stays alive and focused for keyboard/touch/controller input. The original launcher, PT-BR textures, and URL are unchanged.

## Rebuilding

Apply prior Fish patches to a compatible isolated PSXRecomp checkout and then apply this incremental patch:

```sh
patch -p1 < patches/fish-web-input.patch
patch -p1 < patches/fish-web-audio-adaptive.patch
patch -p1 < patches/fish-webgl-performance.patch
```

**Important:** the patches are relative to the original PSXRecomp source tree, not the Fish repository root. Do not apply them to the shared RepsiMan runtime. Build with Emscripten 4.0.23 and `PSX_LAUNCHER=OFF`; the current Fish build uses `build-web-input`. Package with `bash scripts/package-web.sh`.

Performance metrics in the WebAssembly are exposed as `fish_web_perf_render_us`, `fish_web_perf_render_frames`, `fish_web_set_render_interval`, and `psx_web_perf_vblanks`. Avoid conflating actual rendered frames per second with guest vblanks per second. The latter determines game speed.

**Next:** test actual casting, reeling, fish behavior, audio underruns and memory-card persistence on representative PC/mobile hardware. Heavy scenes may still be below real time.
