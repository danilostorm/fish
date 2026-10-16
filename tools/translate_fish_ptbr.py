#!/usr/bin/env python3
"""Deterministic PT-BR binary translation patch for USA PS1 Fisherman's Bait 2.

Edits original executable *inside* a private, copied MODE2/2352 BIN/CUE image,
recalculating real EDC/ECC P/Q on every changed sector. No runtime overlays.
Only known ASCII text is replaced; no accent glyphs before font analysis.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from psx_sector_ecc import rebuild_form1
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from disc_probe import Disc

ORIGINAL_DISC_SHA1="8793d3c52e415221bd04be24bb4773b82d08185a"
ORIGINAL_EXE_SHA256="1a180fb9374ed1e42ef049913b5000749687772ff6d8d36433552e8d94495658"
EXE_LBA=36483
EXE_SIZE=727040
EXE_TEXT_SIZE=724992
EXE_NAME="SLUS_009.99"
# Exact first file offsets, expected bytes and replacement. Never repack, never move assets.
# No fake claims: main MODE SELECT menu is still a texture/packed resource.
STRINGS=[
    (0x9C21F,"PRESS START BUTTON","APERTE START"),
    (0x9C203,"PLEASE INSERT COIN","INSIRA UMA MOEDA"),
    (0x9C1BB,"CREDIT(S)","CREDITOS"),
    (0x9C1CC,"CREDIT(S)","CREDITOS"),
    (0x9C1DF,"COIN(S)","MOEDAS"),
    (0x9C1F1,"COIN(S)","MOEDAS"),
    (0x9C197,"FREE PLAY","JOGAR"),
    (0x9C1A8,"FREE PLAY","JOGAR"),
    (0x63E0,"ENTER YOUR NAME","DIGITE SEU NOME"),
    (0x63F0,"YOU ARE IN RANKING","ENTROU NO RANKING"),
    (0x91C,"No blocks available.","Sem blocos livres."),
    (0x940,"Load error.","Falha carga"),
    (0x94C,"Checking MEMORY CARD...","Checando cartao..."),
    (0x970,"Loading...","Lendo..."),
    (0x97C,"Initializing...","Iniciando..."),
    (0x9AC,"Not initialized.","Nao iniciado."),
    (0x9C0,"MEMORY CARD error.","Erro no CARTAO."),
    (0x9D4,"Communication error.","Erro comunicacao."),
    (0x9EC,"No data found.","Sem dados."),
    (0x98C,"Initialize?          YES NO ","Iniciar?             SIM NAO"),
    (0x8CC,"Save on another MEMORY CARD?      YES NO","Salvar em outro cartao?      SIM NAO"),
]
# Verify manually against the genuine SLUS EXE before accepting any output.

def sha(path,algorithm):
    h=hashlib.new(algorithm)
    with path.open("rb") as f:
        for part in iter(lambda:f.read(2**20),b""):h.update(part)
    return h.hexdigest()

def patch_exe(original):
    out=bytearray(original);report=[]
    for offset,old,new in STRINGS:
        oldb=old.encode('ascii');newb=new.encode('ascii')
        if len(newb)>len(oldb):raise ValueError("Translation too long at %x"%offset)
        if original[offset:offset+len(oldb)]!=oldb:
            found=repr(original[offset:offset+len(oldb)])
            raise ValueError(f"Source mismatch at EXE 0x{offset:06x}: {found} != {old!r}")
        # Keep original string length and NUL position unchanged.
        # Fill with ASCII spaces rather than shifting binary offsets.
        padded=newb.ljust(len(oldb),b" ")
        out[offset:offset+len(oldb)]=padded
        report.append(dict(exe_offset=f"0x{offset:06x}",original=old,pt_br=new,
                           allocated_bytes=len(oldb)))
    return bytes(out),report

def patch_image(source,outbin,outcue):
    if outbin.exists() or outcue.exists():
        raise FileExistsError("Refusing overwrite: use a fresh destination directory")
    if sha(source,"sha1")!=ORIGINAL_DISC_SHA1:
        raise ValueError("Only verified USA Redump BIN (SLUS-00999) can be patched")
    with Disc(source) as disc:
        entries={e.path.upper().split(";")[0]:e for e in disc.files()}
        entry=entries[EXE_NAME]
        if (entry.lba,entry.size)!=(EXE_LBA,EXE_SIZE):raise ValueError("Unexpected EXE extent")
        original=disc.extent(entry.lba,entry.size)
    if hashlib.sha256(original).hexdigest()!=ORIGINAL_EXE_SHA256:
        raise ValueError("Unexpected EXE SHA-256")
    replacement,manifest=patch_exe(original)
    changed_sectors={}
    for i,(a,b) in enumerate(zip(original,replacement)):
        if a!=b:
            lba=EXE_LBA+i//2048
            changed_sectors.setdefault(lba,[]).append((i%2048,b))
    if not changed_sectors:raise ValueError("No modifications")
    outbin.parent.mkdir(parents=True,exist_ok=True)
    temp=outbin.with_suffix(".writing")
    try:
        shutil.copyfile(source,temp)
        with temp.open("r+b") as f:
            for lba,edits in sorted(changed_sectors.items()):
                f.seek(lba*2352)
                sector=bytearray(f.read(2352))
                if len(sector)!=2352:raise ValueError("Truncated sector")
                for offset,value in edits:sector[24+offset]=value
                sector=rebuild_form1(sector)
                f.seek(lba*2352)
                f.write(sector)
            f.flush()
        with Disc(temp) as check:
            assert check.extent(EXE_LBA,EXE_SIZE)==replacement
            assert check.files()[0].path.startswith("FISHING.DAT")
        temp.replace(outbin)
        outcue.write_text('FILE "'+outbin.name+'"\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n',encoding="ascii")
    except:
        temp.unlink(missing_ok=True)
        raise
    report=dict(title="Fisherman's Bait 2: Big Ol' Bass / PT-BR native patch",
                source_sha1=ORIGINAL_DISC_SHA1,translated_bin_sha1=sha(outbin,"sha1"),
                source_exe_sha256=ORIGINAL_EXE_SHA256,translated_exe_sha256=hashlib.sha256(replacement).hexdigest(),
                changed_raw_sectors=[int(i) for i in sorted(changed_sectors)],
                changed_bytes=sum(len(x) for x in changed_sectors.values()),translations=manifest,
                warning="Initial ASCII-only patch: textured menus/English voice remain untranslated")
    (outbin.parent/"translation_report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    return report

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("source",type=Path,help="Private original USA raw .bin file")
    ap.add_argument("--out",type=Path,default=Path("private/ptbr/translated"),help="Private destination directory")
    args=ap.parse_args()
    dest=args.out.resolve()
    report=patch_image(args.source.resolve(),dest/"Big_Ol_Bass_PTBR.bin",dest/"Big_Ol_Bass_PTBR.cue")
    print(json.dumps({k:v for k,v in report.items() if k!="translations"},indent=2))
    print(f"Translations: {len(report['translations'])}; output in {dest}")
if __name__=="__main__":
    main()
