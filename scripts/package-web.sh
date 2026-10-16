#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
BIO="${FISH_OPENBIOS_ROOT:-/mnt/user/Games/repsiman/third_party/openbios}"
BASE="Fishermans_Bait_2___Recompiled"
for item in "$BASE.js" "$BASE.wasm"; do
  if [[ ! -s "build-web/$item" ]]; then
    printf 'Missing Emscripten artifact: build-web/%s\n' "$item" >&2
    exit 1
  fi
done
for item in openbios.bin LICENSE; do
  if [[ ! -s "$BIO/$item" ]]; then
    printf 'Missing legal OpenBIOS file: %s\n' "$BIO/$item" >&2
    exit 1
  fi
done
mkdir -p dist-web
cp "build-web/$BASE.js" "build-web/$BASE.wasm" dist-web/
cp web/index.html web/_headers dist-web/
cp "$BIO/openbios.bin" dist-web/
cp "$BIO/LICENSE" dist-web/OPENBIOS-LICENSE.txt
# Only allow listed distribution entries. Do not copy user-owned .bin/.cue.
if find dist-web -mindepth 1 -maxdepth 1 -name '*.cue' | grep -q .; then
  printf 'Unexpected proprietary disc material in dist-web: aborting\n' >&2
  exit 1
fi
printf 'Packaged browser runtime without original game disc: %s\n' "$ROOT/dist-web"
du -h dist-web/*
