#!/usr/bin/env python3
"""Stage a user's own game BIN/CUE or .7z locally, without publishing data."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

from disc_probe import DiscError, analyze, cue_to_bin


def prepare(archive_or_cue: Path, output: Path) -> dict:
    archive_or_cue = archive_or_cue.resolve(strict=True)
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    suffix = archive_or_cue.suffix.lower()
    if suffix == ".7z":
        seven_zip = shutil.which("7z") or shutil.which("7zz")
        if not seven_zip:
            raise DiscError("7z or 7zz is required to extract .7z; install 7-Zip or extract first")
        staging = output / "original-disc"
        staging.mkdir(parents=True, exist_ok=True)
        subprocess.run([seven_zip, "x", "-y", f"-o{staging}", str(archive_or_cue)],
                       stdout=subprocess.DEVNULL, check=True)
        cues = sorted(staging.rglob("*.cue"))
        if len(cues) != 1:
            raise DiscError(f"Archive contains {len(cues)} CUE files; expected exactly 1")
        cue = cues[0]
    elif suffix == ".cue":
        cue = archive_or_cue
    else:
        raise DiscError("Use a .cue or a .7z archive containing .cue + .bin")
    source_bin = cue_to_bin(cue)
    destination_bin = output / source_bin.name
    if destination_bin.exists() or destination_bin.is_symlink():
        if destination_bin.is_symlink() and destination_bin.resolve() == source_bin:
            pass
        elif destination_bin.resolve() == source_bin:
            pass
        else:
            raise DiscError(f"Refusing to overwrite an existing track: {destination_bin}")
    elif source_bin != destination_bin:
        try:
            destination_bin.symlink_to(source_bin)
        except OSError:
            shutil.copyfile(source_bin, destination_bin)
    target_cue = output / "disc.cue"
    if cue != target_cue:
        shutil.copyfile(cue, target_cue)
    result = analyze(target_cue, private_dir=output, validate_sha=True)
    if not result.get("redump_usa_match"):
        raise DiscError("Disc does not match verified USA Redump image; check the original copy")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="The user's game CUE or original .7z archive")
    parser.add_argument("--output", type=Path, default=Path("private"))
    args = parser.parse_args()
    try:
        result = prepare(args.input, args.output)
    except (OSError, DiscError, subprocess.CalledProcessError) as err:
        parser.exit(2, f"ERROR: {err}\n")
    print(json.dumps({"ok": True, "serial": result["serial"],
                      "entry_pc": result["executable"]["entry_pc"],
                      "static_jal_seeds": result["static_jal_seeds"],
                      "private_directory": str(args.output.resolve())}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
