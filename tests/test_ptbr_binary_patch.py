import sys,unittest,struct
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from psx_sector_ecc import rebuild_form1,edc
from translate_fish_ptbr import STRINGS,patch_exe

class SectorTests(unittest.TestCase):
    def make_sector(self):
        raw=bytearray(2352)
        raw[:12]=b'\x00'+b'\xff'*10+b'\x00'
        raw[15]=2
        raw[16:24]=b'\x00\x00\x08\x00\x00\x00\x08\x00'
        raw[24:2072]=bytes(i%251 for i in range(2048))
        return raw
    def test_recalculate_is_stable(self):
        first=rebuild_form1(self.make_sector())
        self.assertEqual(first,rebuild_form1(first))
        self.assertEqual(struct.unpack_from('<I',first,2072)[0],edc(first[16:2072]))
    def test_modified_payload_changes_ecc(self):
        sector=self.make_sector();before=rebuild_form1(sector)
        sector[100]+=1
        after=rebuild_form1(sector)
        self.assertNotEqual(before[2072:],after[2072:])
    def test_wrong_sector_is_rejected(self):
        sector=self.make_sector()
        sector[15]=1
        with self.assertRaises(ValueError):
            rebuild_form1(sector)
    def test_text_replace_exact_size(self):
        src=bytearray(727040)
        for offset,old,new in STRINGS:
            src[offset:offset+len(old)]=old.encode('ascii')
        new,report=patch_exe(bytes(src))
        self.assertEqual(len(new),len(src))
        self.assertEqual(len(report),len(STRINGS))
        for offset,old,portuguese in STRINGS:
            self.assertEqual(new[offset:offset+len(old)].decode('ascii').rstrip(),portuguese)
        self.assertEqual(src[450000:450100],new[450000:450100])
if __name__=='__main__':unittest.main()
