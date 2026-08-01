#!/usr/bin/env python3
"""Build a polished, shareable PDF from docs/PRD.md."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Flowable,
    Frame,
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "PRD.md"
OUTPUT = ROOT / "output" / "pdf" / "ProReach-Product-Requirements-Document.pdf"

PAGE_W, PAGE_H = A4
INK = colors.HexColor("#181822")
MUTED = colors.HexColor("#686875")
PURPLE = colors.HexColor("#6D4CE8")
PURPLE_DARK = colors.HexColor("#4D35B5")
PURPLE_SOFT = colors.HexColor("#EEEAFE")
LIME = colors.HexColor("#B9F45C")
GREEN = colors.HexColor("#2E8C69")
GREEN_SOFT = colors.HexColor("#EAF8F2")
PAPER = colors.HexColor("#FBFAF7")
WHITE = colors.white
LINE = colors.HexColor("#DDDCE3")
CODE_BG = colors.HexColor("#F1F0F4")


def ascii_safe(value: str) -> str:
    """Normalize punctuation to the WinAnsi-safe set used by built-in PDF fonts."""
    replacements = {
        "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": " - ",
        "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
        "\u2026": "...", "\u2192": "->", "\u2190": "<-", "\u2194": "<->",
        "\u2265": ">=", "\u2264": "<=", "\u00d7": "x", "\u00a0": " ",
        "\u2713": "Yes", "\u2714": "Yes", "\u2715": "x", "\u2022": "-",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value.encode("cp1252", "replace").decode("cp1252")


def inline_markup(value: str) -> str:
    value = ascii_safe(value.strip())
    code_values: list[str] = []

    def stash_code(match: re.Match[str]) -> str:
        code_values.append(html.escape(match.group(1)))
        return f"@@CODE{len(code_values) - 1}@@"

    value = re.sub(r"`([^`]+)`", stash_code, value)
    value = html.escape(value, quote=False)
    def format_link(match: re.Match[str]) -> str:
        label, target = match.group(1), html.unescape(match.group(2))
        if target.startswith("#"):
            return f'<font color="#4D35B5">{label}</font>'
        return f'<link href="{target}" color="#4D35B5"><u>{label}</u></link>'

    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", format_link, value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    for index, code in enumerate(code_values):
        value = value.replace(
            f"@@CODE{index}@@",
            f'<font name="Courier" color="#4D35B5">{code}</font>',
        )
    return value


class RequirementBadge(Flowable):
    def __init__(self, label: str, width: float = 38 * mm, height: float = 7 * mm):
        super().__init__()
        self.label = label
        self.width = width
        self.height = height

    def draw(self) -> None:
        canvas = self.canv
        canvas.setFillColor(PURPLE_SOFT)
        canvas.roundRect(0, 0, self.width, self.height, 3.5 * mm, stroke=0, fill=1)
        canvas.setFillColor(PURPLE_DARK)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawCentredString(self.width / 2, 2.25 * mm, self.label)


class ProductFlowDiagram(Flowable):
    """Compact two-row rendering of the PRD's primary activation flow."""

    def __init__(self, width: float):
        super().__init__()
        self.width = width
        self.height = 52 * mm
        self.nodes = [
            "Google\nsign-in", "Create\nproject", "Website\nautofill", "Review\nproduct truth",
            "Generate\ncampaign", "Edit and\napprove", "Connect\nwith OAuth", "Publish or\nschedule",
        ]

    def draw(self) -> None:
        canvas = self.canv
        margin = 4 * mm
        gap = 3 * mm
        cols = 4
        box_w = (self.width - margin * 2 - gap * 3) / cols
        box_h = 14 * mm
        y_top = self.height - 19 * mm
        y_bottom = 7 * mm
        positions: list[tuple[float, float]] = []
        for index in range(4):
            positions.append((margin + index * (box_w + gap), y_top))
        for index in range(4):
            positions.append((margin + (3 - index) * (box_w + gap), y_bottom))

        for index, ((x, y), label) in enumerate(zip(positions, self.nodes)):
            canvas.setFillColor(PURPLE_SOFT if index not in (3, 5, 7) else GREEN_SOFT)
            canvas.setStrokeColor(PURPLE if index not in (3, 5, 7) else GREEN)
            canvas.setLineWidth(0.8)
            canvas.roundRect(x, y, box_w, box_h, 3 * mm, stroke=1, fill=1)
            canvas.setFillColor(INK)
            canvas.setFont("Helvetica-Bold", 7.4)
            lines = label.split("\n")
            for line_index, line in enumerate(lines):
                canvas.drawCentredString(x + box_w / 2, y + box_h / 2 + 1.5 * mm - line_index * 3.3 * mm, line)

        canvas.setStrokeColor(MUTED)
        canvas.setFillColor(MUTED)
        canvas.setLineWidth(0.8)
        for index in range(len(positions) - 1):
            x1, y1 = positions[index]
            x2, y2 = positions[index + 1]
            if index == 3:
                start = (x1 + box_w / 2, y1)
                end = (x2 + box_w / 2, y2 + box_h)
            else:
                direction = 1 if x2 > x1 else -1
                start = (x1 + (box_w if direction > 0 else 0), y1 + box_h / 2)
                end = (x2 + (0 if direction > 0 else box_w), y2 + box_h / 2)
            canvas.line(start[0], start[1], end[0], end[1])
            angle = 1 if end[0] >= start[0] else -1
            canvas.line(end[0], end[1], end[0] - angle * 2 * mm, end[1] + 1 * mm)
            canvas.line(end[0], end[1], end[0] - angle * 2 * mm, end[1] - 1 * mm)


class PRDDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, styles: dict[str, ParagraphStyle]):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=20 * mm,
            rightMargin=20 * mm,
            topMargin=22 * mm,
            bottomMargin=19 * mm,
            title="ProReach Product Requirements Document",
            author="ProReach",
            subject="Product reset and reliable V1 requirements",
        )
        self.styles_map = styles
        content_frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="content",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id="cover", showBoundary=0)
        self.addPageTemplates([
            PageTemplate(id="Cover", frames=[cover_frame], onPage=draw_cover),
            PageTemplate(id="Content", frames=[content_frame], onPage=draw_content_page),
        ])

    def afterFlowable(self, flowable: Flowable) -> None:
        if not isinstance(flowable, Paragraph):
            return
        level_by_style = {"PRD-H1": 0, "PRD-H2": 1, "PRD-H3": 2}
        style_name = flowable.style.name
        if style_name not in level_by_style:
            return
        level = level_by_style[style_name]
        text = flowable.getPlainText()
        key = f"section-{self.seq.nextf('section')}"
        self.canv.bookmarkPage(key)
        self.canv.addOutlineEntry(text, key, level=level, closed=level > 0)
        self.notify("TOCEntry", (level, text, self.page, key))


def draw_cover(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(INK)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    canvas.setFillColor(PURPLE)
    canvas.circle(PAGE_W - 10 * mm, PAGE_H - 22 * mm, 47 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.Color(0.73, 0.96, 0.36, alpha=0.95))
    canvas.circle(PAGE_W - 29 * mm, PAGE_H - 27 * mm, 16 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.Color(1, 1, 1, alpha=0.05))
    canvas.circle(17 * mm, 20 * mm, 58 * mm, fill=1, stroke=0)

    canvas.setFillColor(LIME)
    canvas.roundRect(22 * mm, PAGE_H - 44 * mm, 30 * mm, 8 * mm, 4 * mm, fill=1, stroke=0)
    canvas.setFillColor(INK)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawCentredString(37 * mm, PAGE_H - 41.2 * mm, "PROREACH")

    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 31)
    canvas.drawString(22 * mm, PAGE_H - 83 * mm, "Product Requirements")
    canvas.drawString(22 * mm, PAGE_H - 97 * mm, "Document")

    canvas.setFillColor(colors.HexColor("#C9C7D1"))
    canvas.setFont("Helvetica", 13)
    canvas.drawString(22 * mm, PAGE_H - 114 * mm, "Product reset and reliable V1")

    canvas.setFillColor(PURPLE_SOFT)
    canvas.roundRect(22 * mm, PAGE_H - 163 * mm, PAGE_W - 44 * mm, 30 * mm, 5 * mm, fill=1, stroke=0)
    canvas.setFillColor(PURPLE_DARK)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(29 * mm, PAGE_H - 144 * mm, "PRODUCT OUTCOME")
    canvas.setFillColor(INK)
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(29 * mm, PAGE_H - 153 * mm, "From a real website to an approved campaign")
    canvas.setFont("Helvetica", 10)
    canvas.drawString(29 * mm, PAGE_H - 159 * mm, "in under 15 minutes - without losing factual or publishing control.")

    canvas.setFillColor(colors.HexColor("#AAA8B4"))
    canvas.setFont("Helvetica", 9)
    canvas.drawString(22 * mm, 28 * mm, "Version 1.0  |  July 30, 2026")
    canvas.drawRightString(PAGE_W - 22 * mm, 28 * mm, "Team working draft")
    canvas.restoreState()


