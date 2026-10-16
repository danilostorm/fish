#!/usr/bin/env python3
"""Read PS1 ISO9660 from raw BIN/CUE; report identity & extract private inputs.

Only Python's standard library is required. No game code/data are bundled.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from dataclasses import dataclass
from pathlib import Path

EXPECTED_SERIAL = "SLUS_009.99"
KNOWN_DISC_SHA1 = "8793d3c52e415221bd04be24bb4773b82d08185a"
SECTOR_RAW = 2352
SECTOR_DATA = 2048


class DiscError(ValueError):
    pass


@dataclass(frozen=True)
class IsoEntry:
    path: str
    lba: int
    size: int
    is_dir: bool

    def as_dict(self) -> dict:
        return {"path": self.path, "lba": self.lba, "size": self.size, "directory": self.is_dir}


class Disc:
    def __init__(self, path: Path):
        self.path = path
        self.format = "2352" if path.suffix.lower() != ".iso" else "2048"
        self.sector_bytes = SECTOR_RAW if self.format == "2352" else SECTOR_DATA
        self.file = path.open("rb")
        if path.stat().st_size % self.sector_bytes:
            self.file.close()
            raise DiscError(f"Image size is not a multiple of {self.sector_bytes}")
        self.sector_count = path.stat().st_size // self.sector_bytes

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.file.close()

    def sector(self, lba: int) -> bytes:
        if not 0 <= lba < self.sector_count:
            raise DiscError(f"Sector outside image: {lba}")
        self.file.seek(lba * self.sector_bytes)
        raw = self.file.read(self.sector_bytes)
        if len(raw) != self.sector_bytes:
            raise DiscError(f"Truncated sector: {lba}")
        if self.format == "2048":
            return raw
        if raw[:12] != b"\x00" + (b"\xff" * 10) + b"\x00":
            raise DiscError(f"Invalid raw sector synchronization at LBA {lba}")
        mode = raw[15]
        if mode == 1:
            return raw[16:16 + SECTOR_DATA]
        if mode == 2:
            if raw[18] & 0x20:
                raise DiscError(f"Unexpected XA Form 2 in ISO9660 data sector {lba}")
            return raw[24:24 + SECTOR_DATA]
        raise DiscError(f"Unsupported CD sector mode {mode} at LBA {lba}")

    def extent(self, lba: int, size: int) -> bytes:
        if size < 0 or size > 256 * 1024 * 1024:
            raise DiscError("Unreasonable file extent size")
        sectors = (size + SECTOR_DATA - 1) // SECTOR_DATA
        if lba < 0 or lba + sectors > self.sector_count:
            raise DiscError("File extent is outside the disc")
        return b"".join(self.sector(lba + i) for i in range(sectors))[:size]

    @staticmethod
    def parse_entry(record: bytes, parent: str = "") -> IsoEntry:
        if len(record) < 34 or len(record) != record[0]:
            raise DiscError("Invalid ISO9660 directory record")
        filename_len = record[32]
        if len(record) < 33 + filename_len:
            raise DiscError("Truncated ISO9660 file name")
        name = record[33:33 + filename_len].decode("ascii", errors="replace")
        if name == "\x00":
            name = "."
        elif name == "\x01":
            name = ".."
        lba = struct.unpack_from("<I", record, 2)[0]
        size = struct.unpack_from("<I", record, 10)[0]
        return IsoEntry(parent + name, lba, size, bool(record[25] & 2))

    def list_directory(self, root: IsoEntry, depth: int = 0) -> list[IsoEntry]:
        if depth > 6 or root.size > 8 * 1024 * 1024:
            raise DiscError("Directory recursion/size limit exceeded")
        data = self.extent(root.lba, root.size)
        entries: list[IsoEntry] = []
        offset = 0
        while offset < len(data):
            record_len = data[offset]
            if record_len == 0:
                offset = ((offset // SECTOR_DATA) + 1) * SECTOR_DATA
                continue
            if offset + record_len > len(data):
                raise DiscError("Directory record extends beyond extent")
            child = self.parse_entry(data[offset:offset + record_len], root.path)
            offset += record_len
            if child.path.removeprefix(root.path) in (".", ".."):
                continue
            entries.append(child)
            if child.is_dir:
                entries.extend(self.list_directory(IsoEntry(child.path + "/", child.lba, child.size, True), depth + 1))
        return entries

    def files(self) -> list[IsoEntry]:
        pvd = self.sector(16)
        if pvd[0] != 1 or pvd[1:6] != b"CD001":
            raise DiscError("ISO9660 primary volume descriptor missing at LBA 16")
        root_record_len = pvd[156]
        root = self.parse_entry(pvd[156:156 + root_record_len])
        return self.list_directory(IsoEntry("", root.lba, root.size, True))


def cue_to_bin(path: Path) -> Path:
    if path.suffix.lower() not in (".cue", ".bin", ".iso"):
        raise DiscError("Provide a .cue, .bin or 2048-byte .iso")
    if path.suffix.lower() != ".cue":
        return path
    contents = path.read_text(encoding="utf-8-sig", errors="replace")
    matched = re.search(r'^\s*FILE\s+(?:"([^"]+)"|(\S+))\s+BINARY\s*$', contents, re.I | re.M)
    if not matched:
        raise DiscError("CUE does not reference a BINARY track")
    if not re.search(r'^\s*TRACK\s+01\s+MODE[12]/2352\s*$', contents, re.I | re.M):
        raise DiscError("Only first data tracks in MODE1/2352 or MODE2/2352 are supported")
    filename = matched.group(1) or matched.group(2)
    target = (path.parent / filename).resolve()
    if target.parent != path.parent.resolve():
        raise DiscError("CUE track must be in the same directory as its .cue")
    if not target.exists():
        raise DiscError(f"CUE track was not found: {filename}")
    return target


def exe_header(payload: bytes) -> dict:
    if len(payload) < 2048 or payload[:8] != b"PS-X EXE":
        raise DiscError("Expected valid PS-X EXE header")
    entry, gp, load, text_size = struct.unpack_from("<IIII", payload, 16)
    stack = struct.unpack_from("<I", payload, 48)[0]
    if not 0x80000000 <= load <= 0x807FFFFF or not 0x80000000 <= entry <= 0x807FFFFF:
        raise DiscError("Unexpected PS1 load/entry address")
    if text_size == 0 or text_size > len(payload) - 2048:
        raise DiscError("Header text size exceeds the executable payload")
    if not load <= entry < load + text_size:
        raise DiscError("Entry PC is outside main text section")
    return {"entry_pc": f"0x{entry:08X}", "gp": f"0x{gp:08X}",
            "load_address": f"0x{load:08X}", "text_size": text_size,
            "initial_stack": f"0x{stack:08X}"}


def function_seeds(payload: bytes, load: int, entry: int, text_size: int) -> list[int]:
    text = memoryview(payload)[2048:2048 + text_size]
    targets = {entry}
    for offset in range(0, len(text) - 3, 4):
        instr = struct.unpack_from("<I", text, offset)[0]
        if instr >> 26 == 3:
            pc = load + offset
            target = ((pc + 4) & 0xF0000000) | ((instr & 0x03FFFFFF) << 2)
            if load <= target < load + text_size and target % 4 == 0:
                targets.add(target)
    return sorted(targets)


def analyze(path: Path, private_dir: Path | None = None, validate_sha: bool = False) -> dict:
    binfile = cue_to_bin(path.resolve())
    with Disc(binfile) as disc:
        entries = disc.files()
        by_name = {e.path.upper().split(";")[0]: e for e in entries if not e.is_dir}
        cnf = by_name.get("SYSTEM.CNF")
        if cnf is None:
            raise DiscError("SYSTEM.CNF missing")
        config = disc.extent(cnf.lba, cnf.size).decode("ascii", errors="replace")
        found = re.search(r'BOOT\s*=\s*cdrom:\\([^;\r\n]+)', config, re.I)
        if found is None or found.group(1).upper() != EXPECTED_SERIAL:
            raise DiscError("This disc is not Fisherman's Bait 2 USA (SLUS_009.99)")
        boot_entry = by_name.get(EXPECTED_SERIAL)
        if boot_entry is None:
            raise DiscError("Expected boot executable not found")
        payload = disc.extent(boot_entry.lba, boot_entry.size)
        header = exe_header(payload)
        seeds = function_seeds(payload, int(header["load_address"], 16), int(header["entry_pc"], 16), header["text_size"])
        result = {"title": "Fisherman's Bait 2: Big Ol' Bass", "platform": "PlayStation 1",
                  "region": "USA", "serial": EXPECTED_SERIAL, "disc_sectors": disc.sector_count,
                  "format": disc.format, "disc_bytes": binfile.stat().st_size,
                  "boot_file": boot_entry.path, "exe_bytes": len(payload),
                  "exe_sha256": hashlib.sha256(payload).hexdigest(), "executable": header,
                  "static_jal_seeds": len(seeds),
                  "entries": [e.as_dict() for e in entries]}
        if validate_sha:
            sha = hashlib.sha1()
            with binfile.open("rb") as fd:
                for chunk in iter(lambda: fd.read(1024 * 1024), b""):
                    sha.update(chunk)
            result["disc_sha1"] = sha.hexdigest()
            result["redump_usa_match"] = (result["disc_sha1"] == KNOWN_DISC_SHA1)
        if private_dir is not None:
            private_dir.mkdir(parents=True, exist_ok=True)
            (private_dir / EXPECTED_SERIAL).write_bytes(payload)
            (private_dir / "seeds.txt").write_text("\n".join(f"0x{s:08X}" for s in seeds) + "\n")
            (private_dir / "disc_probe.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
            result["private_outputs"] = [EXPECTED_SERIAL, "seeds.txt", "disc_probe.json"]
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("disc", type=Path, help="Your own .cue, .bin, or 2048-byte .iso")
    parser.add_argument("--private-out", type=Path, help="Extract PS-X EXE and seed addresses locally")
    parser.add_argument("--check-sha1", action="store_true", help="Compare raw disc SHA-1 to the known USA dump")
    args = parser.parse_args()
    try:
        print(json.dumps(analyze(args.disc, args.private_out, args.check_sha1), indent=2, ensure_ascii=False))
    except (OSError, DiscError) as err:
        parser.exit(2, f"ERROR: {err}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
