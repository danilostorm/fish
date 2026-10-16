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
5. **Start input and gameplay — verified through menus**: the isolated browser-input WebAssembly build receives Start (0xFFF7) and Cross (0xBFFF) through the PS1 SIO pad sampler and Chromium progressed from the animated title screen to GAME and MODE SELECT (Beginner, Tournament, Free Fishing, World Monsters). Fishing gameplay remains unverified. Audio is generated but severe underruns remain.

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

Open the AEROCOOL LAN site at http://192.168.30.10:18872/. The browser now fetches the installed BIN/CUE automatically and starts the recompilation runtime, with no file picker or web Start button. Downloading the 119 MB disc can take a minute or more. The UI has a restart button; keyboard Enter maps to the PS1 START key.

The Docker compose service mounts the existing private/original-disc directory read-only at /srv/fish-disc and nginx maps only two explicit HTTP routes: /game-data/disc.cue and /game-data/disc.bin. This allows the image to be loaded into browser memory on visiting the site. It also makes the full copyrighted game disc downloadable to anyone able to reach those HTTP routes. Keep this preview on a PRIVATE LOCAL NETWORK. Do NOT forward its port, publish its address through NPM, or offer it on the public internet without redistribution rights. The original game disc is never copied into Git or dist-web.

The headless Chromium autoload smoke test confirms the page loads both routes (HTTP 200), finds no file chooser, initializes the PSXRecomp WebAssembly runtime, and displays the actual title screen without JS errors. It does NOT yet guarantee fishing gameplay.

To rebuild WASM on AEROCOOL use the `emscripten/emsdk:4.0.23` container with a compatible PSXRecomp runtime mounted separately, as documented in [`docs/WEB_PORT_ROADMAP.md`](docs/WEB_PORT_ROADMAP.md).

## Legal and distribution

The public Git repository excludes original game BIN/CUE, executables and assets, generated C retaining original game code, and assembled binaries. This private developer preview serves the local disc over exact-file HTTP routes to support auto boot; access to those URLs gives access to the game content. Keep it private, and only distribute game materials with permission. OpenBIOS is a separately licensed component of the browser package. Konami and PlayStation remain trademarks of their respective owners.

## Input and audio findings (2026-10-16)

- The original shared PSXRecomp web runtime includes Pepsiman-specific interception that can swallow START while CDDA tracks 2–6 play. For Fish we removed this interception in an isolated runtime fork only.
- Added an atomic browser-to-PS1 pad bridge. Main-thread keyboard/Gamepad polling calls `psx_web_set_pad_buttons(word)`; the guest-side sampler merges it into Port 1 before SIO. A 72-second Chromium test observed active-low `FFF7` for Enter and `BFFF` for X, then reached GAME and MODE SELECT. This is real menu progress, not an attract-mode slideshow.
- Sound: WebAudio receives nonzero PCM and an unlock button can resume the browser AudioContext. However Chromium still reported **616 audio underruns** with only **34.5 emulated vblanks/sec** measured over 38 real seconds. Audio quality is **not yet fixed**; improving emulation speed is the next bottleneck.
- The host-only patched runtime is located at `private/fish-psxrecomp` and excluded from GitHub. The portable change set is under `patches/fish-web-input.patch` and is applied to a compatible isolated PSXRecomp checkout with `patch -p1`. Do not patch the shared RepsiMan runtime.
- WebAssembly rebuilt on AEROCOOL with Emscripten 4.0.23 and `-DPSX_LAUNCHER=OFF` (the native RmlUi launcher is not usable with the browser GL profile). `scripts/package-web.sh` uses `build-web-input` by default; override via `FISH_BUILD_DIR` only when deliberately changing builds.

This LAN preview automatically serves the locally owned disc. The public site configuration should not expose those two game-data endpoints without appropriate redistribution rights.

### Optional adaptive browser audio

The `Som adaptativo` button is **OFF by default**. When enabled, the web launcher measures actual guest vblanks/sec every two seconds and communicates a 0.45–1.0 playback-rate scale to the Web Audio bridge. The bridge adjusts both audio source playback rate and its scheduling duration, so slower emulation can avoid some silent gaps. **This lowers pitch and does not fix slow gameplay.**

A controlled Chromium run of approximately 72 seconds on AEROCOOL measured 627 audio underruns at 32.34 vblanks/sec without adaptation, versus 197 underruns at 33.42 vblanks/sec with the option active and a playback rate around 0.534. The Start and Cross menu transitions were preserved. This is a substantial reduction, not a guarantee of acceptable sound on all clients.

The isolated runtime changes are stored in two portable source patches: `patches/fish-web-input.patch` and `patches/fish-web-audio-adaptive.patch`. Apply both only to a private compatible checkout of RetroPortingToolKit/psxrecomp, build using Emscripten 4.0.23 with `-DPSX_LAUNCHER=OFF`, and package with `scripts/package-web.sh`. Never apply game-specific patches to other PS1 web projects without review.
