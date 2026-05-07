import type { QuarterReportModel } from "./quarter-report";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type JsPdfAuto = jsPDF & { lastAutoTable?: { finalY: number } };

export function quarterReportToPdfBuffer(model: QuarterReportModel): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "letter" }) as JsPdfAuto;
  const margin = 48;
  const pageH = () => doc.internal.pageSize.getHeight();
  const pageW = () => doc.internal.pageSize.getWidth();
  let y = margin;
  const maxW = pageW() - 2 * margin;
  const lineGap = 13;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addTitle = (text: string, size: number, bold = false) => {
    ensureSpace(size * 1.5);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.text(text, margin, y);
    y += size * 1.35;
  };

  const addPara = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    for (const line of lines ?? []) {
      ensureSpace(lineGap);
      doc.text(line, margin, y);
      y += lineGap;
    }
    y += 6;
  };

  addTitle(model.titleLine1, 18, true);
  addTitle(model.titleLine2, 14, true);
  y += 4;

  addTitle(model.introHeading, 12, true);
  for (const p of model.introParagraphs) addPara(p);

  addTitle(model.overviewHeading, 12, true);
  for (const p of model.overviewParagraphs) addPara(p);
  for (const b of model.overviewBullets) addPara(`• ${b}`);
  addPara(model.overviewFooter);

  for (const sec of model.accountSections) {
    ensureSpace(80);
    addTitle(sec.heading, 12, true);
    addPara(sec.narrative);
    addPara(sec.table.caption);
    ensureSpace(40);
    autoTable(doc, {
      startY: y,
      head: [Array.from(sec.table.headers)],
      body: sec.table.body.map((r) => Array.from(r)),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
      margin: { left: margin, right: margin },
      tableWidth: "wrap",
    });
    y = doc.lastAutoTable?.finalY ?? y;
    y += 10;
    addPara(sec.table.footerNote);
  }

  if (model.noDataMessage) {
    addPara(model.noDataMessage);
  }

  addTitle(model.futureHeading, 12, true);
  for (const b of model.futureBullets) addPara(b);

  addTitle(model.conclusionHeading, 12, true);
  for (const p of model.conclusionParagraphs) addPara(p);

  const out = doc.output("arraybuffer");
  return Buffer.from(out);
}
