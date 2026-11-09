"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Phone,
  Globe,
  ExternalLink,
  Building2,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  UserPlus,
  ChevronDown,
  Filter,
  Check,
  X
} from "lucide-react";
import { MAHARASHTRA_PINS, findPin, type MaharashtraPin } from "@/lib/maharashtraPins";
import {
  INDIAN_STATES,
  POPULAR_CATEGORIES,
  POPULAR_INDIAN_HUBS,
  inferStateFromPin,
  findIndiaLocation,
  type IndianHub,
} from "@/lib/indiaGeography";

type Place = {
  id: string;
  displayName?: { text: string; languageCode?: string };
  formattedAddress?: string;
  addressComponents?: any[];
  pinCode?: string;
  entityType?: "CREDIT_SOCIETY" | "HOUSING_SOCIETY" | "BANK" | "OTHER";
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  location?: { latitude: number; longitude: number };
  matchScore?: number;
  existingLead?: { id: string; leadCode: string } | null;
};

type SearchResponse = {
  targetPin: string;
  query: string;
  total: number;
  rawTotal?: number;
  creditCount?: number;
  housingCount?: number;
  bankCount?: number;
  societyCount?: number;
  exactMatches: number;
  places: Place[];
};

const REGIONS = [
  "All Regions",
  "Maharashtra",
  "Gujarat",
  "Karnataka",
  "Delhi NCR",
  "Rajasthan",
  "Madhya Pradesh",
  "Uttar Pradesh",
  "Tamil Nadu",
  "Telangana & AP",
  "West Bengal",
  "Kerala",
  "Punjab & North",
];

