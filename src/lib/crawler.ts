import * as cheerio from "cheerio";

export interface CrawledWebsiteData {
  website: string;
  pagesCrawled: string[];
  discoveredEmails: string[];
  discoveredPhones: string[];
  discoveredCounters: Array<{ label: string; value: string }>;
  discoveredLeadership: Array<{ name: string; role: string }>;
  discoveredBranches: Array<{ branchNumber?: string; name: string; address: string; phone: string }>;
  discoveredBranchCount?: number | null;
  sanitizedNarrative: string;
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,mr;q=0.8,hi;q=0.7",
};

export async function crawlSocietyWebsite(baseUrl: string): Promise<CrawledWebsiteData> {
  const cleanUrl = baseUrl.trim().endsWith("/") ? baseUrl.trim().slice(0, -1) : baseUrl.trim();

  const pagesCrawled: string[] = [];
  const discoveredEmails = new Set<string>();
  const discoveredPhones = new Set<string>();
  const discoveredCounters: Array<{ label: string; value: string }> = [];
  const discoveredLeadership: Array<{ name: string; role: string }> = [];
  const discoveredBranches: Array<{ branchNumber?: string; name: string; address: string; phone: string }> = [];
  let discoveredBranchCount: number | null = null;
  const narrativeSections: string[] = [];

  // Dynamic set of paths, prioritizing homepage first
  const dynamicPaths = new Set<string>(["/"]);

  // Step 1: Pre-fetch homepage to dynamically discover exact menu & navigation links
  try {
    const homeRes = await fetch(cleanUrl + "/", {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(6000),
    });

    // Check if redirected to private login wall (e.g. Google Sign-in or Microsoft login)
    if (
      homeRes.url.includes("accounts.google.com") ||
      homeRes.url.includes("login.live.com") ||
      homeRes.url.includes("/signin") ||
      homeRes.url.includes("google.com/service/wise")
    ) {
      return {
        website: baseUrl,
        pagesCrawled: [],
        discoveredEmails: [],
        discoveredPhones: [],
        discoveredCounters: [],
        discoveredLeadership: [],
        discoveredBranches: [],
        discoveredBranchCount: null,
        sanitizedNarrative: "",
      };
    }

    if (homeRes.ok) {
      const homeHtml = await homeRes.text();
      const $home = cheerio.load(homeHtml);

      $home("a").each((_, el) => {
        const href = $home(el).attr("href");
        const text = $home(el).text().toLowerCase().trim();
        if (!href || href.startsWith("#") || href.startsWith("javascript") || href.startsWith("mailto") || href.startsWith("tel")) return;

        let path = href;
        if (href.startsWith("http")) {
          if (!href.startsWith(cleanUrl)) return;
          path = href.replace(cleanUrl, "");
        }
        if (!path.startsWith("/")) path = "/" + path;
        const cleanPath = path.split("#")[0].split("?")[0];
        const lower = cleanPath.toLowerCase();

        if (
          lower.includes("about") || lower.includes("story") || lower.includes("history") ||
          lower.includes("board") || lower.includes("director") || lower.includes("management") || lower.includes("leadership") ||
          lower.includes("branch") || lower.includes("network") || lower.includes("locator") ||
          lower.includes("finance") || lower.includes("report") || lower.includes("balance") ||
          lower.includes("chairman") || lower.includes("contact") || lower.includes("career") ||
          text.includes("about") || text.includes("board") || text.includes("director") || text.includes("branch") ||
          text.includes("शाखा") || text.includes("संचालक") || text.includes("अहवाल") || text.includes("संपर्क")
        ) {
          if (cleanPath.length > 1) {
            dynamicPaths.add(cleanPath);
          }
        }
      });
    }
  } catch {
    // Continue with dynamic paths
  }

  // Common fallbacks to check if dynamic paths did not find specific pages
  const fallbackPaths = [
    "/about-us", "/about", "/about-us/", "/about/",
    "/contact-us", "/contact", "/contact-us/", "/contact/",
    "/branches", "/branch", "/our-branches", "/branch/", "/branches/",
    "/board-of-directors", "/board-members", "/directors", "/board-of-directors/",
    "/financial-report", "/financial-report/", "/chairman-message/",
  ];
  for (const fb of fallbackPaths) {
    if (dynamicPaths.size >= 12) break;
    dynamicPaths.add(fb);
  }

  // Crawl up to 10 prioritized targets concurrently
  const targetsArray = Array.from(dynamicPaths).slice(0, 10);

  await Promise.allSettled(
    targetsArray.map(async (p) => {
      try {
        const fullUrl = cleanUrl + (p.startsWith("/") ? p : "/" + p);
        const res = await fetch(fullUrl, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(7000),
        });
        if (!res.ok) return;
        const html = await res.text();
        pagesCrawled.push(p || "/");

        const $ = cheerio.load(html);

        // Remove scripts, styles, spam links
        $("script, style, noscript, nav, footer, header").remove();
        $("a[href*='casino'], a[href*='spin'], a[href*='luck'], a[href*='game'], a[href*='bet']").remove();

        // 1. Extract emails
        const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        for (const em of emails) {
          const lower = em.toLowerCase();
          if (!lower.includes("example.com") && !lower.includes("sentry.io") && !lower.includes("domain.com")) {
            discoveredEmails.add(lower);
          }
        }

        // 2. Extract phones
        const rawPhones = html.match(/(?:(?:023\d{2}|021\d{2}|020|022|\+91|91)?[- ]?[6-9]\d{9}|023\d{2}[- ]?\d{6})/g) || [];
        for (const ph of rawPhones) {
          const cleanPh = ph.trim().replace(/\s+/g, "");
          if (cleanPh.length >= 8 && cleanPh.length <= 15) {
            discoveredPhones.add(cleanPh);
          }
        }

        // 3. Extract PageLayer / Elementor counters
        $("[class*='counter']").each((_, el) => {
          const lastVal = $(el).find("[pagelayer-counter-last-value]").attr("pagelayer-counter-last-value") ||
                          $(el).find(".elementor-counter-number").text().trim();
          const info = $(el).find(".pagelayer-counter-info, .elementor-counter-title").text().trim();
          if (lastVal && info) {
            discoveredCounters.push({ label: info, value: lastVal });
          }
        });

        // 4. Extract director / board member images with alt tags
        $("img").each((_, el) => {
          const alt = ($(el).attr("alt") || "").trim();
          if (
            alt &&
            !alt.includes("पुरस्कार") &&
            !alt.includes("स्वीकारताना") &&
            !alt.includes("हस्ते") &&
            !alt.includes("सोहळा") &&
            !alt.includes("उद्घाटन") &&
            (alt.includes("संस्थाध्यक्ष") || alt.includes("अध्यक्ष") || alt.includes("उपाध्यक्ष") || alt.includes("संचालक") || alt.includes("संचालिका") || alt.includes("व्यवस्थापक") || alt.includes("Director") || alt.includes("Chairman") || alt.includes("CEO") || alt.includes("Manager"))
          ) {
            const parts = alt.split(/[-–—:]/);
            const name = parts[0].trim();
            const role = parts[1]?.trim() || "संचालक (Director)";
            if (name.length > 2 && !discoveredLeadership.some((l) => l.name === name)) {
              discoveredLeadership.push({ name, role });
            }
          }
        });

        // 5. Also extract text-based board members if page contains "Board of Director" or "संचालक मंडळ"
        if (p.includes("board") || p.includes("director")) {
          $("h2, h3, h4, h5, strong, b, .member-name, .team-name").each((_, el) => {
            const raw = $(el).text().trim();
            if (raw.length > 3 && raw.length < 60) {
              const upper = raw.toUpperCase();
              if (upper.includes("CHAIRMAN") || upper.includes("DIRECTOR") || upper.includes("PRESIDENT") || upper.includes("OFFICER") || upper.includes("MANAGER")) {
                const parts = raw.split(/[-–—:]/);
                if (parts.length >= 2) {
                  const name = parts[0].trim();
                  const role = parts[1].trim();
                  if (name.length > 2 && !discoveredLeadership.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
                    discoveredLeadership.push({ name, role });
                  }
                }
              }
            }
          });
        }

        // 6. Extract branches if branch page
        const bodyText = $("body").text().replace(/\s+/g, " ");

        // Check for overall branch count mentions in narrative (e.g. "network of 213 branches", "17 शाखांचा विस्तार")
        const branchCountMatch = bodyText.match(/(?:network of|presence through its|across|over)\s*(\d{1,4})\s*branches/i) ||
                                 bodyText.match(/(\d{1,4})\s*शाखांचा\s*विस्तार/);
        if (branchCountMatch && !discoveredBranchCount) {
          discoveredBranchCount = parseInt(branchCountMatch[1], 10);
        }

        if (p.includes("branch") || p.includes("locator")) {
          const branchMatches = bodyText.matchAll(/शाखा\s*([०-९0-9]+)\s*([^\n\r]+?)(?=शाखा\s*[०-९0-9]+|$)/g);
          for (const m of branchMatches) {
            const num = m[1];
            const fullBranchText = m[2].trim().slice(0, 300);
            const phoneMatch = fullBranchText.match(/(?:फोन|Phone|मो|Call)?:?\s*([\d\s\/-]{8,30})/i);
            discoveredBranches.push({
              branchNumber: num,
              name: fullBranchText.split(/,|–|-|फोन/)[0].trim(),
              address: fullBranchText,
              phone: phoneMatch ? phoneMatch[1].trim() : "",
            });
          }
        }

        // 7. Clean and grab body text
        const sanitized = bodyText
          .replace(/W porównaniu z innymi[\s\S]*?(?=\.|$)/g, "")
          .replace(/The breadth of games[\s\S]*?(?=\.|$)/g, "")
          .replace(/Szybki spacer po[\s\S]*?(?=\.|$)/g, "")
          .slice(0, 4500);

        if (sanitized.length > 60) {
          narrativeSections.push(`[PAGE: ${p || "HOME"}]\n${sanitized}`);
        }
      } catch {
        // Silently tolerate single page crawl failures
      }
    })
  );

  return {
    website: baseUrl,
    pagesCrawled,
    discoveredEmails: Array.from(discoveredEmails).slice(0, 5),
    discoveredPhones: Array.from(discoveredPhones).slice(0, 8),
    discoveredCounters,
    discoveredLeadership,
    discoveredBranches,
    discoveredBranchCount,
    sanitizedNarrative: narrativeSections.join("\n\n"),
  };
}
