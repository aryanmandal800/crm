import type { FieldDef } from "@/components/client/JsonForm";
export const competitorFields: FieldDef[] = [
  { name: "name", label: "Vendor", required: true }, { name: "product", label: "Product" }, { name: "website", label: "Website" },
  { name: "targetSegment", label: "Target segment" }, { name: "verification", label: "Verification", type: "select", options: ["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"].map((v) => ({ value: v, label: v })) },
  { name: "features", label: "Features (from public material)", type: "textarea" }, { name: "publicPricing", label: "Public pricing (only if published)", type: "textarea" },
  { name: "verifiedCustomers", label: "Verified customers (with evidence)", type: "textarea" },
  { name: "strengths", label: "Strengths — evidence-backed only", type: "textarea" }, { name: "weaknesses", label: "Weaknesses — evidence-backed only", type: "textarea", help: "Never record unsupported claims. Add a source for each." },
  { name: "differentiation", label: "Fivopay differentiation", type: "textarea" }, { name: "positioning", label: "Competitive positioning / talk track", type: "textarea" },
];
