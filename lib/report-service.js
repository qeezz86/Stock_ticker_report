import { createStockProvider } from "./stock-provider.js";

const CACHE_TTL_MS = 5 * 60 * 1000;

export function createReportService({ provider = createStockProvider(), now = () => Date.now() } = {}) {
  const cache = new Map();

  async function search(query) {
    return provider.search(query);
  }

  async function getReport(ticker) {
    const cached = cache.get(ticker);
    const currentTime = now();
    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }

    const source = await provider.getReportSource(ticker);
    if (!source) {
      return null;
    }

    const report = normalizeReport(source);
    cache.set(ticker, {
      value: report,
      expiresAt: currentTime + CACHE_TTL_MS
    });
    return report;
  }

  return {
    search,
    getReport,
    _cache: cache
  };
}

function normalizeReport(source) {
  const annual = source.financials.annual.map(normalizeFinancialPoint);
  const quarterly = source.financials.quarterly.map(normalizeFinancialPoint);
  const priceChart = source.priceHistory.map((entry) => ({
    date: entry.date,
    close: entry.close
  }));
  const volumeChart = source.priceHistory.map((entry) => ({
    date: entry.date,
    volume: entry.volume
  }));
  const flows = source.flows.map((entry) => ({
    date: entry.date,
    foreignNetBuy: entry.foreignNetBuy,
    institutionNetBuy: entry.institutionNetBuy
  }));

  return {
    company: source.company,
    financials: {
      annual,
      quarterly
    },
    valuation: {
      per: source.valuation.per,
      pbr: source.valuation.pbr,
      eps: source.valuation.eps,
      bps: source.valuation.bps
    },
    industry: source.industry,
    priceChart,
    volumeChart,
    flows,
    reportSummary: buildSummary({
      company: source.company,
      annual,
      quarterly,
      valuation: source.valuation,
      industry: source.industry,
      flows
    })
  };
}

function normalizeFinancialPoint(point) {
  return {
    label: point.label,
    revenue: point.revenue,
    operatingIncome: point.operatingIncome
  };
}

function buildSummary({ company, annual, quarterly, valuation, industry, flows }) {
  const annualTrend = describeFinancialTrend(annual);
  const quarterTrend = describeFinancialTrend(quarterly);
  const valuationSummary = describeValuation(valuation);
  const flowSummary = describeFlows(flows);

  return {
    overview: `${company.name}은(는) ${company.market} 상장 ${company.industryName} 기업입니다. 현재 산업 성장성 평가는 ${industry.growthScore} 수준으로 분류됩니다.`,
    financials: `연간 기준 ${annualTrend}. 최근 분기 기준 ${quarterTrend}.`,
    valuation: valuationSummary,
    industry: industry.description,
    flows: flowSummary,
    conclusion: `${annualTrend}. ${valuationSummary} ${flowSummary}`
  };
}

function describeFinancialTrend(points) {
  if (!points.length) {
    return "재무 데이터가 없습니다";
  }

  const first = points[0];
  const last = points[points.length - 1];
  const revenueGrowth = ratioChange(first.revenue, last.revenue);
  const incomeGrowth = ratioChange(first.operatingIncome, last.operatingIncome);
  const revenueDirection = growthWord(revenueGrowth);
  const incomeDirection = incomeWord(first.operatingIncome, last.operatingIncome, incomeGrowth);

  return `매출은 ${first.label} 대비 ${last.label}에 ${revenueDirection}, 영업이익은 ${incomeDirection}`;
}

function describeValuation(valuation) {
  const parts = [];
  if (valuation.per == null) {
    parts.push("PER 데이터는 현재 제공되지 않습니다.");
  } else {
    const perTone = valuation.per >= 20 ? "상대적으로 높은 편" : valuation.per >= 10 ? "중립 구간" : "낮은 편";
    parts.push(`PER은 ${valuation.per.toFixed(1)}배로 ${perTone}입니다.`);
  }

  if (valuation.pbr == null) {
    parts.push("PBR 데이터는 현재 제공되지 않습니다.");
  } else {
    const pbrTone = valuation.pbr >= 2 ? "자산가치 대비 프리미엄이 반영된 수준" : "자산가치 대비 무난한 수준";
    parts.push(`PBR은 ${valuation.pbr.toFixed(2)}배로 ${pbrTone}입니다.`);
  }
  return parts.join(" ");
}

function describeFlows(flows) {
  if (!flows.length) {
    return "수급 데이터가 없습니다.";
  }

  const foreignTotal = flows.reduce((sum, item) => sum + item.foreignNetBuy, 0);
  const institutionTotal = flows.reduce((sum, item) => sum + item.institutionNetBuy, 0);

  const foreignTone = foreignTotal > 0 ? "순매수 우위" : foreignTotal < 0 ? "순매도 우위" : "중립";
  const institutionTone = institutionTotal > 0 ? "순매수 우위" : institutionTotal < 0 ? "순매도 우위" : "중립";

  return `최근 구간에서 외국인은 ${foreignTone}, 기관은 ${institutionTone} 흐름입니다.`;
}

function ratioChange(base, current) {
  if (base === 0 || base == null || current == null) {
    return null;
  }
  return ((current - base) / Math.abs(base)) * 100;
}

function growthWord(change) {
  if (change == null) {
    return "변화 판단이 어렵습니다";
  }
  if (change >= 20) {
    return "뚜렷하게 성장했습니다";
  }
  if (change >= 5) {
    return "완만하게 증가했습니다";
  }
  if (change > -5) {
    return "대체로 유지됐습니다";
  }
  if (change > -20) {
    return "감소했습니다";
  }
  return "큰 폭으로 둔화됐습니다";
}

function incomeWord(base, current, change) {
  if (base == null || current == null) {
    return "데이터 부족으로 판단이 어렵습니다";
  }
  if (base < 0 && current > 0) {
    return "적자에서 흑자로 전환됐습니다";
  }
  if (base > 0 && current < 0) {
    return "흑자에서 적자로 전환됐습니다";
  }
  return growthWord(change);
}
