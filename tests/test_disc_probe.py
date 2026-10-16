"""Synthetic PS1 raw-disc tests; no copyrighted game content required."""
from __future__ import annotations
import sys, struct, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from disc_probe import DiscError, analyze, exe_header, cue_to_bin

SYNC = b"\x00" + b"\xff" * 10 + b"\x00"


def record(name, lba, size, is_dir=False):
    n = len(name)
    length = 33 + n + ((33 + n) & 1)
    raw = bytearray(length)
    raw[0] = length
    raw[2:6] = lba.to_bytes(4, "little")
    raw[6:10] = lba.to_bytes(4, "big")
    raw[10:14] = size.to_bytes(4, "little")
    raw[14:18] = size.to_bytes(4, "big")
    raw[25] = 2 if is_dir else 0
    raw[28:32] = b"\x01\x00\x00\x01"
    raw[32] = n
    raw[33:33 + n] = name
    return raw


def make_disc(out, wrong_serial=False):
    sectors = [bytearray(2352) for _ in range(38)]
    for sector in sectors:
        sector[:12] = SYNC
        sector[15] = 2
    pvd = bytearray(2048)
    pvd[:7] = b"\x01CD001\x01"
    pvd[156:190] = record(b"\x00", 22, 2048, True)
    sectors[16][24:2072] = pvd
    cnf = b"BOOT=cdrom:\\" + (b"SLUS_111.11" if wrong_serial else b"SLUS_009.99") + b";1\r\n"
    directory = bytearray(2048)
    pos = 0
    for item in (record(b"\x00", 22, 2048, True),
                 record(b"\x01", 22, 2048, True),
                 record(b"SYSTEM.CNF;1", 23, len(cnf)),
                 record(b"SLUS_009.99;1", 24, 4096)):
        directory[pos:pos + len(item)] = item
        pos += len(item)
    sectors[22][24:2072] = directory
    sectors[23][24:24 + len(cnf)] = cnf
    exe = bytearray(4096)
    exe[:8] = b"PS-X EXE"
    struct.pack_into("<IIII", exe, 16, 0x80010100, 0, 0x80010000, 2048)
    struct.pack_into("<I", exe, 48, 0x801FFFF0)
    struct.pack_into("<I", exe, 2048, 0x0c000000 | ((0x80010100 >> 2) & 0x3ffffff))
    sectors[24][24:2072] = exe[:2048]
    sectors[25][24:2072] = exe[2048:]
    out.write_bytes(b"".join(sectors))


class TestDiscProbe(unittest.TestCase):
    def test_actual_layout_synthetic(self):
        with tempfile.TemporaryDirectory() as td:
            binpath = Path(td) / "game.bin"
            make_disc(binpath)
            cue = Path(td) / "game.cue"
            cue.write_text('FILE "game.bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n')
            result = analyze(cue, Path(td) / "private")
            self.assertEqual(result["serial"], "SLUS_009.99")
            self.assertEqual(result["executable"]["entry_pc"], "0x80010100")
            self.assertEqual(result["static_jal_seeds"], 1)
            self.assertEqual((Path(td) / "private/SLUS_009.99").stat().st_size, 4096)
            self.assertEqual((Path(td) / "private/seeds.txt").read_text(), "0x80010100\n")

    def test_refuse_wrong_disc(self):
        with tempfile.TemporaryDirectory() as td:
            binpath = Path(td) / "game.bin"
            make_disc(binpath, wrong_serial=True)
            with self.assertRaises(DiscError):
                analyze(binpath)

    def test_refuse_bad_executable(self):
        with self.assertRaises(DiscError):
            exe_header(bytes(4096))

    def test_refuse_cue_parent_escape(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "disc.cue"
            p.write_text('FILE "../secret.bin" BINARY\n  TRACK 01 MODE2/2352\n')
            with self.assertRaises(DiscError):
                cue_to_bin(p)


if __name__ == "__main__":
    unittest.main()
