
const fs = require('fs');
const path = require('path');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    BorderStyle,
    WidthType,
    ShadingType,
    VerticalAlign,
    PageNumber,
    Footer,
    PageBreak,
    SectionType
} = require('docx');

const reportPath = '/Users/hannanmohsin/Documents/FYP/Docs/PT2 Final Report/ParkFlow_PT2_Report.md';
const outputPath = '/Users/hannanmohsin/Documents/FYP/Docs/PT2 Final Report/ParkFlow_PT2_Report.docx';

// Read the markdown file
const content = fs.readFileSync(reportPath, 'utf8');

// Configuration Constants (DXA: 1440 = 1 inch)
const MARGIN_LEFT = 1.5 * 1440; // 1.5 inches for binding
const MARGIN_OTHER = 1.0 * 1440; // 1 inch top, bottom, right
const FONT_FAMILY = "Times New Roman";
const LINE_SPACING = 360; // 1.5 line spacing (240 * 1.5)

// Helper to create body text runs
const createTextRun = (text, options = {}) => {
    return new TextRun({
        text: text,
        font: FONT_FAMILY,
        size: 24, // 12pt
        ...options
    });
};

const sections = [];
let currentChildren = [];

// Split content by chapters or major manual page breaks
const lines = content.split('\n');

const finishSection = (pageNumberFormat = "decimal") => {
    if (currentChildren.length > 0) {
        sections.push({
            properties: {
                page: {
                    margin: { top: MARGIN_OTHER, right: MARGIN_OTHER, bottom: MARGIN_OTHER, left: MARGIN_LEFT },
                    pageNumbers: { formatType: pageNumberFormat }
                }
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ children: [PageNumber.CURRENT], font: FONT_FAMILY, size: 24 })
                            ]
                        })
                    ]
                })
            },
            children: [...currentChildren]
        });
        currentChildren = [];
    }
};

let inTable = false;
let tableRows = [];

lines.forEach((line) => {
    const trimmedLine = line.trim();

    // Handle manual section/page breaks in my custom markdown format
    if (trimmedLine === '---') {
        finishSection(sections.length === 0 ? "lowerRoman" : "decimal");
        return;
    }

    // Handle Headings
    if (trimmedLine.startsWith('# ')) {
        const title = trimmedLine.replace('# ', '');
        currentChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400, line: LINE_SPACING },
            children: [new TextRun({ text: title, bold: true, size: 32, font: FONT_FAMILY })] // 16pt
        }));
    } else if (trimmedLine.startsWith('## ')) {
        const title = trimmedLine.replace('## ', '');
        currentChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200, line: LINE_SPACING },
            children: [new TextRun({ text: title, bold: true, size: 28, font: FONT_FAMILY })] // 14pt
        }));
    } else if (trimmedLine.startsWith('### ')) {
        const title = trimmedLine.replace('### ', '');
        currentChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 240, after: 120, line: LINE_SPACING },
            children: [new TextRun({ text: title, bold: true, size: 24, font: FONT_FAMILY })] // 12pt
        }));
    }
    // Handle Tables (Simplified parser for the MD tables I wrote)
    else if (trimmedLine.startsWith('|')) {
        if (!inTable) {
            inTable = true;
            tableRows = [];
        }

        // Skip separator rows like |:---|:---|
        if (trimmedLine.includes('---')) return;

        const cells = trimmedLine.split('|').filter(c => c.trim() !== '' || line.includes('||')).map(c => c.trim());
        if (cells.length === 0) return;

        const tableRow = new TableRow({
            children: cells.map(cell => new TableCell({
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                },
                children: [new Paragraph({
                    children: [new TextRun({ text: cell, font: FONT_FAMILY, size: 22 })],
                    spacing: { line: 240 }
                })]
            }))
        });
        tableRows.push(tableRow);
    } else {
        if (inTable) {
            inTable = false;
            if (tableRows.length > 0) {
                currentChildren.push(new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE }
                }));
            }
            tableRows = [];
        }

        if (trimmedLine === '') {
            // Empty paragraph for spacing
            currentChildren.push(new Paragraph({ spacing: { line: LINE_SPACING } }));
        } else {
            // Regular Paragraph
            // Handle basic markdown bolding **text**
            const parts = line.split(/(\*\*.*?\*\*)/g);
            const runs = parts.map(part => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return createTextRun(part.slice(2, -2), { bold: true });
                }
                return createTextRun(part);
            });

            currentChildren.push(new Paragraph({
                alignment: AlignmentType.JUSTIFIED,
                spacing: { line: LINE_SPACING, after: 120 },
                children: runs
            }));
        }
    }
});

// Final section flush
finishSection("decimal");

const doc = new Document({
    styles: {
        default: {
            document: {
                run: { font: FONT_FAMILY, size: 24 }, // 12pt
                paragraph: { spacing: { line: LINE_SPACING } }
            }
        }
    },
    sections: sections
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(outputPath, buffer);
    console.log('Successfully generated DOCX at ' + outputPath);
}).catch(err => {
    console.error('Error generating DOCX:', err);
    process.exit(1);
});
