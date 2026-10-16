# Fisherman's Bait 2: Big Ol' Bass — PS1 Web Recompilation

> **Status: codegen complete; WASM built; Chromium successfully displayed the original Konami splash and PRESS START BUTTON screen using OpenBIOS Fastboot. Gameplay beyond title pending.** This repository tracks a real browser-native static recompilation effort, not an EmulatorJS/iframe launcher.

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
2. **Codegen — complete**: PSXRecomp detected 2,277 functions and generated C for 2,317 entries (including 40 branch-target repair entries), producing ~1.74 million lines of C and a dispatch table. More dynamic code investigations remain.
3. **Browser WASM build — complete**: Emscripten 4.0.23 produced a 14,186,692-byte WebAssembly binary, JS glue and HTML shell. Compilation/linking exited 0.
4. **Browser runtime — partly tested**: Chromium loaded the WASM, accepted local BIN/CUE, extracted SLUS_009.99, loaded OpenBIOS and entered BIOS at `0xBFC00000` with no JS errors. With the standard BIOS a green cube animation and black screen appeared; switching to OpenBIOS Fastboot reached the game's Konami intro at 35 seconds and PRESS START BUTTON at 55 seconds.
5. **Start input and gameplay — in progress**: confirm START advances the title into the menus and fishing gameplay; then validate audio, streamed content and overlays, save data, mobile and TV.

PSXRecomp is a **native recompiler/runtime**. It does **not** automatically turn any PS1 game into a working browser port. A working PS1 browser backend is part of the engineering required here. See [browser road map](docs/WEB_PORT_ROADMAP.md).

## Easiest preparation on AEROCOOL / Unraid

Copy a legal USA disc archive into the cloned folder (the archive stays private and is gitignored). Then:

```sh
cd /mnt/user/Games/fish-port
python3 tools/prepare_input.py "Fisherman's Bait 2 - Big Ol' Bass.7z" --output private
python3 -m unittest discover -s tests -v
```

This calls the system's `7z`, safely prepares `private/disc.cue` and its BIN track, extracts the PS-X EXE, checks the known USA SHA-1, and writes the function-seed list. Do not push the private folder or binaries to GitHub.

**AEROCOOL workspace:** `/mnt/user/Games/fish-port`. Disc extraction, codegen, Emscripten compilation, browser package, Docker nginx and initial Chromium runtime smoke test have all completed. Do not mistake browser boot for confirmed gameplay.

## Local disc preparation

Use a legal copy of the USA disc, keeping the .cue and its .bin in the same local folder:

```sh
python3 tools/disc_probe.py "/path/to/Fisherman's Bait 2 - Big Ol' Bass.cue" \
  --private-out private --check-sha1
```

The tool inspects the ISO9660 directory, validates the boot file, extracts `private/SLUS_009.99`, and creates `private/seeds.txt` and `private/disc_probe.json`. Everything under `private/` is excluded from Git.

### AEROCOOL browser alpha (port 18872)

```sh
cd /mnt/user/Games/fish-port
bash scripts/package-web.sh
docker compose up -d
```

Open `http://192.168.30.10:18872/` from a device that can reach AEROCOOL. The web app asks you to select your own CUE and BIN files. It does **not** upload the game to the server. The hosted build includes OpenBIOS under its license but does not include Konami game files. The original title screen has been confirmed under Chromium with the Fastboot BIOS; gameplay is still under test.

To rebuild WASM on AEROCOOL use the `emscripten/emsdk:4.0.23` container with a compatible PSXRecomp runtime mounted separately, as documented in [`docs/WEB_PORT_ROADMAP.md`](docs/WEB_PORT_ROADMAP.md).

## Legal and distribution

No ROM/BIN/CUE, BIOS, game executable, game assets, generated C containing original code, or playable binary is distributed in this repository. Users must provide their own legally obtained game data locally. Konami and PlayStation remain trademarks of their respective owners.
