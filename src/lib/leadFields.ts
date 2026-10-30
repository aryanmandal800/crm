import type { FieldDef } from "@/components/client/JsonForm";
import { enumOpt } from "./options";

type O = { value: string; label: string }[];
const tri = enumOpt(["UNKNOWN", "YES", "NO"]);

export function leadSections(o: { types: O; districts: O; talukas: O; owners?: O }): { key: string; title: string; fields: FieldDef[] }[] {
  return [
    { key: "identity", title: "Identity & registration", fields: [
      { name: "legalName", label: "Registered legal name", required: true, wide: true },
      { name: "shortName", label: "Popular / short name" },
      { name: "typeId", label: "Institution type", type: "select", options: o.types, required: true },
      { name: "regNumber", label: "Registration number" }, { name: "regDate", label: "Registration date", type: "date" },
      { name: "regAuthority", label: "Registration authority", placeholder: "e.g. Dy. Registrar, Pune City" },
      { name: "multiState", label: "Multi-state society", type: "checkbox" },
      { name: "status", label: "Status", type: "select", options: enumOpt(["UNKNOWN", "ACTIVE", "INACTIVE", "UNDER_LIQUIDATION"]) },
      { name: "districtId", label: "District", type: "select", options: o.districts, required: true },
      { name: "talukaId", label: "Taluka", type: "select", options: o.talukas },
      { name: "city", label: "City / town / village" }, { name: "pinCode", label: "PIN code" },
      { name: "address", label: "Head office address", type: "textarea" },
      { name: "branchCount", label: "Number of branches", type: "number" }, { name: "branchLocations", label: "Branch locations", type: "textarea" },
      { name: "website", label: "Official website" }, { name: "mapsUrl", label: "Google Maps / listing URL" },
      { name: "socialProfiles", label: "Official social profiles", type: "textarea" },
      ...(o.owners ? [{ name: "ownerId", label: "Owner (salesperson)", type: "select" as const, options: o.owners }] : []),
    ] },
    { key: "contact", title: "Official contact points", fields: [
      { name: "landline", label: "Official landline" }, { name: "mobile", label: "Official mobile" }, { name: "email", label: "General email", type: "email" },
      { name: "contactPageUrl", label: "Official contact page" },
      { name: "contactVerification", label: "Contact verification", type: "select", options: enumOpt(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]), help: "Never guess numbers or email formats." },
    ] },
    { key: "financial", title: "Size & financial profile (₹)", fields: [
      { name: "totalMembers", label: "Total members", type: "number" }, { name: "activeMembers", label: "Active members", type: "number" },
      { name: "totalDeposits", label: "Total deposits (₹)", type: "number" }, { name: "loanBook", label: "Loan book (₹)", type: "number" },
      { name: "totalAssets", label: "Total assets (₹)", type: "number" }, { name: "annualIncome", label: "Annual income (₹)", type: "number" },
      { name: "annualProfit", label: "Annual profit / loss (₹)", type: "number" }, { name: "netWorth", label: "Net worth (₹)", type: "number" },
      { name: "employeeCount", label: "Employees", type: "number" }, { name: "txnVolume", label: "Approx. transaction volume" },
      { name: "financialYear", label: "Financial year", placeholder: "2025-26" }, { name: "financialSource", label: "Source of financials" },
      { name: "financialConfidence", label: "Confidence", type: "select", options: enumOpt(["LOW", "MEDIUM", "HIGH"]) },
    ] },
    { key: "tech", title: "Technology infrastructure", fields: [
      { name: "cbsVendor", label: "Current CBS vendor" }, { name: "cbsProduct", label: "Software product" }, { name: "vendorWebsite", label: "Vendor website" },
      { name: "vendorClass", label: "Vendor classification", type: "select", options: enumOpt(["UNKNOWN", "CONFIRMED_INCUMBENT", "PROBABLE_INCUMBENT", "NONE_IDENTIFIED"]) },
      { name: "hosting", label: "Hosting", type: "select", options: enumOpt(["UNKNOWN", "CLOUD", "ON_PREMISE", "HYBRID"]) },
      { name: "centralisedCbs", label: "Centralised multi-branch system", type: "select", options: tri },
      { name: "mobileApp", label: "Member mobile app", type: "select", options: tri }, { name: "internetBanking", label: "Internet banking", type: "select", options: tri },
      { name: "upiIntegration", label: "UPI / payment integration", type: "select", options: tri }, { name: "digitalLoans", label: "Digital loan processing", type: "select", options: tri },
      { name: "ekyc", label: "eKYC", type: "select", options: tri },
      { name: "memberDigitalServices", label: "Member digital services", type: "textarea" }, { name: "recentTechProcurement", label: "Recent technology procurement", type: "textarea" },
      { name: "contractRenewal", label: "Known contract renewal", type: "textarea" }, { name: "legacyEvidence", label: "Legacy software evidence", type: "textarea" },
      { name: "techComplaints", label: "Public technology complaints (evidenced only)", type: "textarea" },
    ] },
    { key: "research", title: "Research status", fields: [
      { name: "verification", label: "Overall verification", type: "select", options: enumOpt(["UNVERIFIED", "PARTIAL", "VERIFIED", "DISPUTED"]) },
      { name: "dataConfidence", label: "Data confidence", type: "select", options: enumOpt(["LOW", "MEDIUM", "HIGH"]) },
      { name: "lastVerifiedAt", label: "Last verified", type: "date" }, { name: "nextVerificationAt", label: "Next verification", type: "date" },
      { name: "shariahInterest", label: "Ethical / Shariah model interest", type: "checkbox" },
      { name: "tags", label: "Tags (comma separated)", type: "tags", help: "Special tags: reference, partner" },
      { name: "notes", label: "Notes", type: "textarea" },
    ] },
  ];
}