def draw_content_page(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, PAGE_H - 14 * mm, PAGE_W - 20 * mm, PAGE_H - 14 * mm)
    canvas.setFillColor(PURPLE_DARK)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.drawString(20 * mm, PAGE_H - 10.5 * mm, "PROREACH")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawRightString(PAGE_W - 20 * mm, PAGE_H - 10.5 * mm, "PRODUCT REQUIREMENTS DOCUMENT")

    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 13 * mm, PAGE_W - 20 * mm, 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.2)
    canvas.drawString(20 * mm, 8.5 * mm, "Team working draft")
    canvas.drawRightString(PAGE_W - 20 * mm, 8.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_styles() -> dict[str, ParagraphStyle]:
    sample = getSampleStyleSheet()
    body = ParagraphStyle(
        "PRD-Body",
        parent=sample["BodyText"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13.2,
        textColor=INK,
        spaceAfter=2.8 * mm,
        allowWidows=0,
        allowOrphans=0,
    )
    return {
        "body": body,
        "small": ParagraphStyle("PRD-Small", parent=body, fontSize=8, leading=10.5, textColor=MUTED),
        "h1": ParagraphStyle(
            "PRD-H1", parent=sample["Heading1"], fontName="Helvetica-Bold", fontSize=21,
            leading=25, textColor=INK, spaceBefore=6 * mm, spaceAfter=7 * mm,
            keepWithNext=1,
        ),
        "h2": ParagraphStyle(
            "PRD-H2", parent=sample["Heading2"], fontName="Helvetica-Bold", fontSize=14,
            leading=17, textColor=PURPLE_DARK, spaceBefore=5 * mm, spaceAfter=3 * mm, keepWithNext=1,
        ),
        "h3": ParagraphStyle(
            "PRD-H3", parent=sample["Heading3"], fontName="Helvetica-Bold", fontSize=11.2,
            leading=14, textColor=INK, spaceBefore=4.5 * mm, spaceAfter=2.2 * mm, keepWithNext=1,
        ),
        "quote": ParagraphStyle(
            "PRD-Quote", parent=body, fontName="Helvetica-BoldOblique", fontSize=11.2, leading=16,
            textColor=PURPLE_DARK, leftIndent=8 * mm, rightIndent=8 * mm, spaceBefore=2 * mm,
            spaceAfter=5 * mm, borderColor=PURPLE, borderWidth=0, borderPadding=4 * mm,
            backColor=PURPLE_SOFT,
        ),
        "code": ParagraphStyle(
            "PRD-Code", parent=body, fontName="Courier", fontSize=7.3, leading=9.7,
            textColor=INK, leftIndent=4 * mm, rightIndent=4 * mm, spaceBefore=1.5 * mm,
            spaceAfter=4 * mm, borderPadding=3 * mm, backColor=CODE_BG,
        ),
        "table_header": ParagraphStyle(
            "PRD-TableHeader", parent=body, fontName="Helvetica-Bold", fontSize=7.4,
            leading=9.2, textColor=WHITE, spaceAfter=0,
        ),
        "table_body": ParagraphStyle(
            "PRD-TableBody", parent=body, fontSize=7.3, leading=9.6, spaceAfter=0,
        ),
        "toc_title": ParagraphStyle(
            "PRD-TOCTitle", parent=sample["Heading1"], fontName="Helvetica-Bold", fontSize=22,
            leading=26, textColor=INK, spaceAfter=8 * mm,
        ),
    }


def parse_table(lines: list[str], styles: dict[str, ParagraphStyle], available_width: float) -> Table:
    rows: list[list[str]] = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells):
            continue
        rows.append(cells)
    column_count = max(len(row) for row in rows)
    normalized = [row + [""] * (column_count - len(row)) for row in rows]
    data = []
    for row_index, row in enumerate(normalized):
        style = styles["table_header"] if row_index == 0 else styles["table_body"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])

    if column_count == 2:
        widths = [available_width * 0.30, available_width * 0.70]
    elif column_count == 3:
        widths = [available_width * 0.25, available_width * 0.18, available_width * 0.57]
    elif column_count == 4:
        widths = [available_width * 0.20, available_width * 0.28, available_width * 0.18, available_width * 0.34]
    elif column_count == 5:
        widths = [available_width * factor for factor in (0.13, 0.17, 0.13, 0.18, 0.39)]
    else:
        widths = [available_width / column_count] * column_count

    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT", splitByRow=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2.0 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.0 * mm),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
    ]
    for row_index in range(1, len(data)):
        commands.append(("BACKGROUND", (0, row_index), (-1, row_index), WHITE if row_index % 2 else colors.HexColor("#F5F4F7")))
    table.setStyle(TableStyle(commands))
    return table


