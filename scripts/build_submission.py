"""Render TDD.md to a PDF and zip it with deployment.md for submission.

Run from the repo: python scripts/build_submission.py
Outputs go to ../submission (outside the repo).
"""
from pathlib import Path
import html
import re
import zipfile

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from pypdf import PdfReader
from PIL import Image as PILImage

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / "submission"
OUT.mkdir(exist_ok=True)
PDF = OUT / "Silver-Oaks-Technical-Design.pdf"
ZIP = OUT / "Silver-Oaks-Submission.zip"
GITHUB = "github.com/Samurai007AK/hill-resort-booking"
WIDTH = 485  # usable page width in points

FOREST = colors.HexColor("#254b3b")
COFFEE = colors.HexColor("#85664a")
INK = colors.HexColor("#25372f")
PALE = colors.HexColor("#f0f1e8")
RULE = colors.HexColor("#d4dbcd")

font_dir = Path("C:/Windows/Fonts")
if (font_dir / "arial.ttf").exists():
    for name, filename in [("Body", "arial.ttf"), ("BodyBold", "arialbd.ttf"), ("Display", "georgia.ttf")]:
        pdfmetrics.registerFont(TTFont(name, str(font_dir / filename)))
    pdfmetrics.registerFontFamily("Body", normal="Body", bold="BodyBold", italic="Body", boldItalic="BodyBold")
    body_font, display_font = "Body", "Display"
else:
    body_font, display_font = "Helvetica", "Times-Roman"

copy = ParagraphStyle("Copy", fontName=body_font, fontSize=9.1, leading=14, textColor=INK, spaceAfter=8)
bullet = ParagraphStyle("Bullet", parent=copy, leftIndent=14, bulletIndent=3, spaceAfter=4)
section = ParagraphStyle("Section", fontName=display_font, fontSize=19, leading=24, textColor=FOREST, spaceBefore=16, spaceAfter=10, keepWithNext=True)
cover = ParagraphStyle("Cover", fontName=display_font, fontSize=28, leading=34, textColor=FOREST, spaceAfter=14)
label = ParagraphStyle("Label", fontName=body_font, fontSize=8, leading=12, textColor=COFFEE, spaceAfter=6)
cell = ParagraphStyle("Cell", parent=copy, fontSize=7.6, leading=10.5, spaceAfter=0)


def markup(text):
    parts = html.escape(text.replace("—", "-").replace("–", "-")).split("`")
    for i, part in enumerate(parts):  # odd parts are code spans: no bold or links inside them
        if i % 2:
            parts[i] = f'<font name="Courier">{part}</font>'
        else:
            part = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", part)
            parts[i] = re.sub(r"https://[^\s<]+", lambda m: f'<link href="{m.group(0)}" color="#254b3b">{m.group(0)}</link>', part)
    return "".join(parts)


def box(d, x, y, w, h, title, lines=()):
    d.add(Rect(x, y, w, h, rx=4, fillColor=PALE, strokeColor=FOREST, strokeWidth=.6))
    d.add(String(x + w / 2, y + h - 13, title, textAnchor="middle", fontName=body_font, fontSize=8, fillColor=FOREST))
    for i, line in enumerate(lines):
        d.add(String(x + w / 2, y + h - 25 - i * 9.5, line, textAnchor="middle", fontName=body_font, fontSize=6.6, fillColor=INK))


def arrow(d, x1, y1, x2, y2, text=None):
    d.add(Line(x1, y1, x2, y2, strokeColor=COFFEE, strokeWidth=.8))
    if x1 == x2:  # vertical, pointing down
        d.add(Polygon([x2, y2, x2 - 3, y2 + 5, x2 + 3, y2 + 5], fillColor=COFFEE, strokeColor=COFFEE))
    else:  # horizontal, pointing right
        d.add(Polygon([x2, y2, x2 - 5, y2 + 3, x2 - 5, y2 - 3], fillColor=COFFEE, strokeColor=COFFEE))
    if text:
        d.add(String((x1 + x2) / 2 + (6 if x1 == x2 else 0), (y1 + y2) / 2 + (0 if x1 == x2 else 4), text,
                     textAnchor="start" if x1 == x2 else "middle", fontName=body_font, fontSize=6.4, fillColor=COFFEE))


