export type GeoLocation = {
  ip: string | null;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  isp: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

// In-memory cache for IP lookups (max 1,000 entries)
const geoCache = new Map<string, GeoLocation>();

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.trim();
  return (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "localhost" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean) ||
    clean.startsWith("fc00:") ||
    clean.startsWith("fe80:")
  );
}

/**
 * Resolves IP address to geographical location, city, state, postal code & ISP.
 * Fast in-memory cache, 2s abort timeout, safe non-blocking fallbacks.
 */
export async function getGeoLocation(ip: string | null): Promise<GeoLocation> {
  if (!ip) {
    return {
      ip: null,
      city: "Unknown",
      region: "Unknown",
      country: "India",
      postalCode: "",
      isp: "Unknown Network",
      address: "Unknown Network Address",
      latitude: null,
      longitude: null,
    };
  }

  const cleanIp = ip.split(",")[0].trim();

  if (isPrivateIp(cleanIp)) {
    return {
      ip: cleanIp,
      city: "Pune",
      region: "Maharashtra",
      country: "India",
      postalCode: "411001",
      isp: "Office LAN / Local Network",
      address: "Fivopay Office Network (Pune, Maharashtra)",
      latitude: 18.5204,
      longitude: 73.8567,
    };
  }

  if (geoCache.has(cleanIp)) {
    return geoCache.get(cleanIp)!;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,message,country,regionName,city,zip,lat,lon,isp`, {
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);

    if (res && res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status === "success") {
        const city = data.city || "Pune";
        const region = data.regionName || "Maharashtra";
        const country = data.country || "India";
        const postalCode = data.zip || "";
        const isp = data.isp || "Broadband / Mobile";
        const address = `${city}, ${region}${postalCode ? ` (${postalCode})` : ""}, ${country}`;

        const result: GeoLocation = {
          ip: cleanIp,
          city,
          region,
          country,
          postalCode,
          isp,
          address,
          latitude: typeof data.lat === "number" ? data.lat : null,
          longitude: typeof data.lon === "number" ? data.lon : null,
        };

        if (geoCache.size > 1000) geoCache.clear();
        geoCache.set(cleanIp, result);
        return result;
      }
    }
  } catch {
    // Fallback on timeout or fetch error
  }

  const fallback: GeoLocation = {
    ip: cleanIp,
    city: "Pune",
    region: "Maharashtra",
    country: "India",
    postalCode: "",
    isp: "Internet Provider",
    address: `Pune, Maharashtra, India (${cleanIp})`,
    latitude: null,
    longitude: null,
  };
  geoCache.set(cleanIp, fallback);
  return fallback;
}

/**
 * Parses user agent into readable device, OS, and browser labels.
 */
export function parseUserAgent(ua: string | null): { browser: string; os: string; deviceType: string } {
  if (!ua) return { browser: "Unknown Browser", os: "Unknown OS", deviceType: "Desktop" };

  let browser = "Web Browser";
  if (/edg/i.test(ua)) browser = "Microsoft Edge";
  else if (/opr|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Google Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/firefox|fxios/i.test(ua)) browser = "Mozilla Firefox";

  let os = "Desktop OS";
  if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/windows nt 10/i.test(ua) || /windows 11/i.test(ua)) os = "Windows 10/11";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let deviceType = "Desktop";
  if (/tablet|ipad/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) deviceType = "Tablet";
  else if (/mobile|iphone|ipod|android/i.test(ua)) deviceType = "Mobile";

  return { browser, os, deviceType };
}

/**
 * Formats duration in seconds to human-readable string: e.g. "2 hr 15 min 30 sec"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "< 1 min";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hr${h > 1 ? "s" : ""}`);
  if (m > 0 || h > 0) parts.push(`${m} min`);
  if (h === 0 && s > 0) parts.push(`${s} sec`);

  return parts.join(" ") || "< 1 min";
}