def list_flowable(items: list[str], ordered: bool, styles: dict[str, ParagraphStyle]) -> ListFlowable:
    flow_items = [
        ListItem(Paragraph(inline_markup(item), styles["body"]), leftIndent=4 * mm)
        for item in items
    ]
    return ListFlowable(
        flow_items,
        bulletType="1" if ordered else "bullet",
        start="1" if ordered else "-",
        leftIndent=6 * mm,
        bulletFontName="Helvetica-Bold",
        bulletFontSize=7.5,
        bulletColor=PURPLE_DARK,
        spaceAfter=3 * mm,
    )


def story_from_markdown(markdown: str, styles: dict[str, ParagraphStyle], width: float) -> list[Flowable]:
    lines = markdown.splitlines()
    story: list[Flowable] = []
    index = 0
    in_code = False
    code_language = ""
    code_lines: list[str] = []
    first_title_skipped = False
    metadata_complete = False

    def flush_code() -> None:
        nonlocal code_lines, code_language
        if code_language == "mermaid":
            story.append(Spacer(1, 2 * mm))
            story.append(ProductFlowDiagram(width))
            story.append(Spacer(1, 5 * mm))
        else:
            safe = ascii_safe("\n".join(code_lines))
            story.append(XPreformatted(html.escape(safe), styles["code"]))
        code_lines = []
        code_language = ""

    while index < len(lines):
        raw = lines[index]
        stripped = raw.strip()

        if stripped.startswith("```"):
            if in_code:
                flush_code()
                in_code = False
            else:
                in_code = True
                code_language = stripped[3:].strip().lower()
            index += 1
            continue
        if in_code:
            code_lines.append(raw)
            index += 1
            continue

        if not first_title_skipped and raw.startswith("# "):
            first_title_skipped = True
            index += 1
            continue
        if first_title_skipped and not metadata_complete:
            if stripped == "---":
                metadata_complete = True
            index += 1
            continue

        if not stripped:
            index += 1
            continue
        if stripped == "---":
            story.append(Spacer(1, 2 * mm))
            story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceBefore=1 * mm, spaceAfter=4 * mm))
            index += 1
            continue

        table_match = stripped.startswith("|") and stripped.endswith("|")
        if table_match:
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|") and lines[index].strip().endswith("|"):
                table_lines.append(lines[index])
                index += 1
            story.append(parse_table(table_lines, styles, width))
            story.append(Spacer(1, 4 * mm))
            continue

        bullet_match = re.match(r"^-\s+(.+)$", stripped)
        number_match = re.match(r"^\d+\.\s+(.+)$", stripped)
        if bullet_match or number_match:
            ordered = bool(number_match)
            items: list[str] = []
            pattern = r"^\d+\.\s+(.+)$" if ordered else r"^-\s+(.+)$"
            while index < len(lines):
                match = re.match(pattern, lines[index].strip())
                if not match:
                    break
                items.append(match.group(1))
                index += 1
            story.append(list_flowable(items, ordered, styles))
            continue

        if raw.startswith("#### "):
            heading = ascii_safe(raw[5:].strip())
            match = re.match(r"([A-Z]+-\d+)\s+-\s+(.+)", heading)
            if match:
                story.append(Spacer(1, 2 * mm))
                story.append(RequirementBadge(match.group(1)))
                story.append(Spacer(1, 1.5 * mm))
                story.append(Paragraph(inline_markup(match.group(2)), styles["h3"]))
            else:
                story.append(Paragraph(inline_markup(heading), styles["h3"]))
            index += 1
            continue
        if raw.startswith("### "):
            story.append(Paragraph(inline_markup(raw[4:]), styles["h2"]))
            index += 1
            continue
        if raw.startswith("## "):
            story.append(CondPageBreak(45 * mm))
            story.append(Paragraph(inline_markup(raw[3:]), styles["h1"]))
            index += 1
            continue
        if raw.startswith("> "):
            quote_lines = []
            while index < len(lines) and lines[index].startswith("> "):
                quote_lines.append(lines[index][2:].strip())
                index += 1
            story.append(Paragraph(inline_markup(" ".join(quote_lines)), styles["quote"]))
            continue

        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if not candidate or candidate.startswith(("#", "- ", "> ", "```", "|")) or re.match(r"^\d+\.\s+", candidate):
                break
            paragraph_lines.append(candidate)
            index += 1
        story.append(Paragraph(inline_markup(" ".join(paragraph_lines)), styles["body"]))

    return story