def architecture():
    d = Drawing(WIDTH, 200)
    box(d, 0, 120, 120, 68, "Browser", ["Guest, staff, GM", "Server-rendered pages", "TestPay (simulated)"])
    box(d, 175, 120, 135, 68, "Next.js on Vercel", ["proxy.ts: role guard", "Server actions + zod", "Signed session cookie"])
    box(d, 365, 120, 120, 68, "Postgres on Neon", ["night_usage view", "assert_capacity + triggers", "apply_payment"])
    box(d, 175, 0, 135, 80, "Enquiry pipeline", ["1. Redact contact details", "2. Keyword + model classify", "3. Screen the answer", "4. decideLane (pure)", "5. Server fills draft slots"])
    box(d, 365, 0, 120, 80, "Model providers", ["apinex: free/qwen-3.8-max", "Ollama: gpt-oss:120b,", "beam, gpt-oss:20b", "then keyword fallback"])
    arrow(d, 120, 154, 175, 154, "HTTPS")
    arrow(d, 310, 154, 365, 154, "pg, SQL")
    arrow(d, 242, 120, 242, 80, "enquiries")
    arrow(d, 310, 40, 365, 40, "redacted text")
    return d


def data_model():
    d = Drawing(WIDTH, 215)
    box(d, 0, 150, 110, 55, "room_types", ["keys_total, max guests", "photos"])
    box(d, 0, 75, 110, 55, "rate_plans", ["factor 1.00 or 0.90"])
    box(d, 150, 150, 160, 55, "inventory_night", ["PK (room_type, night)", "rate_inr, allotment, closed"])
    box(d, 150, 75, 160, 55, "reservation", ["status held | confirmed |", "cancelled | refund_due", "qty, expires_at, idempotency_key"])
    box(d, 350, 150, 135, 55, "night_usage (view)", ["active = confirmed + live holds", "allotment 0 when closed"])
    box(d, 350, 75, 135, 55, "payment", ["PK payment_id (replay-safe)", "outcome"])
    box(d, 150, 0, 160, 55, "promo", ["max_uses, uses", "counted at payment"])
    box(d, 0, 0, 110, 55, "users", ["role guest | staff | gm", "team for staff only"])
    box(d, 350, 0, 135, 55, "enquiry + enquiry_event", ["lane, owner, gm_alert, draft", "append-only audit; ai_cache"])
    arrow(d, 110, 177, 150, 177)
    arrow(d, 55, 150, 55, 130)
    arrow(d, 310, 177, 350, 177)
    arrow(d, 310, 102, 350, 102)
    d.add(Line(310, 120, 350, 160, strokeColor=COFFEE, strokeWidth=.8))
    d.add(String(230, 136, "both tables' triggers call assert_capacity", textAnchor="middle", fontName=body_font, fontSize=6.4, fillColor=COFFEE))
    return d


DIAGRAMS = {"architecture": architecture, "datamodel": data_model}


