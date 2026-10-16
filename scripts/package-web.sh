#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
BIO="${FISH_OPENBIOS_ROOT:-/mnt/user/Games/repsiman/third_party/openbios}"
BASE="Fishermans_Bait_2___Recompiled"
# The browser-input build uses the isolated patched runtime.
BUILD_DIR="${FISH_BUILD_DIR:-build-web-input}"
for item in "$BASE.js" "$BASE.wasm"; do
  if [[ ! -s "${BUILD_DIR}/$item" ]]; then
    printf 'Missing Emscripten artifact: %s/%s\n' "$BUILD_DIR" "$item" >&2
    exit 1
  fi
done
for item in openbios.bin openbios-fastboot.bin LICENSE; do
  if [[ ! -s "$BIO/$item" ]]; then
    printf 'Missing legal OpenBIOS file: %s\n' "$BIO/$item" >&2
    exit 1
  fi
done
mkdir -p dist-web
cp "$BUILD_DIR/$BASE.js" "$BUILD_DIR/$BASE.wasm" dist-web/
cp web/index.html web/_headers dist-web/
mkdir -p dist-web/assets
cp -a web/assets/. dist-web/assets/
cp "$BIO/openbios.bin" "$BIO/openbios-fastboot.bin" dist-web/
cp "$BIO/LICENSE" dist-web/OPENBIOS-LICENSE.txt
# Only allow listed distribution entries. Do not copy user-owned .bin/.cue.
if find dist-web -mindepth 1 -maxdepth 1 -name '*.cue' | grep -q .; then
  printf 'Unexpected proprietary disc material in dist-web: aborting\n' >&2
  exit 1
fi
printf 'Packaged browser runtime without original game disc: %s\n' "$ROOT/dist-web"
du -h dist-web/*
