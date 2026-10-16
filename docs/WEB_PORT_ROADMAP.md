# Real PS1 -> Browser recompilation roadmap

**Current state: main EXE recompiled, Emscripten WebAssembly built, browser loads OpenBIOS; game menu/gameplay not confirmed.**

## Measured baseline (2026-10-16)

- Archive inspected: BIN/CUE raw 2352, USA SLUS_009.99, SHA-1 verified.
- Extracted 727,040-byte PS-X EXE with valid header; text length 0xB1000.
- MIPS direct JAL scan yielded 1,087 distinct in-range targets (including entry PC).
- `FISHING.DAT` is a 74,668,032-byte filesystem object and likely relevant to streaming. Dynamic code/asset organization not yet reverse-engineered.
- PSXRecomp emitted 2,317 MIPS-to-C functions (1,741,196 source lines) and dispatch code.
- Emscripten 4.0.23 linked a 14,186,692-byte WASM with JavaScript glue, exit 0.
- Chromium browser loaded the user's local CUE/BIN, extracted the PS-X executable, started OpenBIOS at PC `0xBFC00000` and drew a BIOS cube animation, followed by gray/black screens. No menu or gameplay yet; no JavaScript page errors were observed.

## Milestones and measurable pass criteria

1. **Disc audit — DONE.** ISO9660, boot file, addresses, SHA-1, extraction and JAL discovery.
2. **Static code generation — COMPLETE (main EXE).** 2,317 functions generated. The streaming/overlay content of FISHING.DAT remains unverified.
3. **Game correctness — PENDING.** Trace transition from OpenBIOS to the game, CD-ROM I/O, overlays and the first menu.
4. **Emscripten integration — PARTIAL.** Built real WASM and launched BIOS. Game execution and overlay handling remain unconfirmed.
5. **Browser services — PARTIAL.** Local CUE/BIN picker, ISO9660 extraction, WebAssembly renderer and COOP/COEP nginx included. Input, in-game sound, save persistence, streamed loading and touch are pending verification.
6. **Real browser QA — PARTIAL.** 65-second Chromium runtime test completed with BIOS animation and black screen. Gameplay remains unverified.

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
