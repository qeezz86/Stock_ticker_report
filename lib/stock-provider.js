import { STOCK_FIXTURES, INDUSTRY_PROFILES } from "../data/stocks.js";
import { createDartClient } from "./dart-client.js";

export function createStockProvider({ apiKey = process.env.DART_API_KEY, now = () => Date.now(), dartClient } = {}) {
  if (apiKey) {
    return createLiveStockProvider({ apiKey, now, dartClient });
  }

  return createFixtureProvider();
}

export function createFixtureProvider() {
  const index = new Map(STOCK_FIXTURES.map((stock) => [stock.ticker, stock]));

  return {
    async search(query) {
      const normalized = query.trim().toLowerCase();
      if (!normalized) {
        return [];
      }

      return STOCK_FIXTURES.filter((stock) => {
        const haystack = `${stock.ticker} ${stock.name} ${stock.market} ${stock.industryName}`.toLowerCase();
        return haystack.includes(normalized);
      })
        .slice(0, 8)
        .map((stock) => buildSearchResult(stock));
    },

    async getReportSource(ticker) {
      const stock = index.get(ticker);
      if (!stock) {
        return null;
      }

      return buildFixtureReportSource(stock);
    }
  };
}

export function createLiveStockProvider({ apiKey, now, dartClient }) {
  const dart = dartClient ?? createDartClient({ apiKey, now });
  const fixtureIndex = new Map(STOCK_FIXTURES.map((stock) => [stock.ticker, stock]));

  return {
    async search(query) {
      const results = await dart.searchListedCompanies(query);
      if (results.length > 0) {
        return results.map((item) => ({
          ticker: item.stockCode,
          name: item.corpName,
          market: item.market,
          industryName: "업종 정보 미연결",
          marketCap: null,
          price: null,
          changePercent: null
        }));
      }

      return createFixtureProvider().search(query);
    },

    async getReportSource(ticker) {
      const stock = fixtureIndex.get(ticker);
      const corp = await dart.getCorpRecord(ticker);
      if (!corp) {
        if (stock) {
          return buildFixtureReportSource(stock);
        }
        return null;
      }

      const annualFinancials = await dart.getAnnualSeries(corp.corpCode, 5);
      const quarterlyFinancials = await dart.getRecentReportSeries(corp.corpCode, 4);

      return {
        company: {
          ticker: corp.stockCode,
          name: corp.corpName,
          market: corp.market,
          industryName: "업종 정보 미연결",
          marketCap: null,
          price: null,
          changePercent: null
        },
        financials: {
          annual: annualFinancials,
          quarterly: quarterlyFinancials
        },
        valuation: {
          per: null,
          pbr: null,
          eps: null,
          bps: null
        },
        industry: {
          title: "업종 정보 미연결",
          growthScore: "미제공",
          description: "DART 공시 기반으로 기업명과 재무제표는 연결되지만, 업종 세부 분류는 아직 별도 매핑이 없습니다.",
          drivers: [],
          risks: []
        },
        priceHistory: stock?.priceHistory ?? [],
        flows: stock?.flows ?? []
      };
    }
  };
}

function buildSearchResult(stock) {
  return {
    ticker: stock.ticker,
    name: stock.name,
    market: stock.market,
    industryName: stock.industryName,
    marketCap: stock.marketCap,
    price: stock.price,
    changePercent: stock.changePercent
  };
}

function buildFixtureReportSource(stock) {
  return {
    company: {
      ticker: stock.ticker,
      name: stock.name,
      market: stock.market,
      industryName: stock.industryName,
      marketCap: stock.marketCap,
      price: stock.price,
      changePercent: stock.changePercent
    },
    financials: {
      annual: stock.annualFinancials,
      quarterly: stock.quarterlyFinancials
    },
    valuation: stock.valuation,
    industry: INDUSTRY_PROFILES[stock.industryKey] ?? {
      title: stock.industryName,
      growthScore: "중",
      description: "업종 설명 데이터가 아직 준비되지 않았습니다.",
      drivers: [],
      risks: []
    },
    priceHistory: stock.priceHistory,
    flows: stock.flows
  };
}
