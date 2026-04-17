import test from "node:test";
import assert from "node:assert/strict";
import { createLiveStockProvider } from "../lib/stock-provider.js";

test("live provider searches the DART registry and normalizes report source", async () => {
  const dartClient = {
    async searchListedCompanies(query) {
      assert.equal(query, "삼성");
      return [{ corpName: "삼성전자", stockCode: "005930", market: "KRX 상장사" }];
    },
    async getCorpRecord(ticker) {
      assert.equal(ticker, "005930");
      return { corpCode: "00126380", corpName: "삼성전자", stockCode: "005930", market: "KRX 상장사" };
    },
    async getAnnualSeries(corpCode, maxItems) {
      assert.equal(corpCode, "00126380");
      assert.equal(maxItems, 5);
      return [{ label: "2025", sortKey: 20254, periodType: "annual", revenue: 100, operatingIncome: 10 }];
    },
    async getRecentReportSeries(corpCode, maxItems) {
      assert.equal(corpCode, "00126380");
      assert.equal(maxItems, 4);
      return [{ label: "2025 FY", sortKey: 20254, periodType: "annual", revenue: 100, operatingIncome: 10 }];
    }
  };

  const provider = createLiveStockProvider({ apiKey: "dummy", dartClient });
  const results = await provider.search("삼성");
  const report = await provider.getReportSource("005930");

  assert.equal(results[0].ticker, "005930");
  assert.equal(report.company.market, "KRX 상장사");
  assert.equal(report.financials.annual.length, 1);
  assert.equal(report.financials.quarterly.length, 1);
  assert.equal(report.valuation.per, null);
});
