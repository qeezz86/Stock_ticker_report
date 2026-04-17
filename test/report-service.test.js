import test from "node:test";
import assert from "node:assert/strict";
import { createReportService } from "../lib/report-service.js";

test("search returns results by name and ticker", async () => {
  const service = createReportService();
  const byName = await service.search("삼성");
  const byTicker = await service.search("005930");

  assert.ok(byName.some((item) => item.ticker === "005930"));
  assert.ok(byTicker.some((item) => item.name === "삼성전자"));
});

test("report response exposes normalized sections", async () => {
  const service = createReportService();
  const report = await service.getReport("005930");

  assert.equal(report.company.ticker, "005930");
  assert.equal(report.financials.annual.length, 5);
  assert.equal(report.financials.quarterly.length, 4);
  assert.equal(report.priceChart.length, 12);
  assert.equal(report.volumeChart.length, 12);
  assert.equal(report.flows.length > 0, true);
  assert.equal(typeof report.reportSummary.conclusion, "string");
});

test("missing valuation fields are preserved as null and summarized gracefully", async () => {
  const service = createReportService();
  const report = await service.getReport("035420");

  assert.equal(report.valuation.per, null);
  assert.match(report.reportSummary.valuation, /PER 데이터는 현재 제공되지 않습니다/);
});

test("report responses are cached within ttl", async () => {
  let currentTime = 1000;
  let providerCalls = 0;
  const provider = {
    async search() {
      return [];
    },
    async getReportSource() {
      providerCalls += 1;
      return {
        company: { ticker: "X", name: "테스트", market: "KOSPI", industryName: "테스트", marketCap: 1, price: 1, changePercent: 0 },
        financials: { annual: [], quarterly: [] },
        valuation: { per: null, pbr: null, eps: null, bps: null },
        industry: { title: "테스트", growthScore: "중", description: "테스트", drivers: [], risks: [] },
        priceHistory: [],
        flows: []
      };
    }
  };
  const service = createReportService({
    provider,
    now: () => currentTime
  });

  await service.getReport("X");
  currentTime += 1000;
  await service.getReport("X");

  assert.equal(providerCalls, 1);
});

test("unknown ticker returns null", async () => {
  const service = createReportService();
  const report = await service.getReport("999999");
  assert.equal(report, null);
});
