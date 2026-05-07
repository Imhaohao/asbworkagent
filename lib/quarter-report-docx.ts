import type { QuarterReportModel, QuarterTxnTable } from "./quarter-report";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

function textCell(content: string, opts?: { bold?: boolean }): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: content,
            bold: opts?.bold ?? false,
          }),
        ],
      }),
    ],
  });
}

function txnTableDocx(t: QuarterTxnTable): Table {
  const headerRow = new TableRow({
    children: t.headers.map((h) => textCell(h, { bold: true })),
  });
  const dataRows = t.body.map(
    (row) =>
      new TableRow({
        children: row.map((c) => textCell(c)),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

export async function quarterReportToDocxBuffer(
  model: QuarterReportModel,
): Promise<Buffer> {
  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(model.titleLine1)],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(model.titleLine2)],
    }),
    new Paragraph({ children: [] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(model.introHeading)],
    }),
  ];

  for (const p of model.introParagraphs) {
    blocks.push(new Paragraph({ children: [new TextRun(p)] }));
  }

  blocks.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(model.overviewHeading)],
    }),
  );
  for (const p of model.overviewParagraphs) {
    blocks.push(new Paragraph({ children: [new TextRun(p)] }));
  }
  for (const b of model.overviewBullets) {
    blocks.push(
      new Paragraph({
        children: [new TextRun(`• ${b}`)],
      }),
    );
  }
  blocks.push(new Paragraph({ children: [new TextRun(model.overviewFooter)] }));

  for (const sec of model.accountSections) {
    blocks.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(sec.heading)],
      }),
    );
    blocks.push(new Paragraph({ children: [new TextRun(sec.narrative)] }));
    blocks.push(
      new Paragraph({
        children: [new TextRun({ text: sec.table.caption, italics: true })],
      }),
    );
    blocks.push(txnTableDocx(sec.table));
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({ text: sec.table.footerNote, size: 18, italics: true }),
        ],
      }),
    );
  }

  if (model.noDataMessage) {
    blocks.push(new Paragraph({ children: [new TextRun(model.noDataMessage)] }));
  }

  blocks.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(model.futureHeading)],
    }),
  );
  for (const b of model.futureBullets) {
    blocks.push(new Paragraph({ children: [new TextRun(b)] }));
  }

  blocks.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(model.conclusionHeading)],
    }),
  );
  for (const p of model.conclusionParagraphs) {
    blocks.push(new Paragraph({ children: [new TextRun(p)] }));
  }

  const doc = new Document({
    sections: [{ children: blocks }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
