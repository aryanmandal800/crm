import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";
import { api } from "@/lib/api";
import { getInstitutionOr404 } from "@/lib/access";
import { allSettings } from "@/lib/settings";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";

const rs = (n: number) => "Rs. " + Math.round(n).toLocaleString("en-IN");
const d = (x: Date | null) => (x ? x.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");

export const GET = api<{ id: string }>(["quote.create", "pricing.approve"], async (ctx, _r, { id }) => {
  const q = await db.query.quotes.findFirst({ where: eq(t.quotes.id, id), with: { institution: true, createdBy: true } });
  if (!q) throw notFound();
  await getInstitutionOr404(ctx, q.institutionId);
  const s = await allSettings(); const S = (k: string) => String(s.get(k) ?? "");
  const draft = !["APPROVED", "SENT", "ACCEPTED"].includes(q.status) && !(q.status === "DRAFT");
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Quotation ${q.number}`, Author: S("company.name") } });
  const chunks: Buffer[] = []; doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const W = doc.page.width - 96;

  // header band
  const g = doc.linearGradient(0, 0, doc.page.width, 0); g.stop(0, "#1d4ed8").stop(0.55, "#06b6d4").stop(1, "#7c3aed");
  doc.rect(0, 0, doc.page.width, 92).fill(g);
  doc.fill("#ffffff").font("Helvetica-Bold").fontSize(22).text(S("company.product"), 48, 26);
  doc.font("Helvetica").fontSize(10).text(S("company.tagline"), 48, 54);
  doc.fontSize(9).text(S("company.name"), 300, 26, { width: W - 252, align: "right" }).text(S("company.address"), { width: W - 252, align: "right" })
    .text(`${S("company.phone")} | ${S("company.email")}`, { width: W - 252, align: "right" });

  doc.fill("#0b1220").font("Helvetica-Bold").fontSize(16).text("COMMERCIAL QUOTATION", 48, 112);
  if (draft) doc.fill("#b91c1c").fontSize(10).text(`STATUS: ${q.status.replace(/_/g, " ")} — NOT VALID FOR SUBMISSION`, 48, 132);
  doc.fill("#334155").font("Helvetica").fontSize(9.5);
  const y0 = 150;
  doc.text(`Quote No: ${q.number}`, 48, y0).text(`Date: ${d(q.createdAt)}`).text(`Valid until: ${d(q.validUntil)}`).text(`Prepared by: ${q.createdBy.name}`);
  doc.font("Helvetica-Bold").text("To:", 320, y0).font("Helvetica").text(q.institution.legalName, 320, doc.y, { width: W - 272 })
    .text(q.institution.address ?? "", { width: W - 272 });

  let y = Math.max(doc.y, 215) + 12;
  doc.font("Helvetica-Bold").fontSize(11).fill("#1d4ed8").text("Scope", 48, y); y = doc.y + 4;
  doc.font("Helvetica").fontSize(9.5).fill("#0b1220").text(q.scope || `Fivopay cloud core banking platform for ${q.members.toLocaleString("en-IN")} members across ${q.branches} branch(es), including: ${q.modules.join(", ") || "core modules"}.`, 48, y, { width: W });

  const table = (title: string, rows: [string, string][], total?: [string, string]) => {
    y = doc.y + 14; doc.font("Helvetica-Bold").fontSize(11).fill("#1d4ed8").text(title, 48, y); y = doc.y + 4;
    doc.rect(48, y, W, 18).fill("#eef6ff"); doc.fill("#334155").font("Helvetica-Bold").fontSize(9).text("Item", 54, y + 5).text("Amount", 48, y + 5, { width: W - 6, align: "right" }); y += 20;
    doc.font("Helvetica").fill("#0b1220");
    for (const [a, b] of rows) { doc.text(a, 54, y, { width: W - 140 }); const h = doc.heightOfString(a, { width: W - 140 }); doc.text(b, 48, y, { width: W - 6, align: "right" }); y += Math.max(h, 12) + 4; doc.moveTo(48, y - 2).lineTo(48 + W, y - 2).strokeColor("#e2e8f0").stroke(); }
    if (total) { doc.font("Helvetica-Bold").text(total[0], 54, y + 2).text(total[1], 48, y + 2, { width: W - 6, align: "right" }); y += 16; }
    doc.y = y;
  };
  const monthly = q.lines.filter((l) => l.kind === "MONTHLY"); const once = q.lines.filter((l) => l.kind === "ONE_TIME");
  const disc = (q.monthlyFee * q.discountPct) / 100; const mNet = q.monthlyFee - disc; const oNet = q.implementationFee + q.migrationFee;
  table("Monthly subscription", [...monthly.map((l) => [l.name, rs(l.amount)] as [string, string]), ...(disc ? [[`Discount (${q.discountPct}%)`, "- " + rs(disc)] as [string, string]] : []),
    [`GST @ ${q.gstRate}%`, rs((mNet * q.gstRate) / 100)]], ["Monthly total (incl. GST)", rs(mNet * (1 + q.gstRate / 100))]);
  table("One-time charges", [...once.map((l) => [l.name, rs(l.amount)] as [string, string]), [`GST @ ${q.gstRate}%`, rs((oNet * q.gstRate) / 100)]], ["One-time total (incl. GST)", rs(oNet * (1 + q.gstRate / 100))]);
  table("Payment milestones (one-time charges)", q.milestones.map((m) => [`${m.name} — ${m.trigger}`, `${m.pct}% (${rs((oNet * (1 + q.gstRate / 100) * m.pct) / 100)})`]));

  if (doc.y > 640) doc.addPage();
  y = doc.y + 14; doc.font("Helvetica-Bold").fontSize(11).fill("#1d4ed8").text("Commercial terms", 48, y);
  doc.font("Helvetica").fontSize(9).fill("#0b1220").text(q.terms ?? "", 48, doc.y + 4, { width: W });
  doc.moveDown(0.6).fill("#334155").fontSize(8.5).text(S("pricing.thirdPartyNote"), { width: W });
  doc.moveDown(2).fill("#0b1220").fontSize(9.5).text(`For ${S("company.name")}`, 48).moveDown(2.5).text("Authorised Signatory");
  const fy = doc.page.height - 40;
  doc.fontSize(7.5).fill("#64748b").text(`CIN ${S("company.cin")} · GSTIN ${S("company.gstin")} · ${S("company.website")}`, 48, fy, { width: W, align: "center" });
  doc.end();
  const buf = await done;
  await audit(ctx, "quote_pdf", "quote", id, null, { number: q.number });
  return new Response(new Uint8Array(buf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${q.number.replace(/\//g, "-")}.pdf"`, "cache-control": "no-store" } });
});
