#!/usr/bin/env python3
"""Concise eight-page illustrated guide. Uses real DEMO UI screenshots only."""
from pathlib import Path
from io import BytesIO
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from guide_v3_content import CZ, UK
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'frontend/public/help/demstav-guide-cz-uk.pdf'
ASSETS=ROOT/'scripts/guide-assets'
W,H=419.528,595.276
M=27
INK,MUTED,YELLOW,BG=map(HexColor,['#0B0F14','#536172','#FFD200','#F1F4F7'])
BASE='https://demstav-operations.onrender.com'
for name,file in [('Guide','DejaVuSans.ttf'),('GuideBold','DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold')
BODY=ParagraphStyle('body',fontName='Guide',fontSize=9,leading=12,textColor=INK)
SMALL=ParagraphStyle('small',parent=BODY,fontSize=7.6,leading=10,textColor=MUTED)
HEAD=ParagraphStyle('head',parent=BODY,fontName='GuideBold',fontSize=10.2,leading=13)
TITLE=ParagraphStyle('title',parent=BODY,fontName='GuideBold',fontSize=22,leading=25)

def para(c,text,x,y,width,style):
    p=Paragraph(text,style);_,height=p.wrap(width,H)
    p.drawOn(c,x,y-height)
    return y-height

def screenshot(c,path,top,max_height):
    with Image.open(path) as source:
        source.load();im=source.convert('RGB')
    # Crop the page placement, not the source bitmap. The original screenshot
    # remains unchanged and reproducible alongside its capture provenance.
    cx,cy,cw,ch=(472,158,405,650) if im.width>800 else (0,0,im.width,im.height)
    scale=min((W-2*M)/cw,max_height/ch)
    width,height=cw*scale,ch*scale;x=(W-width)/2
    c.setFillColor(white);c.roundRect(x-3,top-height-3,width+6,height+6,5,fill=1,stroke=0)
    c.saveState();clip=c.beginPath();clip.rect(x,top-height,width,height);c.clipPath(clip,stroke=0,fill=0)
    c.drawImage(ImageReader(im),x-cx*scale,top-height-(im.height-cy-ch)*scale,im.width*scale,im.height*scale,mask='auto')
    c.restoreState()
    return top-height

def render(c,data,n,uk):
    c.setFillColor(BG);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(INK);c.rect(0,H-47,W,47,fill=1,stroke=0)
    c.setFont('GuideBold',16);c.setFillColor(white);c.drawString(M,H-29,'DEMSTAV')
    c.setFont('Guide',8);c.setFillColor(YELLOW);c.drawRightString(W-M,H-28,'OPERATIONS / '+('УКР' if uk else 'CZ'))
    c.setFillColor(YELLOW);c.rect(0,H-50,W,3,fill=1,stroke=0)
    y=para(c,data['title'],M,H-67,W-2*M,TITLE)-7
    y=para(c,data['intro'],M,y,W-2*M,BODY)-11
    needed=0
    for title,text in data['blocks']:
        for value,style in [(title,HEAD),(text,BODY)]:
            p=Paragraph(value,style);needed+=p.wrap(W-2*M,H)[1]
        needed+=10
    available=y-needed-68
    height=min(data.get('image_max',265),available)
    if height<135:raise RuntimeError(f'Insufficient screenshot space on page {n}: {height}')
    y=screenshot(c,ASSETS/data['asset'],y,height)-7
    caption='Справжній інтерфейс · вигадані DEMO дані' if uk else 'Skutečné rozhraní · fiktivní DEMO data'
    y=para(c,caption,M,y,W-2*M,SMALL)-10
    for title,text in data['blocks']:
        y=para(c,title,M,y,W-2*M,HEAD)-2
        y=para(c,text,M,y,W-2*M,BODY)-8
    if y<40:raise RuntimeError(f'Page {n} overflows: {y}')
    c.setStrokeColor(HexColor('#CFD6DF'));c.line(M,32,W-M,32)
    c.setFillColor(MUTED);c.setFont('Guide',6.8)
    c.drawString(M,20,'Jak na to / Як користуватися · v3 · 29. 10. 2026')
    c.drawRightString(W-M,20,f'{n} / 8')
    c.bookmarkPage(f'p{n}');c.addOutlineEntry(('UK / ' if uk else 'CZ / ')+data['title'],f'p{n}',0,False)
    c.linkURL(BASE+data['route'],(M,35,W-M,H-51),relative=0,thickness=0)
    c.showPage()

def main():
    missing=[name for name in ['today.jpg','record.jpg','guide.jpg','attendance.jpg'] if not (ASSETS/name).is_file()]
    if missing:raise SystemExit('Missing real DEMO screenshots; current PDF preserved: '+', '.join(missing))
    OUT.parent.mkdir(parents=True,exist_ok=True);data=BytesIO()
    c=canvas.Canvas(data,pagesize=(W,H),pageCompression=1,invariant=1)
    c.setTitle('DEMSTAV Operations | Stručný návod CZ/UK')
    c.setAuthor('DEMSTAV Operations');c.setCreator('DEMSTAV Operations - guide generator v3')
    c.setSubject('Skutečné rozhraní s fiktivními DEMO daty; stručný průvodce CZ/UK')
    for i,page in enumerate(CZ,1):render(c,page,i,False)
    for i,page in enumerate(UK,5):render(c,page,i,True)
    c.save();OUT.write_bytes(data.getvalue());print(OUT)

if __name__=='__main__':main()
