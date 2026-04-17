const searchInput = document.querySelector("#ticker-search");
const searchResults = document.querySelector("#search-results");
const reportRoot = document.querySelector("#report-root");

let searchTimer = null;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = searchInput.value.trim();
  if (!query) {
    searchResults.innerHTML = "";
    return;
  }

  searchTimer = setTimeout(() => runSearch(query), 180);
});

runSearch("삼성");

async function runSearch(query) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  renderSearchResults(data.results ?? []);
}

function renderSearchResults(results) {
  if (!results.length) {
    searchResults.innerHTML = `<div class="note">검색 결과가 없습니다.</div>`;
    return;
  }

  searchResults.innerHTML = results
    .map(
      (item) => `
        <button class="search-item" data-ticker="${item.ticker}">
          <strong>${item.name}</strong> (${item.ticker})
          <div class="note">${item.market ?? "상장사"} · ${item.industryName ?? "업종 정보 없음"} · ${formatMoneyOrNone(item.price)}</div>
        </button>
      `
    )
    .join("");

  for (const button of searchResults.querySelectorAll(".search-item")) {
    button.addEventListener("click", () => loadReport(button.dataset.ticker));
  }
}

async function loadReport(ticker) {
  const response = await fetch(`/api/report/${ticker}`);
  if (!response.ok) {
    reportRoot.innerHTML = `
      <section class="empty-state">
        <h2>보고서를 불러오지 못했습니다.</h2>
        <p>종목 코드가 올바른지 확인해 주세요.</p>
      </section>
    `;
    return;
  }

  const report = await response.json();
  renderReport(report);
}

function renderReport(report) {
  reportRoot.innerHTML = `
    <section class="report-grid">
      <article class="card span-12">
        <div class="headline">
          <div>
            <p class="eyebrow">Report</p>
            <h2>${report.company.name} <span class="muted">(${report.company.ticker})</span></h2>
            <div class="ticker-meta">
              ${report.company.market ? `<span class="pill">${report.company.market}</span>` : ""}
              ${report.company.industryName ? `<span class="pill">${report.company.industryName}</span>` : ""}
              ${report.company.changePercent == null ? "" : `<span class="pill ${report.company.changePercent >= 0 ? "up" : "down"}">${formatSigned(report.company.changePercent)}%</span>`}
            </div>
          </div>
          <div class="kpi">
            <div class="kpi-label">시가총액</div>
            <div class="kpi-value">${formatMarketCapOrNone(report.company.marketCap)}</div>
            <div class="note">현재가 ${formatMoneyOrNone(report.company.price)}</div>
          </div>
        </div>
        <div class="summary-list">
          <div class="summary-item"><strong>개요</strong><p>${report.reportSummary.overview}</p></div>
          <div class="summary-item"><strong>종합 코멘트</strong><p>${report.reportSummary.conclusion}</p></div>
        </div>
      </article>

      <article class="card span-8">
        <h3>매출 + 영업이익 추이</h3>
        <p class="muted">연간 5개년과 최근 분기 흐름을 함께 표시합니다.</p>
        <div class="chart-wrap">
          <div class="chart">${renderDualChart(report.financials.annual, "revenue", "operatingIncome")}</div>
          <div class="legend"><span class="revenue">매출</span><span class="income">영업이익</span></div>
        </div>
        <div class="summary-item"><p>${report.reportSummary.financials}</p></div>
      </article>

      <article class="card span-4">
        <h3>PER / PBR</h3>
        <div class="kpi-grid">
          ${renderMetricCard("PER", report.valuation.per, "배")}
          ${renderMetricCard("PBR", report.valuation.pbr, "배")}
          ${renderMetricCard("EPS", report.valuation.eps, "원")}
          ${renderMetricCard("BPS", report.valuation.bps, "원")}
        </div>
        <div class="summary-item"><p>${report.reportSummary.valuation}</p></div>
      </article>

      <article class="card span-6">
        <h3>산업 성장성</h3>
        <p class="muted">${report.industry.title} · 성장성 ${report.industry.growthScore}</p>
        <p>${report.reportSummary.industry}</p>
        <div class="industry-list">
          <div>
            <strong>성장 동력</strong>
            <ul>${report.industry.drivers.map((driver) => `<li>${driver}</li>`).join("")}</ul>
          </div>
          <div>
            <strong>리스크</strong>
            <ul>${report.industry.risks.map((risk) => `<li>${risk}</li>`).join("")}</ul>
          </div>
        </div>
      </article>

      <article class="card span-6">
        <h3>차트 + 거래량</h3>
        <p class="muted">최근 1년 기준 종가와 거래량 추이입니다.</p>
        <div class="chart-wrap">
          <div class="chart">${renderPriceVolumeChart(report.priceChart, report.volumeChart)}</div>
          <div class="legend"><span class="price">종가</span><span class="volume">거래량</span></div>
        </div>
      </article>

      <article class="card span-12">
        <h3>외국인 / 기관 수급</h3>
        <p class="muted">누적이 아닌 구간별 순매수 흐름입니다.</p>
        <div class="chart-wrap">
          <div class="chart">${renderFlowChart(report.flows)}</div>
          <div class="legend"><span class="foreign">외국인</span><span class="institution">기관</span></div>
        </div>
        <div class="summary-item"><p>${report.reportSummary.flows}</p></div>
      </article>
    </section>
  `;
}

