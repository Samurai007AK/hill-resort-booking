"""Render the design document and package an allowlisted, credential-free source tree."""
from pathlib import Path
import hashlib
import html
import json
import re
import zipfile

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"
OUT.mkdir(exist_ok=True)
PDF = OUT / "Silver-Oaks-Technical-Design.pdf"
FOREST = colors.HexColor("#254b3b")
COFFEE = colors.HexColor("#85664a")
INK = colors.HexColor("#25372f")
PALE = colors.HexColor("#f0f1e8")

font_dir = Path("C:/Windows/Fonts")
if (font_dir / "arial.ttf").exists():
    for name, filename in [("Body", "arial.ttf"), ("BodyBold", "arialbd.ttf"), ("Display", "georgia.ttf")]:
        pdfmetrics.registerFont(TTFont(name, str(font_dir / filename)))
    pdfmetrics.registerFontFamily("Body", normal="Body", bold="BodyBold", italic="Body", boldItalic="BodyBold")
else:
    pdfmetrics.registerFontFamily("Body", normal="Helvetica", bold="Helvetica-Bold")

body_font = "Body" if (font_dir / "arial.ttf").exists() else "Helvetica"
display_font = "Display" if (font_dir / "georgia.ttf").exists() else "Times-Roman"
styles = getSampleStyleSheet()
styles.add(ParagraphStyle("Copy", fontName=body_font, fontSize=9.1, leading=14, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle("Section", fontName=display_font, fontSize=22, leading=26, textColor=FOREST, spaceBefore=16, spaceAfter=14, keepWithNext=True))
styles.add(ParagraphStyle("Cover", fontName=display_font, fontSize=33, leading=39, textColor=FOREST, spaceAfter=22))
styles.add(ParagraphStyle("Label", fontName=body_font, fontSize=8, leading=12, textColor=COFFEE, spaceAfter=12))
styles.add(ParagraphStyle("CellCopy", parent=styles["Copy"], fontSize=7.5, leading=11, spaceAfter=0))

def clean(text):
    return text.replace("—", "-").replace("–", "-").replace("‑", "-")

def markup(text):
    text = html.escape(clean(text))
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"https://[^\s<]+", lambda match: f'<link href="{match.group(0)}" color="#254b3b">{match.group(0)}</link>', text)
    return text

def architecture():
    drawing = Drawing(485, 128)
    labels = [(0, 68, "Guest / staff browser"), (177, 68, "Next.js pages + actions"), (354, 68, "Postgres + SQL rules"), (177, 3, "Redaction + model checks")]
    for x, y, label in labels:
        drawing.add(Rect(x, y, 131, 44, rx=4, fillColor=PALE, strokeColor=FOREST, strokeWidth=.6))
        drawing.add(String(x+65.5, y+19, label, textAnchor="middle", fontName=body_font, fontSize=7.6, fillColor=INK))
    for start, end in [(131, 177), (308, 354)]:
        drawing.add(Line(start+4, 90, end-7, 90, strokeColor=COFFEE))
        drawing.add(Polygon([end-7,90,end-12,93,end-12,87], fillColor=COFFEE, strokeColor=COFFEE))
    drawing.add(Line(242, 68, 242, 47, strokeColor=COFFEE))
    drawing.add(String(257, 53, "Enquiries only", fontName=body_font, fontSize=7, fillColor=COFFEE))
    return drawing

def data_model():
    drawing = Drawing(485, 150)
    boxes = [(0, 95, "Room types"), (177, 95, "Nightly inventory"), (354, 95, "Reservations"), (354, 20, "Payments"), (0, 20, "Users + roles"), (177, 20, "Enquiries + audit")]
    for x, y, label in boxes:
        drawing.add(Rect(x, y, 131, 40, rx=4, fillColor=PALE, strokeColor=FOREST, strokeWidth=.6))
        drawing.add(String(x+65.5,y+17,label,textAnchor="middle",fontName=body_font,fontSize=8,fillColor=INK))
    for a,b,y in [(131,177,115),(308,354,115),(131,177,40)]:
        drawing.add(Line(a,y,b,y,strokeColor=COFFEE))
    drawing.add(Line(419,95,419,60,strokeColor=COFFEE))
    drawing.add(String(322,77,"price + capacity",textAnchor="middle",fontName=body_font,fontSize=7,fillColor=COFFEE))
    return drawing

def footer(canvas, doc):
    canvas.setStrokeColor(colors.HexColor("#d4dbcd"))
    canvas.line(19*mm, 16*mm, 191*mm, 16*mm)
    canvas.setFillColor(COFFEE)
    canvas.setFont(body_font, 7)
    canvas.drawString(19*mm, 11*mm, "SILVER OAKS / TECHNICAL DESIGN / 02 NOV 2026")
    canvas.drawRightString(191*mm, 11*mm, str(doc.page))

