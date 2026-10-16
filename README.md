# Fisherman's Bait 2: Big Ol' Bass — PS1 Web Recompilation

> **Status: reverse engineering / disc verified. NOT PLAYABLE YET.** This repository tracks a real browser-native static recompilation effort, not an EmulatorJS/iframe launcher.

## Verified input (USA)

The user's disc was inspected directly on 2026-10-16. It is a valid BIN/CUE PlayStation 1 MODE2/2352 dump.

| Property | Verified value |
|---|---|
| Game | Fisherman's Bait 2: Big Ol' Bass (Konami, PS1) |
| Product serial | `SLUS-00999` |
| Boot program | `SLUS_009.99` |
| Executable header | `PS-X EXE` |
| Entry PC | `0x8009A7C8` |
| Text load address | `0x80010000` |
| Text size | `0x000B1000` (724,992 bytes) |
| Initial stack | `0x801FFFF0` |
| Boot EXE on disc | 727,040 bytes |
| `FISHING.DAT` | 74,668,032 bytes |
| Disc size | 118,747,776 bytes; 50,488 raw sectors |
| Disc SHA-1 | `8793d3c52e415221bd04be24bb4773b82d08185a` (matched Redump USA) |
| First-pass JAL seeds | 1,087 distinct entry/direct-call targets within main text |

**Important:** Seed addresses are initial hints, not verified functions. `FISHING.DAT` may contain streamed code/assets. Recompilation requires runtime and overlay investigation.

## Plan

1. **Disc validation — complete**: verify ISO9660, SYSTEM.CNF and PS-X EXE.
2. **Codegen — next**: run the RetroPortingToolKit [PSXRecomp](https://github.com/RetroPortingToolKit/psxrecomp) recompiler with the private, locally extracted `SLUS_009.99` and generated seed file. Capture missing branches and dynamic code loads.
3. **Native correctness baseline**: boot the recompiled program using the PSXRecomp runtime. Confirm frames, controller, video, sound, CD reads and menu navigation.
4. **Browser runtime**: replace/adapt incompatible native backends for Emscripten/WebAssembly (GPU WebGL2/WebGPU, WebAudio, input, persistent saves, cooperative scheduling, dynamic overlays).
5. **Browser gameplay validation**: measure boot/gameplay on Chrome/Firefox/mobile, not just whether a .wasm file builds.

PSXRecomp is a **native recompiler/runtime**. It does **not** automatically turn any PS1 game into a working browser port. A working PS1 browser backend is part of the engineering required here. See [browser road map](docs/WEB_PORT_ROADMAP.md).

## Local disc preparation

Use a legal copy of the USA disc, keeping the .cue and its .bin in the same local folder:

```sh
python3 tools/disc_probe.py "/path/to/Fisherman's Bait 2 - Big Ol' Bass.cue" \
  --private-out private --check-sha1
```

The tool inspects the ISO9660 directory, validates the boot file, extracts `private/SLUS_009.99`, and creates `private/seeds.txt` and `private/disc_probe.json`. Everything under `private/` is excluded from Git.

The next native codegen stage is deliberately not represented as completed. It needs an installed compatible PSXRecomp toolchain plus private disc material.

## Legal and distribution

No ROM/BIN/CUE, BIOS, game executable, game assets, generated C containing original code, or playable binary is distributed in this repository. Users must provide their own legally obtained game data locally. Konami and PlayStation remain trademarks of their respective owners.