def screenshots(pics):
    """Lay screenshots out two to a row, each with its caption underneath."""
    col = (WIDTH - 15) / 2
    cells = []
    for path, caption in pics:
        file = ROOT / path
        with PILImage.open(file) as im:
            w, h = im.size
        scale = min(col / w, 300 / h)
        cells.append([Image(str(file), width=w * scale, height=h * scale), Spacer(1, 4), Paragraph(markup(caption), label)])
    grid = [cells[i:i + 2] + [[]] * (2 - len(cells[i:i + 2])) for i in range(0, len(cells), 2)]
    t = Table(grid, colWidths=[col + 7.5, col + 7.5], hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
    return [t]


def table(rows):
    weights = [min(max(max(len(r[i]) for r in rows), 8), 70) for i in range(len(rows[0]))]
    widths = [WIDTH * w / sum(weights) for w in weights]
    cells = [[Paragraph(("<b>%s</b>" if i == 0 else "%s") % markup(c), cell) for c in r] for i, r in enumerate(rows)]
    t = Table(cells, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), PALE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LINEBELOW", (0, 0), (-1, -1), .4, RULE), ("LEFTPADDING", (0, 0), (-1, -1), 6),
                           ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return [t, Spacer(1, 10)]


def footer(canvas, doc):
    canvas.setStrokeColor(RULE)
    canvas.line(19 * mm, 16 * mm, 191 * mm, 16 * mm)
    canvas.setFillColor(COFFEE)
    canvas.setFont(body_font, 7)
    canvas.drawString(19 * mm, 11 * mm, "SILVER OAKS / TECHNICAL DESIGN / " + GITHUB)
    canvas.drawRightString(191 * mm, 11 * mm, str(doc.page))


story = [Paragraph("ISOCODE / SOFTWARE ENGINEERING", label)]
pending, rows, pics = [], [], []


def flush():
    if pics:
        story.extend(screenshots(pics))
        pics.clear()
    if pending:
        story.append(Paragraph(markup(" ".join(pending)), copy))
        pending.clear()
    if rows:
        story.extend(table(rows))
        rows.clear()


for line in (ROOT / "TDD.md").read_text(encoding="utf-8").splitlines():
    if line.startswith("|"):
        if pending:
            story.append(Paragraph(markup(" ".join(pending)), copy))
            pending.clear()
        row = [p.strip() for p in line.strip().strip("|").split("|")]
        if not all(re.fullmatch(r"[-: ]+", p) for p in row):
            rows.append(row)
        continue
    image = re.fullmatch(r"!\[(.+)\]\((.+)\)", line.strip())
    diagram = re.fullmatch(r"<!-- diagram:(\w+) -->", line.strip())
    item = re.match(r"(- |\d+\. )(.*)", line)
    if image:
        pics.append((image.group(2), image.group(1)))
        continue
    if not line.strip():
        if pending:
            story.append(Paragraph(markup(" ".join(pending)), copy))
            pending.clear()
        continue
    flush()
    if line.startswith("# "):
        story.append(Paragraph(markup(line[2:]), cover))
    elif line.startswith("## "):
        story.append(Paragraph(markup(line[3:]), section))
    elif diagram:
        story += [DIAGRAMS[diagram.group(1)](), Spacer(1, 12)]
    elif item:
        mark = "•" if item.group(1) == "- " else item.group(1).strip()
        story.append(Paragraph(markup(item.group(2)), bullet, bulletText=mark))
    else:
        pending.append(line.strip())
flush()

doc = SimpleDocTemplate(str(PDF), pagesize=(210 * mm, 297 * mm), rightMargin=19 * mm, leftMargin=19 * mm,
                        topMargin=18 * mm, bottomMargin=23 * mm, title="Silver Oaks - Technical design",
                        author="Silver Oaks")
doc.build(story, onFirstPage=footer, onLaterPages=footer)

reader = PdfReader(PDF)
first = reader.pages[0].extract_text()
assert GITHUB in first and "hill-resort-booking-mu.vercel.app" in first, "GitHub URL and live link must be on page 1"

# The task asks for exactly two files: the TDD and deployment.md.
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as bundle:
    bundle.write(PDF, PDF.name)
    bundle.write(ROOT / "deployment.md", "deployment.md")
with zipfile.ZipFile(ZIP) as bundle:
    assert bundle.testzip() is None
    names = bundle.namelist()
    assert sorted(names) == sorted([PDF.name, "deployment.md"]), names
    assert not any(any(p.startswith(".env") or p in {"node_modules", ".git", ".pgdata", ".next"} for p in Path(n).parts) for n in names)
print(f"PDF: {PDF} ({len(reader.pages)} pages)\nZIP: {ZIP} ({ZIP.stat().st_size:,} bytes): {', '.join(names)}")
