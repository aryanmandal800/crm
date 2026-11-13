import PDFDocument from "pdfkit";
import path from "node:path";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { getInstitutionOr404 } from "@/lib/access";
import { allSettings } from "@/lib/settings";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";

// Explicit static font references to guarantee Vercel NFT bundles standard fonts
import "pdfkit/standard-fonts/Helvetica";
import "pdfkit/standard-fonts/HelveticaBold";
import "pdfkit/standard-fonts/HelveticaOblique";
import "pdfkit/standard-fonts/HelveticaBoldOblique";

const d = (x: Date | null) => (x ? x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

export const GET = api<{ id: string }>(["quote.create", "pricing.approve"], async (ctx, _r, { id }) => {
  const q = await db.query.quotes.findFirst({ where: eq(t.quotes.id, id), with: { institution: true, createdBy: true } });
  if (!q) throw notFound();
  await getInstitutionOr404(ctx, q.institutionId);
  const s = await allSettings(); const S = (k: string) => String(s.get(k) ?? "");
  const draft = !["APPROVED", "SENT", "ACCEPTED"].includes(q.status) && !(q.status === "DRAFT");
  
  // Custom font supporting Unicode / Indian Rupee sign (₹ - U+20B9)
  const fontRegular = path.join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");
  const fontBold = path.join(process.cwd(), "public", "fonts", "NotoSans-Bold.ttf");
  const hasCustomFont = fs.existsSync(fontRegular) && fs.existsSync(fontBold);

  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Quotation ${q.number}`, Author: S("company.name") } });

  if (hasCustomFont) {
    doc.registerFont("NotoSans", fontRegular);
    doc.registerFont("NotoSans-Bold", fontBold);
  }

  const fRegular = hasCustomFont ? "NotoSans" : "Helvetica";
  const fBold = hasCustomFont ? "NotoSans-Bold" : "Helvetica-Bold";

  // Clean and ensure ₹ is rendered cleanly without WinAnsi superscript 1 corruption
  const cleanText = (txt: string) => {
    if (!txt) return "";
    let clean = txt.replace(/¹(?=\d)/g, "₹");
    if (!hasCustomFont) {
      clean = clean.replace(/₹\s?/g, "Rs. ");
    }
    return clean;
  };

  const rs = (n: number) => (hasCustomFont ? "₹ " : "Rs. ") + Math.round(n).toLocaleString("en-IN");

  const chunks: Buffer[] = []; doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const W = doc.page.width - 96;

  // Background subtle watermark with official FIVOPAY logo (tilted)
  const watermarkPath = path.join(process.cwd(), "public", "fivopay_logo.png");
  const drawWatermark = () => {
    doc.save();
    doc.opacity(0.08);
    const cx = doc.page.width / 2;
    const cy = doc.page.height / 2;
    // Tilted diagonal watermark (-30 degrees across page)
    doc.rotate(-30, { origin: [cx, cy] });
    if (fs.existsSync(watermarkPath)) {
      const imgWidth = 380;
      doc.image(watermarkPath, cx - imgWidth / 2, cy - 75, { width: imgWidth });
    } else {
      doc.fillColor("#0f172a");
      doc.font(fBold).fontSize(90);
      doc.text("FIVOPAY", 0, cy - 45, { width: doc.page.width, align: "center" });
    }
    doc.restore();
  };
  drawWatermark();
  doc.on("pageAdded", () => {
    drawWatermark();
  });

  // header band with official Manalix logo
  const g = doc.linearGradient(0, 0, doc.page.width, 0); g.stop(0, "#1d4ed8").stop(0.55, "#06b6d4").stop(1, "#7c3aed");
  doc.rect(0, 0, doc.page.width, 102).fill(g);

  const logoPath = path.join(process.cwd(), "public", "manalix_logo.png");
  if (fs.existsSync(logoPath)) {
    // White rounded badge for high-contrast official logo display
    doc.roundedRect(48, 16, 114, 70, 8).fill("#ffffff");
    doc.image(logoPath, 52, 20, { fit: [106, 62], align: "center", valign: "center" });

    doc.fill("#ffffff").font(fBold).fontSize(18).text(S("company.product") || "Fivopay CBS", 174, 28);
    doc.font(fRegular).fontSize(9.5).text(S("company.tagline") || "Core Banking & Financial Technology", 174, 54);
  } else {
    doc.fill("#ffffff").font(fBold).fontSize(22).text(S("company.product") || "Fivopay CBS", 48, 28);
    doc.font(fRegular).fontSize(10).text(S("company.tagline") || "Core Banking & Financial Technology", 48, 56);
  }

  // Header top-right with CIN, GSTIN, 10 Biz Park address
  doc.fontSize(8.5).font(fBold).fill("#ffffff").text(S("company.name"), 250, 18, { width: W - 202, align: "right" });
  doc.font(fRegular).fontSize(7.5).fill("#f8fafc")
    .text(`CIN: ${S("company.cin")} · GSTIN: ${S("company.gstin")}`, { width: W - 202, align: "right" })
    .text(S("company.address"), { width: W - 202, align: "right" })
    .text(`Ph: ${S("company.phone")} | Email: ${S("company.email")}`, { width: W - 202, align: "right" });

  doc.fill("#0b1220").font(fBold).fontSize(16).text("COMMERCIAL QUOTATION", 48, 118);
  if (draft) doc.fill("#b91c1c").fontSize(10).text(`STATUS: ${q.status.replace(/_/g, " ")} — NOT VALID FOR SUBMISSION`, 48, 138);
  doc.fill("#334155").font(fRegular).fontSize(9.5);
  const y0 = 154;
  doc.text(`Quote No: ${q.number}`, 48, y0).text(`Date: ${d(q.createdAt)}`).text(`Valid until: ${d(q.validUntil)}`).text(`Prepared by: ${q.createdBy.name}`);
  doc.font(fBold).text("To:", 320, y0).font(fRegular).text(q.institution.legalName, 320, doc.y, { width: W - 272 })
    .text(q.institution.address ?? "", { width: W - 272 });

  let y = Math.max(doc.y, 220) + 12;
  doc.font(fBold).fontSize(11).fill("#1d4ed8").text("Scope", 48, y); y = doc.y + 4;
  doc.font(fRegular).fontSize(9.5).fill("#0b1220").text(cleanText(q.scope || `Fivopay cloud core banking platform for ${q.members.toLocaleString("en-IN")} members across ${q.branches} branch(es), including: ${q.modules.join(", ") || "core modules"}.`), 48, y, { width: W });

  const table = (title: string, rows: [string, string][], total?: [string, string]) => {
    y = doc.y + 14; doc.font(fBold).fontSize(11).fill("#1d4ed8").text(title, 48, y); y = doc.y + 4;
    doc.rect(48, y, W, 18).fill("#eef6ff"); doc.fill("#334155").font(fBold).fontSize(9).text("Item", 54, y + 5).text("Amount", 48, y + 5, { width: W - 6, align: "right" }); y += 20;
    doc.font(fRegular).fill("#0b1220");
    for (const [a, b] of rows) {
      const cleanA = cleanText(a);
      const cleanB = cleanText(b);
      doc.text(cleanA, 54, y, { width: W - 140 });
      const h = doc.heightOfString(cleanA, { width: W - 140 });
      doc.text(cleanB, 48, y, { width: W - 6, align: "right" });
      y += Math.max(h, 12) + 4;
      doc.moveTo(48, y - 2).lineTo(48 + W, y - 2).strokeColor("#e2e8f0").stroke();
    }
    if (total) {
      doc.font(fBold).text(cleanText(total[0]), 54, y + 2).text(cleanText(total[1]), 48, y + 2, { width: W - 6, align: "right" });
      y += 16;
    }
    doc.y = y;
  };
  const monthly = q.lines.filter((l) => l.kind === "MONTHLY");
  const once = q.lines.filter((l) => l.kind === "ONE_TIME");
  const setupDiscPct = Number((q as any).setupDiscountPct || 0);

  const monthlyDisc = (q.monthlyFee * q.discountPct) / 100;
  const mNet = q.monthlyFee - monthlyDisc;

  const oList = once.length > 0 ? once.reduce((acc, l) => acc + l.amount, 0) : (q.implementationFee + q.migrationFee);
  const setupDisc = (oList * setupDiscPct) / 100;
  const oNet = oList - setupDisc;

  table("Monthly subscription", [
    ...monthly.map((l) => [l.name, rs(l.amount)] as [string, string]),
    ...(monthlyDisc ? [[`Monthly SaaS Discount (${q.discountPct}%)`, "- " + rs(monthlyDisc)] as [string, string]] : []),
    [`GST @ ${q.gstRate}%`, rs((mNet * q.gstRate) / 100)],
  ], ["Monthly total (incl. GST)", rs(mNet * (1 + q.gstRate / 100))]);

  table("One-Time Setup & Migration", [
    ...once.map((l) => [l.name, rs(l.amount)] as [string, string]),
    ...(setupDisc ? [[`Setup & Migration Discount (${setupDiscPct}%)`, "- " + rs(setupDisc)] as [string, string]] : []),
    [`GST @ ${q.gstRate}%`, rs((oNet * q.gstRate) / 100)],
  ], ["One-time total (incl. GST)", rs(oNet * (1 + q.gstRate / 100))]);

  doc.font(fBold).fontSize(9).fill("#1e293b").text("Payment terms: 100% full payment for One-Time Setup & Migration upon agreement signing.", 52, doc.y + 6);
  doc.y += 6;

  // Bank details for remittance (Clean 4-row grid with no text collisions)
  if (doc.y > 540) doc.addPage();
  y = doc.y + 12;
  doc.font(fBold).fontSize(10).fill("#1d4ed8").text("Bank Details for Remittance (NEFT / RTGS / IMPS)", 48, y);
  y = doc.y + 4;
  doc.roundedRect(48, y, W, 68, 6).fillAndStroke("#f8fafc", "#cbd5e1");

  doc.fill("#334155").font(fBold).fontSize(8.5);
  // Row 1: Full width Beneficiary Name
  doc.text("Beneficiary Name:", 58, y + 8).font(fBold).fill("#0f172a")
    .text(S("company.bankBeneficiary") || "SAIKHLEARN & SCHOLAR NEXUS PRIVATE LIMITED", 150, y + 8, { width: W - 110 });

  // Row 2: Bank Name | Account Type
  doc.font(fBold).fill("#334155").text("Bank Name:", 58, y + 22).font(fRegular).fill("#0f172a")
    .text(S("company.bankName") || "RBL Bank Limited", 150, y + 22, { width: 160 });
  doc.font(fBold).fill("#334155").text("Account Type:", 320, y + 22).font(fRegular).fill("#0f172a")
    .text(S("company.bankAccountType") || "Current Account", 395, y + 22, { width: W - 355 });

  // Row 3: Account Number | IFSC Code
  doc.font(fBold).fill("#334155").text("Account Number:", 58, y + 36).font(fBold).fill("#0f172a")
    .text(S("company.bankAccount") || "409002566529", 150, y + 36, { width: 160 });
  doc.font(fBold).fill("#334155").text("IFSC Code:", 320, y + 36).font(fBold).fill("#0f172a")
    .text(S("company.bankIfsc") || "RATN0000157", 395, y + 36, { width: W - 355 });

  // Row 4: Full width Branch
  doc.font(fBold).fill("#334155").text("Branch:", 58, y + 50).font(fRegular).fill("#0f172a")
    .text(S("company.bankBranch") || "Pune Camp Branch, Ground Floor 11, Moledina Road, Camp, Pune - 411001", 150, y + 50, { width: W - 110 });

  doc.y = y + 78;

  if (doc.y > 640) doc.addPage();
  y = doc.y + 10; doc.font(fBold).fontSize(11).fill("#1d4ed8").text("Commercial terms", 48, y);
  const displayTerms = (q.terms ?? "").replace(/Implementation fee payable per milestones\.?/gi, "One-Time Setup & Migration fee is payable 100% in advance upon agreement signing.");
  doc.font(fRegular).fontSize(9).fill("#0b1220").text(cleanText(displayTerms), 48, doc.y + 4, { width: W });
  doc.moveDown(0.6).fill("#334155").fontSize(8.5).text(cleanText(S("pricing.thirdPartyNote")), { width: W });
  doc.moveDown(2).fill("#0b1220").fontSize(9.5).text(`For ${S("company.name")}`, 48).moveDown(2.5).text("Authorised Signatory");
  const fy = doc.page.height - 40;

  doc.end();
  const buf = await done;
  await audit(ctx, "quote_pdf", "quote", id, null, { number: q.number });
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${q.number.replace(/\//g, "-")}.pdf"`, "cache-control": "no-store" } });
});
