import type {
  ResearchConfidenceLevel,
  ResearchSourceOrigin,
} from "@/lib/supabase/types";

export interface CollectedExternalEvidence {
  sourceUrl: string;
  sourceTitle: string;
  retrievedAt: string;
  relevantExtract: string;
  dataLimitations: string;
  confidenceLevel: ResearchConfidenceLevel;
  confidenceRationale: string;
  sourceOrigin: ResearchSourceOrigin;
}

export interface EvidenceCollectionResult {
  sources: CollectedExternalEvidence[];
  realtimeDataAvailable: boolean;
  realtimeUnavailableReason: string | null;
  diagnostics: string[];
}

const FETCH_TIMEOUT_MS = 7_500;
const MAX_BODY_CHARS = 36_000;

/**
 * SSRF protection: blocks localhost, loopback, link-local, and RFC1918 private hosts.
 */
export function isSafePublicHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "::1" ||
      host === "[::1]" ||
      host === "0.0.0.0"
    ) {
      return false;
    }

    // Block literal IPv4 private/loopback/link-local ranges
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [a, b] = [Number(ipv4Match[1]), Number(ipv4Match[2])];
      if (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTagContent(xmlOrHtml: string, tagName: string): string {
  const cdataRegex = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`,
    "i"
  );
  const cdataMatch = xmlOrHtml.match(cdataRegex);
  if (cdataMatch?.[1]) {
    return decodeHtmlEntities(cdataMatch[1]);
  }
  const simpleRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xmlOrHtml.match(simpleRegex);
  return match?.[1] ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, " ")) : "";
}

async function fetchTextWithTimeout(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "CreatorOS-ResearchBot/1.0 (+https://creatoros.id)",
        Accept: "text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    return text.slice(0, MAX_BODY_CHARS);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches public Google News RSS items for transparent, timestamped web headlines.
 */
export async function fetchPublicNewsRssEvidence(
  query: string,
  language: "id" | "en",
  maxItems = 5
): Promise<{ items: CollectedExternalEvidence[]; error?: string }> {
  const hl = language === "en" ? "en-US" : "id-ID";
  const gl = language === "en" ? "US" : "ID";
  const ceid = language === "en" ? "US:en" : "ID:id";
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query.trim()
  )}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

  try {
    const xml = await fetchTextWithTimeout(rssUrl);
    const retrievedAt = new Date().toISOString();
    const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    const results: CollectedExternalEvidence[] = [];

    for (const block of itemBlocks.slice(0, maxItems)) {
      const title = extractTagContent(block, "title");
      const link = extractTagContent(block, "link");
      const pubDate = extractTagContent(block, "pubDate");
      const sourcePublisher = extractTagContent(block, "source");
      const description = extractTagContent(block, "description");

      if (title && link && isSafePublicHttpUrl(link)) {
        const summaryParts = [
          sourcePublisher ? `Penerbit: ${sourcePublisher}.` : "",
          pubDate ? `Tanggal publikasi: ${pubDate}.` : "",
          description ? `Ringkasan tajuk: ${description}` : `Tajuk berita: ${title}`,
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 700);

        results.push({
          sourceUrl: link,
          sourceTitle: title.slice(0, 260),
          retrievedAt,
          relevantExtract: summaryParts,
          dataLimitations:
            "Diambil dari indeks tajuk publik Google News RSS; metrik performa konten internal platform sosial tidak termasuk dalam sumber ini.",
          confidenceLevel: "medium",
          confidenceRationale:
            "Artikel publik terindeks dengan waktu publikasi dan penerbit yang dapat diverifikasi.",
          sourceOrigin: "rss_feed",
        });
      }
    }

    return { items: results };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fetches metadata & excerpt from explicit user-supplied public URLs.
 */
export async function fetchUserProvidedUrlsEvidence(
  urls: string[]
): Promise<{ items: CollectedExternalEvidence[]; errors: string[] }> {
  const uniqueUrls = Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean))).slice(
    0,
    5
  );
  const items: CollectedExternalEvidence[] = [];
  const errors: string[] = [];

  for (const url of uniqueUrls) {
    if (!isSafePublicHttpUrl(url)) {
      errors.push(`URL ditolak oleh filter keamanan publik: ${url}`);
      continue;
    }

    const retrievedAt = new Date().toISOString();
    try {
      const html = await fetchTextWithTimeout(url);
      const rawTitle =
        extractTagContent(html, "title") ||
        html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] ||
        url;
      const metaDesc =
        html.match(/name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] ||
        html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] ||
        "";
      const bodySnippet = decodeHtmlEntities(
        html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
      ).slice(0, 500);

      const extract = decodeHtmlEntities(metaDesc || bodySnippet || rawTitle).slice(
        0,
        750
      );

      items.push({
        sourceUrl: url,
        sourceTitle: decodeHtmlEntities(rawTitle).slice(0, 260) || url,
        retrievedAt,
        relevantExtract:
          extract.length >= 10
            ? extract
            : `Halaman referensi publik dari pengguna (${url}).`,
        dataLimitations:
          "Ekstraksi HTML statis publik; konten dinamis berbasis login atau metrik analitik privat tidak dapat diakses.",
        confidenceLevel: "high",
        confidenceRationale:
          "Sumber URL diberikan langsung oleh pengguna dan berhasil diambil pada waktu riset.",
        sourceOrigin: "user_url",
      });
    } catch (err) {
      // Record user URL transparently with fetch limitation rather than dropping or faking content
      items.push({
        sourceUrl: url,
        sourceTitle: `Referensi URL Pengguna (${new URL(url).hostname})`,
        retrievedAt,
        relevantExtract:
          "URL dicatat sebagai referensi pengguna, namun isi halaman penuh tidak dapat diakses otomatis oleh pengambil HTTP statis.",
        dataLimitations: `Pengambilan otomatis dibatasi oleh host target (${
          err instanceof Error ? err.message : "koneksi terbatas"
        }); evaluasi mengandalkan konteks yang diberikan pengguna.`,
        confidenceLevel: "low",
        confidenceRationale:
          "URL valid dicatat dari input pengguna tetapi memerlukan verifikasi manual karena pembatasan akses halaman.",
        sourceOrigin: "user_url",
      });
    }
  }

  return { items, errors };
}

/**
 * Orchestrates external evidence gathering prior to AI synthesis.
 * Never fabricates sources; explicitly reports why real-time web data is unavailable if 0 live items are retrieved.
 */
export async function collectResearchEvidence(params: {
  query: string;
  language: "id" | "en";
  referenceUrls?: string[];
  skipLiveNewsFetch?: boolean;
}): Promise<EvidenceCollectionResult> {
  const diagnostics: string[] = [];
  const collected: CollectedExternalEvidence[] = [];
  let rssSucceededWithItems = false;

  if (params.referenceUrls && params.referenceUrls.length > 0) {
    const userUrlRes = await fetchUserProvidedUrlsEvidence(params.referenceUrls);
    collected.push(...userUrlRes.items);
    diagnostics.push(...userUrlRes.errors);
  }

  if (!params.skipLiveNewsFetch) {
    const rssRes = await fetchPublicNewsRssEvidence(params.query, params.language, 5);
    if (rssRes.items.length > 0) {
      rssSucceededWithItems = true;
      collected.push(...rssRes.items);
    } else if (rssRes.error) {
      diagnostics.push(`Pengambilan berita publik RSS gagal: ${rssRes.error}`);
    } else {
      diagnostics.push(
        "Indeks berita publik RSS tidak mengembalikan artikel yang cocok persis untuk kueri ini."
      );
    }
  }

  const deduped = new Map<string, CollectedExternalEvidence>();
  for (const item of collected) {
    if (!deduped.has(item.sourceUrl)) {
      deduped.set(item.sourceUrl, item);
    }
  }

  const finalSources = Array.from(deduped.values());
  const realtimeDataAvailable = rssSucceededWithItems;
  const realtimeUnavailableReason = realtimeDataAvailable
    ? null
    : diagnostics.length > 0
      ? `Data tren real-time publik terbatas: ${diagnostics.join(" ")}`
      : "Data metrik real-time langsung dari API tertutup platform sosial belum terhubung; laporan memisahkan bukti sumber yang tersedia dari interpretasi strategis AI.";

  return {
    sources: finalSources,
    realtimeDataAvailable,
    realtimeUnavailableReason,
    diagnostics,
  };
}