lines = (ROOT / "TDD.md").read_text(encoding="utf-8").splitlines()
story = [Paragraph("ISOCODE / SOFTWARE ENGINEERING", styles["Label"])]
pending = []
table_rows = []

def flush_paragraph():
    if pending:
        story.append(Paragraph(markup(" ".join(pending)), styles["Copy"]))
        pending.clear()

def flush_table():
    if not table_rows:
        return
    cells = [[Paragraph(markup(cell), styles["CellCopy"]) for cell in row] for row in table_rows]
    table = Table(cells, colWidths=[139, 200, 146], repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), PALE), ("TEXTCOLOR",(0,0),(-1,-1),INK), ("VALIGN",(0,0),(-1,-1),"TOP"), ("LINEBELOW",(0,0),(-1,-1),.4,colors.HexColor("#d4dbcd")), ("LEFTPADDING",(0,0),(-1,-1),8), ("RIGHTPADDING",(0,0),(-1,-1),8), ("TOPPADDING",(0,0),(-1,-1),8), ("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    story.append(table)
    story.append(Spacer(1,12))
    table_rows.clear()

for line in lines:
    if line.startswith("|"):
        flush_paragraph()
        row = [part.strip() for part in line.strip("|").split("|")]
        if not all(re.fullmatch(r"[-: ]+", part) for part in row):
            table_rows.append(row)
        continue
    flush_table()
    if line.startswith("# "):
        flush_paragraph()
        story.append(Paragraph(markup(line[2:]), styles["Cover"]))
    elif line.startswith("## "):
        flush_paragraph()
        section = line[3:]
        if section.startswith(("3.", "5.", "7.", "8.", "9.")):
            story.append(PageBreak())
        story.append(Paragraph(markup(section), styles["Section"]))
        if section.startswith("2."):
            story.append(architecture())
        elif section.startswith("3."):
            story.append(data_model())
    elif not line.strip():
        flush_paragraph()
    else:
        pending.append(line)
flush_paragraph()
flush_table()

screens = [(OUT / "qa" / "home-mobile.jpg", "Guest search at phone width"), (OUT / "qa" / "confirmation.jpg", "TestPay confirmation from the browser journey"), (OUT / "qa" / "inbox.jpg", "Staff routing, draft review and provenance")]
available = [(file, caption) for file,caption in screens if file.exists()]
if available:
    story += [PageBreak(), Paragraph("10. Verified interface views", styles["Section"])]
    from PIL import Image as PILImage
    for file, caption in available:
        with PILImage.open(file) as image:
            width,height = image.size
        scale = min(485/width, 490/height)
        story.append(KeepTogether([Paragraph(caption,styles["Label"]),Image(str(file),width=width*scale,height=height*scale),Spacer(1,18)]))

doc = SimpleDocTemplate(str(PDF), pagesize=(210*mm,297*mm), rightMargin=19*mm,leftMargin=19*mm,topMargin=18*mm,bottomMargin=23*mm,title="Silver Oaks - Technical design",author="Silver Oaks")
doc.build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(PDF)
assert len(reader.pages)>=5
assert "github.com/Samurai007AK/hill-resort-booking" in reader.pages[0].extract_text()

allowed_dirs={"src","test","scripts","db","eval",".github","public"}
allowed_files={"package.json","package-lock.json","tsconfig.json","vitest.config.mts","next.config.ts","eslint.config.mjs",".gitignore","README.md","deployment.md","CONTEXT.md","ASSUMPTIONS.md","TDD.md","VERIFICATION.md"}
archive=OUT/"Silver-Oaks-Submission.zip"
manifest={}
with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED) as bundle:
    def put(file, name):
        data=file.read_bytes()
        bundle.writestr(name,data)
        manifest[name]=hashlib.sha256(data).hexdigest()
    put(PDF,PDF.name)
    put(ROOT/"deployment.md","deployment.md")
    for entry in sorted(ROOT.iterdir()):
        if entry.is_file() and entry.name in allowed_files:
            put(entry,"source/"+entry.name)
        elif entry.is_dir() and entry.name in allowed_dirs:
            for file in sorted(entry.rglob("*")):
                if file.is_file() and not any(part.startswith(".env") or part=="__pycache__" for part in file.relative_to(ROOT).parts):
                    put(file,"source/"+file.relative_to(ROOT).as_posix())
    bundle.writestr("MANIFEST-SHA256.json",json.dumps(manifest,indent=2)+"\n")
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    assert not any(any(part.startswith(".env") or part in {"node_modules",".git",".claude",".pgdata",".next"} for part in Path(name).parts) for name in bundle.namelist())
assert archive.stat().st_size < 25*1024*1024
print(f"Created PDF: {len(reader.pages)} pages; ZIP: {archive.stat().st_size:,} bytes; {len(manifest)} verified entries")