function renderMetricCard(label, value, suffix) {
  return `
    <div class="kpi">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value == null ? "데이터 없음" : `${formatCurrency(value)}${suffix}`}</div>
    </div>
  `;
}

function renderDualChart(points, leftKey, rightKey) {
  if (!points.length) {
    return `<div class="note">데이터 없음</div>`;
  }

  const revenuePoints = buildLinePoints(points.map((point) => point[leftKey]));
  const incomePoints = buildLinePoints(points.map((point) => point[rightKey]));
  const labels = points.map((point) => point.label);

  return chartFrame({
    labels,
    lineSeries: [
      { color: "#0d7a64", points: revenuePoints },
      { color: "#b95528", points: incomePoints }
    ]
  });
}

function renderPriceVolumeChart(pricePoints, volumePoints) {
  if (!pricePoints.length) {
    return `<div class="note">데이터 없음</div>`;
  }

  const bars = buildBars(volumePoints.map((point) => point.volume));
  const line = buildLinePoints(pricePoints.map((point) => point.close));
  const labels = pricePoints.map((point) => point.date.slice(5));

  return chartFrame({
    labels,
    lineSeries: [{ color: "#1e5161", points: line }],
    barSeries: { color: "#d7a33f", bars }
  });
}

function renderFlowChart(flowPoints) {
  if (!flowPoints.length) {
    return `<div class="note">데이터 없음</div>`;
  }

  const foreign = buildLinePoints(flowPoints.map((point) => point.foreignNetBuy));
  const institution = buildLinePoints(flowPoints.map((point) => point.institutionNetBuy));
  const labels = flowPoints.map((point) => point.date.slice(5));

  return chartFrame({
    labels,
    lineSeries: [
      { color: "#0d7a64", points: foreign },
      { color: "#b95528", points: institution }
    ],
    centerLine: true
  });
}

function chartFrame({ labels, lineSeries = [], barSeries = null, centerLine = false }) {
  const width = 640;
  const height = 240;
  const labelY = 228;
  const grid = [30, 80, 130, 180].map(
    (y) => `<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="rgba(29,42,45,0.08)" />`
  );
  const axisLabels = labels
    .map((label, index) => {
      const x = (index / Math.max(labels.length - 1, 1)) * width;
      return `<text x="${x}" y="${labelY}" font-size="10" fill="#5e6a6c" text-anchor="middle">${label}</text>`;
    })
    .join("");
  const lines = lineSeries
    .map(
      (series) =>
        `<polyline fill="none" stroke="${series.color}" stroke-width="3" points="${series.points
          .map((point) => `${point.x},${point.y}`)
          .join(" ")}" />`
    )
    .join("");
  const bars = barSeries
    ? barSeries.bars
        .map(
          (bar) =>
            `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" fill="${barSeries.color}" opacity="0.5" rx="5" />`
        )
        .join("")
    : "";
  const center = centerLine
    ? `<line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}" stroke="rgba(29,42,45,0.15)" stroke-dasharray="6 6" />`
    : "";

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="chart">
      ${grid.join("")}
      ${center}
      ${bars}
      ${lines}
      ${axisLabels}
    </svg>
  `;
}

function buildLinePoints(values) {
  const width = 640;
  const height = 200;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = max === min ? height / 2 : height - ((value - min) / (max - min)) * 150 - 20;
    return { x, y };
  });
}

function buildBars(values) {
  const width = 640;
  const height = 200;
  const max = Math.max(...values);
  const barWidth = Math.max(16, width / (values.length * 1.8));
  return values.map((value, index) => {
    const x = index * (width / values.length) + 8;
    const scaledHeight = max === 0 ? 0 : (value / max) * 120;
    return {
      x,
      y: height - scaledHeight,
      width: barWidth,
      height: scaledHeight
    };
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function formatMoneyOrNone(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "데이터 없음";
  }
  return `${formatCurrency(value)}원`;
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatMarketCap(value) {
  const trillion = value / 1000000000000;
  return `${trillion.toFixed(1)}조원`;
}

function formatMarketCapOrNone(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "데이터 없음";
  }
  return formatMarketCap(value);
}
