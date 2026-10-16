# Real PS1 -> Browser recompilation roadmap

**Current state: disc validation and private EXE/seed extraction work; web gameplay is not operational.**

## Measured baseline (2026-10-16)

- Archive inspected: BIN/CUE raw 2352, USA SLUS_009.99, SHA-1 verified.
- Extracted 727,040-byte PS-X EXE with valid header; text length 0xB1000.
- MIPS direct JAL scan yielded 1,087 distinct in-range targets (including entry PC).
- `FISHING.DAT` is a 74,668,032-byte filesystem object and likely relevant to streaming. Dynamic code/asset organization not yet reverse-engineered.
- Existing AEROCOOL projects RepsiMan and NASCAR Rumble contain examples of PSXRecomp native-to-wasm adaptation. They are **references**, not evidence this game already works.

## Milestones and measurable pass criteria

1. **Disc audit — DONE.** ISO9660, boot file, addresses, SHA-1, extraction and JAL discovery.
2. **Native code generation — PENDING.** Build RetroPortingToolKit/psxrecomp and run on the private EXE; log count of emitted functions, rejects and unresolved jump tables. Capture dynamic overlays from FISHING.DAT.
3. **Native boot baseline — PENDING.** Boot to first rendered frame then main menu with functional audio and controller; record frame/stack trace and CD reads.
4. **Emscripten integration — PENDING.** Adapt C/C++ recompiled entrypoints, PS1 memory/MMIO, cooperative fibers/ucontext or Asyncify, CD-ROM loading and overlay execution to browser restrictions. On the web it may be necessary to precompile all observed overlays and use an interpreter fallback for unobserved code; arbitrary dynamic native libraries are not usable.
5. **Browser services — PENDING.** WebGL2/WebGPU for GPU, WebAudio, Gamepad API, keyboard/touch overlay, IndexedDB persistent memory card, streaming disc content, service worker.
6. **Real browser QA — PENDING.** First frame, main menu, fishing gameplay, saves, music, controller, mobile/TV input; compare against a reference PS1 run.

## Constraints

- `psxrecomp` currently targets native executables with host SDL and platform-specific fibers / dynamic overlay compilation. `emcc` alone does not make that runtime browser compatible.
- Do **not** claim playable from the presence of an HTML page or WASM shell. A playable milestone requires recorded browser gameplay.
- Do **not** copy copyrighted ROMs/executables, assets, generated full game C, or BIOS blobs to this public repository. Compile/deploy only with rights to the underlying materials.
- Keep existing public game sites and unrelated live services untouched.

## References

- PSXRecomp architecture: https://github.com/RetroPortingToolKit/psxrecomp/blob/master/docs/ARCHITECTURE.md
- PSXRecomp game project setup: https://github.com/RetroPortingToolKit/psxrecomp/blob/master/docs/GAME_PROJECT_SETUP.md
- PSXRecomp execution tiers: https://github.com/RetroPortingToolKit/psxrecomp/blob/master/docs/EXECUTION_MODEL.md
- PSP WebAssembly recompilation (different architecture/runtime): https://github.com/snuri00/psp-web-recomp
