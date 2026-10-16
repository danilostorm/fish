#!/usr/bin/env python3
"""ROM-side TIM bitmap text translation (no browser overlay). Private builder.

Reads FISHING.DAT from the user's verified translated CD image, patches
indexed 4bpp TIM textures at fixed offsets, then recalculates EDC/ECC on
the raw Mode 2/Form 1 disc sectors. Never overwrites originals.
"""
from __future__ import annotations
import argparse,hashlib,json,shutil,struct
from pathlib import Path
from PIL import Image,ImageFont,ImageDraw
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from psx_sector_ecc import rebuild_form1
from disc_probe import Disc
ROOT=Path(__file__).resolve().parents[1]/'private'/'ptbr'
DAT_LBA=24;DAT_SIZE=74668032
EXPECTED_PREVIOUS_SHA1="bd1722c09d3dc00d65b4c056d1bf4e951cb56ae0"
TIM_OFFSETS={19:1034240,20:1040384}
def tim_decode(data, offset):
    assert struct.unpack_from('<I',data,offset)[0]==16
    flags=struct.unpack_from('<I',data,offset+4)[0]
    assert flags==8
    p=offset+8;clut_len=struct.unpack_from('<I',data,p)[0]
    palette=[struct.unpack_from('<H',data,p+12+i*2)[0] for i in range(16)]
    p+=clut_len
    image_len=struct.unpack_from('<I',data,p)[0]
    x,y,words,h=struct.unpack_from('<HHHH',data,p+4)
    width=words*4;data_offset=p+12;blob=data[data_offset:data_offset+words*2*h]
    assert len(blob)==words*2*h
    pix=bytearray()
    for byte in blob:pix.extend((byte&15,byte>>4))
    im=Image.frombytes('P',(width,h),bytes(pix))
    pal=[]
    for v in palette:
      pal.extend([(v&31)*255//31,((v>>5)&31)*255//31,((v>>10)&31)*255//31])
    im.putpalette(pal+[0]*(768-len(pal)))
    return im,data_offset,blob,palette
def letter(im,rect,text,fontpath,prefer_size=18,fg=15,bg=0,slant=False,max_width=None):
    x0,y0,x1,y1=rect
    d=ImageDraw.Draw(im);d.rectangle((x0,y0,x1-1,y1-1),fill=bg)
    size=prefer_size
    while size>9:
        font=ImageFont.truetype(str(fontpath),size)
        bb=font.getbbox(text)
        if bb[2]-bb[0] < x1-x0-3 and bb[3]-bb[1]<=y1-y0-2:break
        size-=1
    # Render opaque pixels with the source sprite's grayscale ramp palette.
    mask=Image.new('L',(x1-x0,y1-y0),0)
    md=ImageDraw.Draw(mask)
    bb=font.getbbox(text)
    md.text((2-bb[0],(y1-y0-(bb[3]-bb[1]))//2-bb[1]),text,fill=255,font=font)
    if max_width and mask.getbbox() and mask.getbbox()[2]>max_width:
      # The game crops option sprites at original-English glyph widths.
      # Compress horizontally while keeping native glyph height.
      crop=mask.crop((0,0,mask.getbbox()[2],y1-y0))
      crop=crop.resize((max_width,y1-y0),Image.Resampling.LANCZOS)
      mask=Image.new('L',(x1-x0,y1-y0),0)
      mask.paste(crop,(0,0))
    # Original sprite's palette contains white gray ... black.
    rgb=im.getpalette();grays=[rgb[k*3] for k in range(16)]
    px=im.load()
    for yy in range(y1-y0):
      for xx in range(x1-x0):
        level=mask.getpixel((xx,yy))
        if level>0:
          target=255-int(level)
          idx=min(range(3,16) if bg==3 else range(16),key=lambda k:abs(grays[k]-target))
          px[x0+xx,y0+yy]=idx
    return size
def produce_tim_edits(dat,font_bold,font_italic):
    edits={};previews=[]
    for index,start in TIM_OFFSETS.items():
      im,image_start,old,palette=tim_decode(dat,start)
      if index==19:
        # preserves the red band from x~215 onward
        size=letter(im,(0,0,210,32),"ESCOLHA O MODO",font_italic,24,bg=3)
        print('MODE SELECT translated font size',size)
      elif index==20:
        rows=[
         ((0,0,128,18),"INICIANTE",79),
         ((0,18,128,36),"TORNEIO",108),
         ((0,36,137,54),"PESCA LIVRE",104),
         ((0,54,137,72),"VERSUS",60),
         ((0,72,161,90),"MONSTROS",147),
         ((0,90,137,108),"TREINO",84)
        ]
        for rect,label,cap in rows:
          size=letter(im,rect,label,font_bold,18,bg=0,max_width=cap)
          print('row',label,'size',size)
      # Encode the indexed palette image with original pitch and 4bpp nibbles
      packed=bytearray()
      pix=im.tobytes()
      assert len(pix)==im.width*im.height
      for i in range(0,len(pix),2):packed.append((pix[i]&15)|((pix[i+1]&15)<<4))
      assert len(packed)==len(old)
      for offset,(a,b) in enumerate(zip(old,packed)):
        if a!=b:
          key=image_start+offset
          if key in edits:raise ValueError("Overlap")
          edits[key]=b
      previews.append((index,im.convert('RGB').resize((im.width*3,im.height*3),Image.Resampling.NEAREST)))
    return edits,previews
def patch_disc(inp,outbin,edits):
    assert not outbin.exists()
    if hashlib.sha1(inp.read_bytes()).hexdigest()!=EXPECTED_PREVIOUS_SHA1:
      raise ValueError('Wrong input source hash')
    shutil.copyfile(inp,outbin)
    by_sector={}
    for i,val in edits.items():
      by_sector.setdefault(DAT_LBA+i//2048,[]).append((i%2048,val))
    with outbin.open('r+b') as f:
      for lba,patches in sorted(by_sector.items()):
        f.seek(lba*2352);raw=bytearray(f.read(2352))
        for off,value in patches:raw[24+off]=value
        raw=rebuild_form1(raw)
        f.seek(lba*2352);f.write(raw)
    with Disc(outbin) as verify:
      assert verify.files()[0].path.startswith('FISHING.DAT')
      for off,val in edits.items():
        if verify.sector(DAT_LBA+off//2048)[off%2048]!=val:
          raise ValueError("Mismatch")
    return sorted(by_sector)
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--input',type=Path,default=ROOT/'translated/Big_Ol_Bass_PTBR.bin')
 ap.add_argument('--output',type=Path,default=ROOT/'translated_graphics')
 ap.add_argument('--font-bold',type=Path,default=Path('/fonts/DejaVuSansCondensed-Bold.ttf'))
 ap.add_argument('--font-italic',type=Path,default=Path('/fonts/DejaVuSansCondensed-BoldOblique.ttf'))
 ap.add_argument('--preview-only',action='store_true')
 args=ap.parse_args()
 with Disc(args.input) as d:dat=d.extent(DAT_LBA,DAT_SIZE)
 edits,previews=produce_tim_edits(dat,args.font_bold,args.font_italic)
 args.output.mkdir(parents=True,exist_ok=True)
 for index,im in previews:im.save(args.output/f'tim_{index:04}_ptbr_preview.png')
 print('New changed TIM image bytes:',len(edits))
 if args.preview_only:return
 outbin=args.output/'Big_Ol_Bass_PTBR_v2.bin'
 changed_sectors=patch_disc(args.input,outbin,edits)
 (args.output/'Big_Ol_Bass_PTBR_v2.cue').write_text(f'FILE "{outbin.name}" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n')
 report=dict(description='Native ROM graphical TIM translation',tim_offsets={str(k):hex(v) for k,v in TIM_OFFSETS.items()},changed_image_bytes=len(edits),changed_raw_sectors=changed_sectors,sha1=hashlib.sha1(outbin.read_bytes()).hexdigest())
 (args.output/'graphic_report.json').write_text(json.dumps(report,indent=2))
 print(report)
if __name__=="__main__":main()