function matchFor(p: Place, targetPin?: string, targetState?: string) {
  if (targetPin && p.pinCode === targetPin) {
    return { label: `Exact PIN (${p.pinCode})`, kind: "exact", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }
  if (targetPin && p.pinCode && p.pinCode.slice(0, 3) === targetPin.slice(0, 3)) {
    return { label: `Nearby Area (${p.pinCode})`, kind: "nearby", bg: "bg-amber-100 text-amber-800 border-amber-200" };
  }
  const addr = (p.formattedAddress || "").toLowerCase();
  if (targetState && targetState !== "All India" && addr.includes(targetState.toLowerCase())) {
    return { label: targetState, kind: "state", bg: "bg-sky-100 text-sky-800 border-sky-200" };
  }
  if (p.pinCode) {
    const st = inferStateFromPin(p.pinCode);
    if (st) {
      return { label: `${st} (${p.pinCode})`, kind: "hub", bg: "bg-violet-100 text-violet-800 border-violet-200" };
    }
  }
  return { label: "India Place", kind: "other", bg: "bg-ink-100 text-ink-700 border-ink-200" };
}

const CACHE_KEY = "fp_society_finder_cache_v2";

export function SocietyFinderClient() {
  const [pin, setPin] = useState("411001");
  const [category, setCategory] = useState("Cooperative Credit Society");
  const [pageSize, setPageSize] = useState(20);
  const [entityFilter, setEntityFilter] = useState<"ALL" | "CREDIT_ONLY" | "HOUSING_ONLY" | "BANK_ONLY">("CREDIT_ONLY");

  // Results & UI State
  const [places, setPlaces] = useState<Place[]>([]);
  const [summary, setSummary] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRestoredFromCache, setIsRestoredFromCache] = useState(false);
  const [cachedTimeStr, setCachedTimeStr] = useState<string>("");

  // Lead saving states
  const [addedLeads, setAddedLeads] = useState<
    Record<string, { id: string; leadCode: string; status: "created" | "already_exists" }>
  >({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [saveBanner, setSaveBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Restore cached search results from localStorage on page change/mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      // Valid for 24 hours
      const isFresh = Date.now() - (cached.timestamp || 0) < 24 * 60 * 60 * 1000;
      if (isFresh && Array.isArray(cached.places) && cached.places.length > 0) {
        if (cached.pin !== undefined) setPin(cached.pin);
        if (cached.category) setCategory(cached.category);
        if (cached.pageSize) setPageSize(cached.pageSize);
        if (cached.entityFilter) setEntityFilter(cached.entityFilter);
        setPlaces(cached.places);
        if (cached.summary) setSummary(cached.summary);
        if (cached.addedLeads) setAddedLeads(cached.addedLeads);
        setIsRestoredFromCache(true);
        if (cached.timestamp) {
          const d = new Date(cached.timestamp);
          setCachedTimeStr(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }
      }
    } catch {
      // Ignore cache restore errors
    }
  }, []);

  function handleFilterChange(filter: "ALL" | "CREDIT_ONLY" | "HOUSING_ONLY" | "BANK_ONLY") {
    setEntityFilter(filter);
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        cached.entityFilter = filter;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      }
    } catch {}
  }

  function handleClearResults() {
    setPlaces([]);
    setSummary(null);
    setSelectedKeys(new Set());
    setIsRestoredFromCache(false);
    setCachedTimeStr("");
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  }

  // Sync existing leads from search response into addedLeads
  useEffect(() => {
    if (places.length) {
      const existing: Record<string, { id: string; leadCode: string; status: "created" | "already_exists" }> = {};
      for (const p of places) {
        if (p.existingLead) {
          if (p.id) existing[p.id] = { id: p.existingLead.id, leadCode: p.existingLead.leadCode, status: "already_exists" };
          if (p.displayName?.text) existing[p.displayName.text] = { id: p.existingLead.id, leadCode: p.existingLead.leadCode, status: "already_exists" };
        }
      }
      setAddedLeads((prev) => ({ ...prev, ...existing }));
    }
  }, [places]);

  // Helper to get saved lead info for a place
  function getLeadInfo(place: Place) {
    const byId = place.id ? addedLeads[place.id] : null;
    const byName = place.displayName?.text ? addedLeads[place.displayName.text] : null;
    if (byId) return byId;
    if (byName) return byName;
    if (place.existingLead) {
      return { id: place.existingLead.id, leadCode: place.existingLead.leadCode, status: "already_exists" as const };
    }
    return null;
  }

  // PIN Dropdown State
  const [pinDropdownOpen, setPinDropdownOpen] = useState(false);
  const [pinSearch, setPinSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPinDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const detectedLocation = useMemo(() => {
    if (!pin || pin.length < 2) return null;
    const match = findIndiaLocation(pin) || (findPin(pin) ? { ...findPin(pin)!, state: "Maharashtra" } : null);
    if (match) return match;
    const st = inferStateFromPin(pin);
    if (st) {
      return { pin, area: "", city: "", district: "", state: st, region: "" };
    }
    return null;
  }, [pin]);

  // Combined PAN-India PIN list for dropdown
  const allLocations = useMemo(() => {
    const mhList = MAHARASHTRA_PINS.map((m) => ({
      pin: m.pin,
      area: m.area,
      city: m.city,
      district: m.district,
      state: "Maharashtra",
      region: m.region,
    }));
    return [...mhList, ...POPULAR_INDIAN_HUBS];
  }, []);

  // Filtered PIN list for dropdown
  const filteredPins = useMemo(() => {
    const q = pinSearch.toLowerCase().trim();
    return allLocations.filter((item) => {
      const matchRegion =
        selectedRegion === "All Regions" ||
        item.region.toLowerCase().includes(selectedRegion.toLowerCase()) ||
        item.state.toLowerCase().includes(selectedRegion.toLowerCase());
      if (!matchRegion) return false;
      if (!q) return true;
      return (
        item.pin.includes(q) ||
        item.area.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q)
      );
    });
  }, [allLocations, pinSearch, selectedRegion]);

  function handleSelectPin(p: { pin: string; city: string; state?: string; area: string }) {
    setPin(p.pin);
    setPinDropdownOpen(false);
    setPinSearch("");
  }

  // Filter places based on active entityFilter
  const displayPlaces = useMemo(() => {
    if (entityFilter === "CREDIT_ONLY") {
      return places.filter((p) => p.entityType === "CREDIT_SOCIETY");
    }
    if (entityFilter === "HOUSING_ONLY") {
      return places.filter((p) => p.entityType === "HOUSING_SOCIETY");
    }
    if (entityFilter === "BANK_ONLY") {
      return places.filter((p) => p.entityType === "BANK");
    }
    return places;
  }, [places, entityFilter]);

  const counts = useMemo(() => {
    const credit = places.filter((p) => p.entityType === "CREDIT_SOCIETY").length;
    const housing = places.filter((p) => p.entityType === "HOUSING_SOCIETY").length;
    const banks = places.filter((p) => p.entityType === "BANK").length;
    const exact = displayPlaces.filter((p) => p.pinCode === pin).length;
    return {
      total: places.length,
      credit,
      housing,
      banks,
      exact,
      filteredTotal: displayPlaces.length
    };
  }, [places, displayPlaces, pin]);

  const unaddedPlaces = useMemo(() => {
    return displayPlaces.filter((p) => !getLeadInfo(p));
  }, [displayPlaces, addedLeads]);

  const selectedPlaces = useMemo(() => {
    return displayPlaces.filter((p) => {
      const key = p.id || p.displayName?.text || "";
      return selectedKeys.has(key);
    });
  }, [displayPlaces, selectedKeys]);

  async function handleSaveLeads(placesToSave: Place[]) {
    if (!placesToSave.length) return;

    const idsToMarkSaving = new Set(placesToSave.map((p) => p.id || p.displayName?.text || ""));
    setSavingIds((prev) => new Set([...prev, ...idsToMarkSaving]));
    if (placesToSave.length > 1) {
      setBulkSaving(true);
    }
    setSaveBanner(null);

    try {
      const res = await fetch("/api/society-finder/save-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          places: placesToSave,
          targetPin: pin.trim(),
        })
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save societies to Leads database");
      }

      const nextAdded: Record<string, { id: string; leadCode: string; status: "created" | "already_exists" }> = {};
      if (Array.isArray(data.results)) {
        for (const item of data.results) {
          if (item.placeId) {
            nextAdded[item.placeId] = { id: item.id, leadCode: item.leadCode, status: item.status };
          }
          if (item.legalName) {
            nextAdded[item.legalName] = { id: item.id, leadCode: item.leadCode, status: item.status };
          }
        }
      }

      setAddedLeads((prev) => {
        const updated = { ...prev, ...nextAdded };
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const cached = JSON.parse(raw);
            cached.addedLeads = updated;
            localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
          }
        } catch {}
        return updated;
      });

      // Remove saved places from selectedKeys
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const p of placesToSave) {
          next.delete(p.id || p.displayName?.text || "");
        }
        return next;
      });

      if (placesToSave.length === 1) {
        const item = data.results?.[0];
        const verb = item?.status === "already_exists" ? "already in" : "added to";
        setSaveBanner({
          type: "success",
          message: `"${placesToSave[0].displayName?.text}" is ${verb} CRM Leads (${item?.leadCode || "Lead"})!`
        });
      } else {
        const createdCount = data.createdCount || 0;
        const skippedCount = data.skippedCount || 0;
        setSaveBanner({
          type: "success",
          message: `Successfully added ${createdCount} societies to Leads database! ${
            skippedCount > 0 ? `(${skippedCount} skipped as already existing)` : ""
          }`
        });
      }
    } catch (err: any) {
      setSaveBanner({
        type: "error",
        message: err?.message || "Failed to save societies to leads"
      });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        for (const id of idsToMarkSaving) {
          next.delete(id);
        }
        return next;
      });
      setBulkSaving(false);
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setError("Please enter a 6-digit Indian PIN code to search (e.g. 411001 Pune, 380001 Ahmedabad, 560001 Bengaluru, 110001 Delhi).");
      return;
    }
    if (!/^\d{6}$/.test(cleanPin)) {
      setError("PIN code must be a valid 6-digit number (e.g. 411001, 380001, 560001, 110001).");
      return;
    }

    setError("");
    setLoading(true);
    setPlaces([]);
    setSummary(null);
    setIsRestoredFromCache(false);
    setCachedTimeStr("");

    try {
      const res = await fetch("/api/society-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: cleanPin,
          category: category.trim(),
          pageSize,
          entityFilter: "ALL"
        })
      });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Unexpected server response (${res.status} ${res.statusText}). Please refresh and try again.`
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      const returnedPlaces = data.places || [];
      setPlaces(returnedPlaces);
      setSummary(data);
      setIsRestoredFromCache(false);

      // Save fresh search results to cache so they persist across page switches
      try {
        const now = Date.now();
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            timestamp: now,
            pin: cleanPin,
            category: category.trim(),
            pageSize,
            entityFilter,
            summary: data,
            places: returnedPlaces,
            addedLeads
          })
        );
        const d = new Date(now);
        setCachedTimeStr(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch (cacheErr) {
        console.warn("Failed to cache society finder results:", cacheErr);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to search cooperative societies");
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const headers = [
      "Society / Bank Name",
      "Entity Type",
      "PIN Code",
      "Match Type",
      "Address",
      "Phone",
      "Website",
      "Google Maps URL",
      "Latitude",
      "Longitude"
    ];

    const rows = displayPlaces.map((p) => {
      const match = matchFor(p, pin);
      const mapsUrl =
        p.googleMapsUri ||
        (p.location
          ? `https://www.google.com/maps?q=${p.location.latitude},${p.location.longitude}`
          : "");

      const typeLabel =
        p.entityType === "CREDIT_SOCIETY"
          ? "Co-operative Credit Society / Patsanstha"
          : p.entityType === "HOUSING_SOCIETY"
            ? "Co-operative Housing Society (CHS)"
            : p.entityType === "BANK"
              ? "Co-operative / Commercial Bank"
              : "Other Institution";

      return [
        p.displayName?.text || "",
        typeLabel,
        p.pinCode || "",
        match.label,
        p.formattedAddress || "",
        p.nationalPhoneNumber || "",
        p.websiteUri || "",
        mapsUrl,
        p.location?.latitude?.toString() || "",
        p.location?.longitude?.toString() || ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `societies-${pin}-${entityFilter.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Search Filter Card */}
      <div className="card p-4 space-y-4">
        <div className="border-b border-ink-100 pb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="h2 font-semibold text-ink-900 flex items-center gap-2">
              <Globe className="text-brand-600" size={20} />
              <span>PAN-India Co-operative Society & Bank Finder</span>
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              Query verified Google Places database across all 36 Indian States, Districts, and PIN Codes
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
            PAN-India Search Active
          </span>
        </div>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-12">

            {/* Category / Keyword */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="lbl">Society Category / Keyword</label>
              <input
                type="text"
                className="input font-medium"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Cooperative Credit Society"
              />
              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-0.5">
                {POPULAR_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded border px-2 py-0.5 text-[11px] transition ${
                      category === cat
                        ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                        : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Target PIN Code with Dropdown */}
            <div className="md:col-span-4 space-y-1.5 relative" ref={dropdownRef}>
              <div className="flex items-center justify-between">
                <label className="lbl mb-0">Target PIN Code</label>
              </div>

              {/* Input trigger container: Flexbox prevents any icon overlap */}
              <div className="flex items-center rounded-lg border border-ink-300 bg-white shadow-2xs focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition overflow-hidden">
                <div className="pl-3 pr-1 text-ink-400 shrink-0 select-none">
                  <MapPin size={16} />
                </div>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full bg-transparent py-2 px-2 text-sm font-mono font-medium text-ink-900 tracking-widest outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-400"
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPin(val);
                  }}
                  placeholder="e.g. 500081"
                />
                <button
                  type="button"
                  onClick={() => setPinDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 border-l border-ink-200 bg-ink-50 hover:bg-brand-50 hover:text-brand-700 px-3 py-2 text-xs font-semibold text-ink-600 transition shrink-0 select-none"
                  title="Browse Indian hubs & PIN codes"
                >
                  <span>Browse</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${pinDropdownOpen ? "rotate-180 text-brand-600" : ""}`} />
                </button>
              </div>

              {/* Recognized Area / Hub caption */}
              <div className="min-h-[1.25rem] text-[11px] pt-0.5">
                {detectedLocation ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium truncate" title={[detectedLocation.area, detectedLocation.city, detectedLocation.state].filter(Boolean).join(", ")}>
                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check size={10} className="stroke-[3]" />
                    </span>
                    <span className="truncate">
                      {[detectedLocation.area, detectedLocation.city, detectedLocation.state].filter(Boolean).join(", ")}
                    </span>
                  </div>
                ) : pin.length === 6 ? (
                  <span className="text-ink-600">PIN: {pin} (India)</span>
                ) : (
                  <span className="text-ink-400">Enter any 6-digit Indian PIN code</span>
                )}
              </div>

              {/* PIN Searchable Dropdown Popup */}
              {pinDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-50 w-full sm:w-[420px] rounded-xl border border-ink-200 bg-white p-3 shadow-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-ink-100 pb-2">
                    <span className="font-semibold text-xs text-ink-900">
                      Select Indian City / PIN Code
                    </span>
                    <button
                      type="button"
                      onClick={() => setPinDropdownOpen(false)}
                      className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Search box: Flexbox prevents icon overlap */}
                  <div className="flex items-center rounded-lg border border-ink-300 bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 overflow-hidden">
                    <div className="pl-2.5 pr-1 text-ink-400 shrink-0 select-none">
                      <Search size={14} />
                    </div>
                    <input
                      type="text"
                      className="w-full bg-transparent py-1.5 px-2 text-xs outline-none text-ink-900 placeholder:text-ink-400"
                      placeholder="Search PIN, City, Area (e.g. Hyderabad, Ahmedabad, Pune)..."
                      value={pinSearch}
                      onChange={(e) => setPinSearch(e.target.value)}
                    />
                  </div>

                  {/* Region filter pills */}
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-0.5 pb-0.5">
                    {REGIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRegion(r)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                          selectedRegion === r
                            ? "bg-brand-600 text-white"
                            : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* Scrollable PIN list */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-ink-50 rounded border border-ink-100 text-xs">
                    {filteredPins.length === 0 ? (
                      <div className="p-4 text-center text-ink-500">
                        <p className="text-xs">No matching pre-indexed PIN found</p>
                        {/^\d{6}$/.test(pinSearch) && (
                          <button
                            type="button"
                            onClick={() => {
                              setPin(pinSearch);
                              setPinDropdownOpen(false);
                            }}
                            className="mt-2 btn-primary py-1 px-2 text-xs"
                          >
                            Use Custom PIN {pinSearch}
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredPins.map((item) => {
                        const isSelected = item.pin === pin;
                        return (
                          <button
                            key={item.pin + item.area}
                            type="button"
                            onClick={() => handleSelectPin(item)}
                            className={`w-full flex items-start justify-between p-2 text-left transition hover:bg-brand-50 ${
                              isSelected ? "bg-brand-50/70" : ""
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-ink-900 text-xs">
                                  {item.pin}
                                </span>
                                <span className="rounded bg-ink-100 px-1.5 py-0.2 text-[10px] text-ink-600 font-medium">
                                  {item.city}
                                </span>
                                <span className="text-[10px] text-ink-400">
                                  {item.state}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-600 truncate">{item.area}</p>
                            </div>
                            {isSelected && <Check size={14} className="text-brand-600 mt-1 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Results Limit & Filter */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="lbl">Results Limit</label>
              <select
                className="input"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10 results</option>
                <option value={20}>20 results</option>
                <option value={50}>50 results</option>
                <option value={100}>100 results (Max)</option>
              </select>

              <div className="pt-0.5">
                <label className="lbl text-[11px]">Filter View</label>
                <select
                  className="input py-1 text-xs"
                  value={entityFilter}
                  onChange={(e) => handleFilterChange(e.target.value as any)}
                >
                  <option value="CREDIT_ONLY">Credit Societies / Patsanstha</option>
                  <option value="HOUSING_ONLY">Housing Societies (CHS)</option>
                  <option value="BANK_ONLY">Banks Only</option>
                  <option value="ALL">All Institutions</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
            <span className="text-xs text-ink-500">
              Query:{" "}
              <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[11px]">
                {category} in {pin}{detectedLocation?.city ? ` (${detectedLocation.city}, ${detectedLocation.state})` : detectedLocation?.state ? ` (${detectedLocation.state})` : ""}
              </code>
            </span>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !pin.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Fetching up to {pageSize} Places...
                </>
              ) : (
                <>
                  <Search size={16} /> Search Societies (PAN-India)
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertCircle className="mt-0.5 shrink-0 text-red-600" size={18} />
          <div>
            <h3 className="font-semibold text-sm">Search notice</h3>
            <p className="mt-0.5 text-xs text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Results Section */}
      {summary && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="h2 text-ink-900 font-semibold">
                  Found {displayPlaces.length} {
                    entityFilter === "CREDIT_ONLY"
                      ? "Co-operative Credit Societies"
                      : entityFilter === "HOUSING_ONLY"
                      ? "Housing Societies (CHS)"
                      : entityFilter === "BANK_ONLY"
                      ? "Banks"
                      : "Institutions"
                  } {summary.targetPin ? `for PIN ${summary.targetPin}` : "across India"}
                </h2>
                {isRestoredFromCache && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800 shadow-xs"
                    title={`Cached search results preserved across page changes ${cachedTimeStr ? `(${cachedTimeStr})` : ""}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                    Cached {cachedTimeStr ? `(${cachedTimeStr})` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500">{summary.query} · Target PIN: {summary.targetPin || pin}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearResults}
                className="btn-ghost text-xs text-ink-500 hover:text-red-600 flex items-center gap-1"
                title="Clear cached results from this session"
              >
                <X size={14} /> Clear Results
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!displayPlaces.length}
                className="btn-ghost text-xs"
              >
                <Download size={14} /> Export CSV ({displayPlaces.length})
              </button>
            </div>
          </div>

          {/* Instant Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-ink-100/70 p-1 border border-ink-200 text-xs">
            <span className="px-2 font-medium text-ink-500 flex items-center gap-1 text-[11px]">
              <Filter size={12} /> Filter:
            </span>
            <button
              type="button"
              onClick={() => handleFilterChange("CREDIT_ONLY")}
              className={`rounded-md px-3 py-1 font-medium transition ${entityFilter === "CREDIT_ONLY"
                ? "bg-white text-emerald-700 shadow-sm font-semibold"
                : "text-ink-600 hover:text-ink-900"
                }`}
            >
              Credit Societies ({counts.credit})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("HOUSING_ONLY")}
              className={`rounded-md px-3 py-1 font-medium transition ${entityFilter === "HOUSING_ONLY"
                ? "bg-white text-amber-800 shadow-sm font-semibold"
                : "text-ink-600 hover:text-ink-900"
                }`}
            >
              Housing Societies / CHS ({counts.housing})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("BANK_ONLY")}
              className={`rounded-md px-3 py-1 font-medium transition ${entityFilter === "BANK_ONLY"
                ? "bg-white text-indigo-700 shadow-sm font-semibold"
                : "text-ink-600 hover:text-ink-900"
                }`}
            >
              Banks ({counts.banks})
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange("ALL")}
              className={`rounded-md px-3 py-1 font-medium transition ${entityFilter === "ALL"
                ? "bg-white text-brand-700 shadow-sm font-semibold"
                : "text-ink-600 hover:text-ink-900"
                }`}
            >
              All Results ({counts.total})
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="card p-3">
              <div className="text-xs font-medium text-ink-500">Total Returned</div>
              <div className="mt-1 text-2xl font-semibold text-ink-900">{summary.total}</div>
              <div className="mt-0.5 text-xs text-ink-500">Page limit: {pageSize}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs font-medium text-ink-500">Credit Societies</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-600">{counts.credit}</div>
              <div className="mt-0.5 text-xs text-ink-500">Patsansthas & Credit Co-ops</div>
            </div>
            <div className="card p-3">
              <div className="text-xs font-medium text-ink-500">Housing Societies</div>
              <div className="mt-1 text-2xl font-semibold text-amber-700">{counts.housing}</div>
              <div className="mt-0.5 text-xs text-ink-500">CHS & Residential</div>
            </div>
            <div className="card p-3">
              <div className="text-xs font-medium text-ink-500">Banks Detected</div>
              <div className="mt-1 text-2xl font-semibold text-indigo-600">{counts.banks}</div>
              <div className="mt-0.5 text-xs text-ink-500">Co-op & Commercial</div>
            </div>
            <div className="card p-3">
              <div className="text-xs font-medium text-ink-500">Location Match</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-600">{counts.exact}</div>
              <div className="mt-0.5 text-xs text-ink-500 truncate" title={summary.targetPin ? `PIN ${summary.targetPin}` : "India"}>
                {summary.targetPin ? `PIN ${summary.targetPin}` : "India"}
              </div>
            </div>
          </div>

          {/* Save Status Banner */}
          {saveBanner && (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs ${
                saveBanner.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {saveBanner.type === "success" ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                )}
                <span>{saveBanner.message}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/leads"
                  className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 transition"
                >
                  Open Leads Database →
                </Link>
                <button
                  type="button"
                  onClick={() => setSaveBanner(null)}
                  className="rounded p-1 text-ink-400 hover:text-ink-700"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Bulk Actions Bar */}
          {displayPlaces.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/80 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-ink-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-ink-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                    checked={
                      unaddedPlaces.length > 0 &&
                      unaddedPlaces.every((p) => selectedKeys.has(p.id || p.displayName?.text || ""))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedKeys(new Set(unaddedPlaces.map((p) => p.id || p.displayName?.text || "")));
                      } else {
                        setSelectedKeys(new Set());
                      }
                    }}
                    disabled={unaddedPlaces.length === 0 || bulkSaving}
                  />
                  <span>Select All Unadded ({unaddedPlaces.length})</span>
                </label>

                {selectedKeys.size > 0 && (
                  <span className="rounded-full bg-brand-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-brand-900">
                    {selectedKeys.size} selected
                  </span>
                )}

                {counts.total - unaddedPlaces.length > 0 && (
                  <span className="text-[11px] text-emerald-700 font-medium">
                    ✓ {counts.total - unaddedPlaces.length} already in CRM
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedKeys.size > 0 && (
                  <button
                    type="button"
                    disabled={bulkSaving}
                    onClick={() => handleSaveLeads(selectedPlaces)}
                    className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 shadow-sm"
                  >
                    {bulkSaving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Adding Selected...
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} /> Add Selected ({selectedKeys.size}) to Leads
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  disabled={bulkSaving || unaddedPlaces.length === 0}
                  onClick={() => handleSaveLeads(unaddedPlaces)}
                  className="btn-primary py-1.5 px-4 text-xs font-semibold flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50"
                  title="1-Click: Add all unadded societies to CRM Leads database"
                >
                  {bulkSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving {unaddedPlaces.length} to Leads...
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} /> ⚡ 1-Click: Add All ({unaddedPlaces.length}) to Leads
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Places List */}
          {!displayPlaces.length ? (
            <div className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center">
              <Search className="mx-auto text-ink-400" size={32} />
              <h3 className="mt-2 font-medium text-ink-900 text-sm">No results match this filter</h3>
              <p className="mt-1 text-xs text-ink-500">
                {entityFilter === "CREDIT_ONLY"
                  ? "No credit societies / patsansthas were detected. Try switching filter to 'Housing Societies', 'Banks', or 'All Results'."
                  : entityFilter === "HOUSING_ONLY"
                  ? "No housing societies were detected. Try switching filter to 'Credit Societies' or 'All Results'."
                  : entityFilter === "BANK_ONLY"
                  ? "No banks were returned by Google Places for this keyword/PIN. Try switching filter to 'All Results'."
                  : "Try searching with another category or PIN code."}
              </p>
              {entityFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => handleFilterChange("ALL")}
                  className="mt-3 btn-ghost text-xs"
                >
                  Show All Results ({places.length})
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              {
                displayPlaces.map((place, idx) => {
                  const placeKey = place.id || place.displayName?.text || String(idx);
                  const leadInfo = getLeadInfo(place);
                  const isSavingThis =
                    savingIds.has(place.id || "") ||
                    (place.displayName?.text ? savingIds.has(place.displayName.text) : false);

                  const match = matchFor(place, pin, detectedLocation?.state);
                  const mapsUrl =
                    place.googleMapsUri ||
                    (place.location
                      ? `https://www.google.com/maps?q=${place.location.latitude},${place.location.longitude}`
                      : null);

                  return (
                    <div
                      key={place.id || idx}
                      className="card p-4 transition hover:border-brand-400"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded border-ink-300 text-brand-600 focus:ring-brand-500 h-4 w-4 shrink-0"
                              checked={selectedKeys.has(placeKey)}
                              disabled={Boolean(leadInfo) || bulkSaving}
                              onChange={(e) => {
                                setSelectedKeys((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(placeKey);
                                  else next.delete(placeKey);
                                  return next;
                                });
                              }}
                              title={leadInfo ? "Already in Leads" : "Select for bulk add"}
                            />
                            <span className="grid h-6 w-6 place-items-center rounded bg-ink-100 text-xs font-semibold text-ink-700">
                              {idx + 1}
                            </span>
                            <h3 className="font-semibold text-ink-900 text-base">
                              {place.displayName?.text || "Unnamed Cooperative Institution"}
                            </h3>

                            {/* Entity Type Badge */}
                            {place.entityType === "CREDIT_SOCIETY" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Co-op Credit Society
                              </span>
                            ) : place.entityType === "HOUSING_SOCIETY" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                Housing Society (CHS)
                              </span>
                            ) : place.entityType === "BANK" ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                Bank
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
                                Other Institution
                              </span>
                            )}

                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${match.bg}`}>
                              {match.label}
                            </span>
                          </div>

                          <div className="flex items-start gap-1.5 text-xs text-ink-600 pl-6">
                            <MapPin size={14} className="mt-0.5 shrink-0 text-ink-400" />
                            <span>{place.formattedAddress || "Address not provided"}</span>
                          </div>
                        </div>

                        {/* Add / Status lead action */}
                        {leadInfo ? (
                          <Link
                            href={`/leads/${leadInfo.id}`}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
                            title="View Institution in CRM Leads"
                          >
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>{leadInfo.status === "already_exists" ? "In Leads" : "Added"} ({leadInfo.leadCode})</span>
                            <ExternalLink size={11} className="opacity-70" />
                          </Link>
                        ) : isSavingThis ? (
                          <button
                            type="button"
                            disabled
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700"
                          >
                            <Loader2 size={13} className="animate-spin" />
                            <span>Saving...</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={bulkSaving}
                            onClick={() => handleSaveLeads([place])}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition shadow-sm"
                            title="Add this society to CRM Lead Database"
                          >
                            <UserPlus size={13} />
                            <span>Add to Leads</span>
                          </button>
                        )}
                      </div>

                      {/* Contact & Map Links */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                        {place.nationalPhoneNumber && (
                          <a
                            href={`tel:${place.nationalPhoneNumber}`}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 hover:bg-emerald-100 text-[11px] font-medium"
                          >
                            <Phone size={12} /> {place.nationalPhoneNumber}
                          </a>
                        )}

                        {place.websiteUri && (
                          <a
                            href={place.websiteUri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-brand-700 hover:bg-brand-100 text-[11px] font-medium"
                          >
                            <Globe size={12} /> Website
                          </a>
                        )}

                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-violet-700 hover:bg-violet-100 text-[11px] font-medium"
                          >
                            <ExternalLink size={12} /> Google Maps
                          </a>
                        )}

                        {place.location && (
                          <span className="ml-auto text-[11px] text-ink-400 font-mono">
                            {place.location.latitude.toFixed(4)}°, {place.location.longitude.toFixed(4)}°
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </div>
      )}

      {/* Initial empty state */}
      {!summary && !error && (
        <div className="rounded-xl border border-dashed border-ink-300 bg-white p-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Building2 size={24} />
          </div>
          <h3 className="mt-3 font-semibold text-ink-900 text-base">
            Search Co-operative Societies & Banks across India
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
            Enter any 6-digit Indian PIN code (or browse hubs across Maharashtra, Gujarat, Karnataka, Delhi, Rajasthan, etc.) to discover
            verified credit societies, patsansthas, urban banks, phone numbers, and addresses.
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => handleSearch()}
              className="btn-primary"
            >
              <Search size={15} /> Search Cooperative Societies
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
