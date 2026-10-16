#!/usr/bin/env python3
"""PS1 raw Mode 2 Form 1 EDC/ECC, standard ECM sector parity algorithm."""
from __future__ import annotations
import struct
_EDC=[]
_ECC_F=[0]*256;_ECC_B=[0]*256
for i in range(256):
    edc=i
    for _ in range(8):edc=(edc>>1)^(0xD8018001 if edc&1 else 0)
    _EDC.append(edc)
    j=(i<<1)^(0x11d if i & 0x80 else 0)
    _ECC_F[i]=j;_ECC_B[i^j]=i

def edc(data):
    value=0
    for char in data:value=(value>>8)^_EDC[(value^char)&255]
    return value

def parity(data,major_count,minor_count,major_mult,minor_inc):
    size=major_count*minor_count
    assert len(data)>=size
    result=bytearray(major_count*2)
    for major in range(major_count):
        index=(major>>1)*major_mult+(major&1)
        a=b=0
        for _ in range(minor_count):
            c=data[index];index=(index+minor_inc)%size
            a^=c;b^=c
            a=_ECC_F[a]
        a=_ECC_B[_ECC_F[a]^b]
        result[major]=a;result[major+major_count]=a^b
    return result

def rebuild_form1(raw):
    if len(raw)!=2352:raise ValueError("Expected 2352 bytes per raw CD sector")
    if raw[:12]!=b"\0"+b"\xff"*10+b"\0" or raw[15]!=2 or raw[18]&0x20:
        raise ValueError("Only Mode2/Form1 sectors accepted")
    buf=bytearray(raw)
    struct.pack_into("<I",buf,2072,edc(buf[16:2072]))
    prefix=bytearray(buf[12:2076]);prefix[:4]=bytes(4)
    buf[2076:2248]=parity(prefix,86,24,2,86)
    buf[2248:2352]=parity(prefix+buf[2076:2248],52,43,86,88)
    return bytes(buf)

if __name__=="__main__":
    from pathlib import Path
    import sys
    with Path(sys.argv[1]).open('rb') as f:
        for lba in (16,23,24,100,36483,36484,36500,36700):
            f.seek(lba*2352);raw=f.read(2352)
            patched=rebuild_form1(raw)
            assert raw==patched,(lba,'ECC/EDC did not match',raw[2072:2080].hex(),patched[2072:2080].hex())
            print("EDC/ECC exact match LBA",lba)
