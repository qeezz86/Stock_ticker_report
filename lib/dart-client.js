import { unzipSingleFile } from "./zip-utils.js";

const DART_BASE_URL = "https://opendart.fss.or.kr/api";
const REPORT_CODES = {
  annual: "11011",
  q3: "11014",
  h1: "11012",
  q1: "11013"
};

export function createDartClient({ apiKey, fetchImpl = fetch, now = () => Date.now() } = {}) {
  if (!apiKey) {
    throw new Error("DART API key is required.");
  }

  let corpRegistryPromise = null;
  const reportCache = new Map();

  return {
    searchListedCompanies,
    getCorpRecord,
    getAnnualSeries,
    getRecentReportSeries
  };

  async function searchListedCompanies(query) {
    const registry = await loadRegistry();
    const normalized = normalizeQuery(query);
    if (!normalized) {
      return [];
    }

    return registry
      .filter((item) => {
        const haystack = `${item.corpName} ${item.stockCode}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 12);
  }

  async function getCorpRecord(stockCodeOrName) {
    const registry = await loadRegistry();
    const normalized = normalizeQuery(stockCodeOrName);
    return (
      registry.find((item) => item.stockCode === normalized) ||
      registry.find((item) => item.corpName.toLowerCase() === normalized) ||
      registry.find((item) => item.corpName.toLowerCase().includes(normalized))
    );
  }

  async function getAnnualSeries(corpCode, maxItems = 5) {
    const currentYear = new Date(now()).getFullYear();
    const points = [];

    for (let year = currentYear; year >= currentYear - 8 && points.length < maxItems; year -= 1) {
      const rows = await loadFinancialRows({ corpCode, bsnsYear: String(year), reprtCode: REPORT_CODES.annual });
      if (!rows.length) {
        continue;
      }

      const point = buildFinancialPoint(rows, {
        label: String(year),
        periodType: "annual"
      });

      if (point) {
        points.push(point);
      }
    }

    return points.reverse();
  }

  async function getRecentReportSeries(corpCode, maxItems = 4) {
    const currentYear = new Date(now()).getFullYear();
    const candidates = [];

    for (let year = currentYear; year >= currentYear - 8; year -= 1) {
      candidates.push(
        { year, reprtCode: REPORT_CODES.annual, label: `${year} FY`, sortKey: year * 10 + 4, periodType: "annual" },
        { year, reprtCode: REPORT_CODES.q3, label: `${year} Q3`, sortKey: year * 10 + 3, periodType: "quarter" },
        { year, reprtCode: REPORT_CODES.h1, label: `${year} H1`, sortKey: year * 10 + 2, periodType: "quarter" },
        { year, reprtCode: REPORT_CODES.q1, label: `${year} Q1`, sortKey: year * 10 + 1, periodType: "quarter" }
      );
    }

    const points = [];
    const seen = new Set();

    for (const candidate of candidates) {
      if (points.length >= maxItems) {
        break;
      }

      const cacheKey = `${corpCode}:${candidate.year}:${candidate.reprtCode}`;
      const cached = reportCache.get(cacheKey);
      const rows =
        cached ??
        (await loadFinancialRows({
          corpCode,
          bsnsYear: String(candidate.year),
          reprtCode: candidate.reprtCode
        }));

      if (!rows.length) {
        continue;
      }

      reportCache.set(cacheKey, rows);
      const point = buildFinancialPoint(rows, candidate);
      if (!point || seen.has(point.label)) {
        continue;
      }

      seen.add(point.label);
      points.push(point);
    }

    return points.sort((left, right) => left.sortKey - right.sortKey);
  }

  async function loadRegistry() {
    if (!corpRegistryPromise) {
      corpRegistryPromise = fetchCorpRegistry();
    }
    return corpRegistryPromise;
  }

  async function fetchCorpRegistry() {
    const response = await fetchImpl(`${DART_BASE_URL}/corpCode.xml?crtfc_key=${encodeURIComponent(apiKey)}`);
    if (!response.ok) {
      throw new Error(`Failed to load DART corp code registry: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const xmlBytes = unzipSingleFile(buffer);
    const xml = new TextDecoder("utf-8").decode(xmlBytes);
    const records = [];
    const blockRegex = /<list>([\s\S]*?)<\/list>/g;
    let match;
    while ((match = blockRegex.exec(xml))) {
      const block = match[1];
      const corpCode = extractTag(block, "corp_code");
      const corpName = extractTag(block, "corp_name");
      const stockCode = extractTag(block, "stock_code");
      if (stockCode && stockCode !== "000000" && corpCode && corpName) {
        records.push({
          corpCode,
          corpName,
          stockCode,
          market: "KRX 상장사"
        });
      }
    }

    return records;
  }

  async function loadFinancialRows({ corpCode, bsnsYear, reprtCode }) {
    const url = new URL(`${DART_BASE_URL}/fnlttSinglAcnt.json`);
    url.searchParams.set("crtfc_key", apiKey);
    url.searchParams.set("corp_code", corpCode);
    url.searchParams.set("bsns_year", bsnsYear);
    url.searchParams.set("reprt_code", reprtCode);

    const response = await fetchImpl(url);
    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    if (payload.status && payload.status !== "000") {
      return [];
    }

    return Array.isArray(payload.list) ? payload.list : [];
  }
}

function buildFinancialPoint(rows, candidate) {
  const preferredRows = rows
    .filter((row) => row.fs_div === "CFS")
    .concat(rows.filter((row) => row.fs_div !== "CFS"));

  const revenue = pickAccountAmount(preferredRows, ["매출액", "영업수익", "수익(매출)", "수익"]);
  const operatingIncome = pickAccountAmount(preferredRows, ["영업이익", "영업손익"]);

  if (revenue == null && operatingIncome == null) {
    return null;
  }

  return {
    label: candidate.label,
    sortKey: candidate.sortKey,
    periodType: candidate.periodType,
    revenue,
    operatingIncome
  };
}

function pickAccountAmount(rows, aliases) {
  for (const alias of aliases) {
    const row = rows.find((item) => normalizeText(item.account_nm) === normalizeText(alias));
    if (row) {
      return toAmount(row.thstrm_amount ?? row.thstrm_add_amount);
    }
  }

  for (const alias of aliases) {
    const row = rows.find((item) => normalizeText(item.account_nm).includes(normalizeText(alias)));
    if (row) {
      return toAmount(row.thstrm_amount ?? row.thstrm_add_amount);
    }
  }

  return null;
}

function toAmount(value) {
  if (value == null || value === "" || value === "-") {
    return null;
  }

  const normalized = String(value).replaceAll(",", "").replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>(.*?)<\/${tagName}>`));
  return match ? match[1].trim() : "";
}

function normalizeQuery(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? "").replaceAll(/\s+/g, "").toLowerCase();
}
