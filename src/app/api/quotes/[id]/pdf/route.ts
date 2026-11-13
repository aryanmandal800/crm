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

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 0, bottom: 25, left: 42, right: 42 },
    info: { Title: `Quotation ${q.number}`, Author: S("company.name") },
  });

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
  const W = doc.page.width - 84;

  // Background subtle watermark with official FIVOPAY logo (tilted)
  const watermarkPath = path.join(process.cwd(), "public", "fivopay_logo.png");
  const drawWatermark = () => {
    doc.save();
    doc.opacity(0.06);
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

  // Header band with official Manalix logo
  const headerH = 92;
  const g = doc.linearGradient(0, 0, doc.page.width, 0);
  g.stop(0, "#1d4ed8").stop(0.55, "#06b6d4").stop(1, "#7c3aed");
  doc.rect(0, 0, doc.page.width, headerH).fill(g);

  const logoPath = path.join(process.cwd(), "public", "manalix_logo.png");
  if (fs.existsSync(logoPath)) {
    // White rounded badge for high-contrast official logo display
    doc.roundedRect(42, 14, 105, 64, 6).fill("#ffffff");
    doc.image(logoPath, 45, 18, { fit: [99, 56], align: "center", valign: "center" });

    doc.fill("#ffffff").font(fBold).fontSize(17).text(S("company.product") || "Fivopay CBS", 158, 25, { width: 180 });
    doc.font(fRegular).fontSize(9).text(S("company.tagline") || "Core Banking & Financial Technology", 158, 48, { width: 180 });
  } else {
    doc.fill("#ffffff").font(fBold).fontSize(20).text(S("company.product") || "Fivopay CBS", 42, 22, { width: 220 });
    doc.font(fRegular).fontSize(9).text(S("company.tagline") || "Core Banking & Financial Technology", 42, 48, { width: 220 });
  }

  // Header top-right with CIN, GSTIN, registered address
  const compW = 215;
  const compX = doc.page.width - 42 - compW;
  doc.fontSize(8.5).font(fBold).fill("#ffffff").text(S("company.name"), compX, 14, { width: compW, align: "right" });
  doc.font(fRegular).fontSize(7).fill("#f8fafc")
    .text(`CIN: ${S("company.cin")} · GSTIN: ${S("company.gstin")}`, compX, doc.y + 1, { width: compW, align: "right" })
    .text(S("company.address"), compX, doc.y + 1, { width: compW, align: "right" })
    .text(`Ph: ${S("company.phone")} | Email: ${S("company.email")}`, compX, doc.y + 1, { width: compW, align: "right" });

  let curY = 108;
  doc.fill("#0b1220").font(fBold).fontSize(15).text("COMMERCIAL QUOTATION", 42, curY);
  curY = doc.y + 5;
  if (draft) {
    doc.fill("#b91c1c").fontSize(8.5).text(`STATUS: ${q.status.replace(/_/g, " ")} — NOT VALID FOR SUBMISSION`, 42, curY);
    curY = doc.y + 3;
  }

  const metaY = curY;
  doc.fill("#334155").font(fRegular).fontSize(9);
  doc.text(`Quote No: ${q.number}`, 42, metaY)
    .text(`Date: ${d(q.createdAt)}`)
    .text(`Valid until: ${d(q.validUntil)}`)
    .text(`Prepared by: ${q.createdBy.name}`);
  const leftMetaBottom = doc.y;

  doc.font(fBold).text("To:", 310, metaY)
    .font(fBold).text(q.institution.legalName, 310, doc.y, { width: W - 268 })
    .font(fRegular).text(q.institution.address ?? "", 310, doc.y, { width: W - 268 });
  curY = Math.max(leftMetaBottom, doc.y) + 14;

  doc.font(fBold).fontSize(10.5).fill("#1d4ed8").text("Scope", 42, curY);
  curY = doc.y + 4;
  doc.font(fRegular).fontSize(9).fill("#0b1220").text(
    cleanText(q.scope || `Fivopay cloud core banking platform for ${q.members.toLocaleString("en-IN")} members across ${q.branches} branch(es), including: ${q.modules.join(", ") || "core modules"}.`),
    42,
    curY,
    { width: W }
  );
  curY = doc.y + 12;

  const table = (title: string, rows: [string, string][], total?: [string, string]) => {
    doc.font(fBold).fontSize(10.5).fill("#1d4ed8").text(title, 42, curY);
    curY = doc.y + 3;
    doc.rect(42, curY, W, 18).fill("#eef6ff");
    doc.fill("#334155").font(fBold).fontSize(8.5).text("Item", 48, curY + 4.5).text("Amount", 42, curY + 4.5, { width: W - 6, align: "right" });
    curY += 21;
    doc.font(fRegular).fill("#0b1220").fontSize(9);
    for (const [a, b] of rows) {
      const cleanA = cleanText(a);
      const cleanB = cleanText(b);
      doc.text(cleanA, 48, curY, { width: W - 140 });
      const h = doc.heightOfString(cleanA, { width: W - 140 });
      doc.text(cleanB, 42, curY, { width: W - 6, align: "right" });
      curY += Math.max(h, 12) + 5;
      doc.moveTo(42, curY - 2.5).lineTo(42 + W, curY - 2.5).strokeColor("#e2e8f0").stroke();
    }
    if (total) {
      doc.font(fBold).fontSize(9).text(cleanText(total[0]), 48, curY + 3.5).text(cleanText(total[1]), 42, curY + 3.5, { width: W - 6, align: "right" });
      curY += 17;
    }
    curY += 10;
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

  doc.font(fBold).fontSize(8.5).fill("#1e293b").text("Payment terms: 100% full payment for One-Time Setup & Migration upon agreement signing.", 42, curY);
  curY = doc.y + 12;

  // Bank details for remittance (Clean 3-row structured card)
  doc.font(fBold).fontSize(10).fill("#1d4ed8").text("Bank Details for Remittance (NEFT / RTGS / IMPS)", 42, curY);
  curY = doc.y + 4;
  doc.roundedRect(42, curY, W, 56, 6).fillAndStroke("#f8fafc", "#cbd5e1");

  doc.fill("#334155").font(fBold).fontSize(8);
  // Row 1: Beneficiary Name
  doc.text("Beneficiary:", 52, curY + 8).font(fBold).fill("#0f172a")
    .text(S("company.bankBeneficiary") || "SAIKHLEARN & SCHOLAR NEXUS PRIVATE LIMITED", 112, curY + 8, { width: W - 75 });

  // Row 2: Bank | A/C No | IFSC | Type (Proportionately spaced to stay well within box boundaries)
  doc.font(fBold).fill("#334155").text("Bank:", 52, curY + 23).font(fRegular).fill("#0f172a")
    .text(S("company.bankName") || "RBL Bank Limited", 80, curY + 23, { width: 92 });
  doc.font(fBold).fill("#334155").text("A/C No:", 178, curY + 23).font(fBold).fill("#0f172a")
    .text(S("company.bankAccount") || "409002566529", 215, curY + 23, { width: 90 });
  doc.font(fBold).fill("#334155").text("IFSC:", 310, curY + 23).font(fBold).fill("#0f172a")
    .text(S("company.bankIfsc") || "RATN0000157", 338, curY + 23, { width: 75 });
  doc.font(fBold).fill("#334155").text("Type:", 422, curY + 23).font(fRegular).fill("#0f172a")
    .text(S("company.bankAccountType") || "Current Account", 450, curY + 23, { width: 95 });

  // Row 3: Branch
  doc.font(fBold).fill("#334155").text("Branch:", 52, curY + 38).font(fRegular).fill("#0f172a")
    .text(S("company.bankBranch") || "Pune Camp Branch, Ground Floor 11, Moledina Road, Camp, Pune - 411001", 92, curY + 38, { width: W - 55 });

  curY += 68;

  // Commercial terms (Full Width)
  doc.font(fBold).fontSize(10).fill("#1d4ed8").text("Commercial terms", 42, curY);
  curY = doc.y + 4;
  const displayTerms = (q.terms ?? "").replace(/Implementation fee payable per milestones\.?/gi, "One-Time Setup & Migration fee is payable 100% in advance upon agreement signing.");
  doc.font(fRegular).fontSize(8.5).fill("#0b1220").text(cleanText(displayTerms), 42, curY, { width: W, lineGap: 2 });
  curY = doc.y + 5;
  if (S("pricing.thirdPartyNote")) {
    doc.font(fRegular).fontSize(8).fill("#475569").text(cleanText(S("pricing.thirdPartyNote")), 42, curY, { width: W });
    curY = doc.y + 18;
  } else {
    curY += 14;
  }

  // Signature block positioned cleanly below Commercial Terms on the right side
  const sigW = 240;
  const sigX = doc.page.width - 42 - sigW;
  const maxSigY = doc.page.height - 75;
  const sigY = Math.min(curY, maxSigY - 45);

  doc.font(fBold).fontSize(9.5).fill("#0b1220").text(`For ${S("company.name")}`, sigX, sigY, { width: sigW, align: "right" });
  doc.font(fBold).fontSize(9.5).fill("#0b1220").text("Authorised Signatory", sigX, sigY + 45, { width: sigW, align: "right" });

  doc.end();
  const buf = await done;
  await audit(ctx, "quote_pdf", "quote", id, null, { number: q.number });
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${q.number.replace(/\//g, "-")}.pdf"`, "cache-control": "no-store" } });
});