def build_pdf() -> Path:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = build_styles()
    document = PRDDocTemplate(str(OUTPUT), styles)

    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("TOC-0", fontName="Helvetica-Bold", fontSize=9.2, leading=13, textColor=INK, leftIndent=0, firstLineIndent=0, spaceBefore=2 * mm),
        ParagraphStyle("TOC-1", fontName="Helvetica", fontSize=8.2, leading=11, textColor=MUTED, leftIndent=7 * mm, firstLineIndent=0),
        ParagraphStyle("TOC-2", fontName="Helvetica", fontSize=7.5, leading=10, textColor=MUTED, leftIndent=14 * mm, firstLineIndent=0),
    ]

    story: list[Flowable] = [
        NextPageTemplate("Content"),
        PageBreak(),
        Paragraph("Contents", styles["toc_title"]),
        Paragraph("A navigable map of the product reset, reliable V1 requirements, rollout, and founder decisions.", styles["body"]),
        Spacer(1, 3 * mm),
        toc,
        PageBreak(),
    ]
    markdown = SOURCE.read_text(encoding="utf-8")
    markdown = re.sub(r"\n### Contents\n.*?\n---\n", "\n---\n", markdown, count=1, flags=re.DOTALL)
    story.extend(story_from_markdown(markdown, styles, document.width))
    document.multiBuild(story)
    return OUTPUT


if __name__ == "__main__":
    result = build_pdf()
    print(result)
