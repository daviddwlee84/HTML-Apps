/**
 * FX Relative Strength Visualizer
 * Handles data fetching, processing, and visualization for multiple assets.
 */

// --- Constants & Config ---
const CONFIG = {
  colors: [
    '#8be9fd', // Cyan
    '#ff79c6', // Pink
    '#50fa7b', // Green
    '#bd93f9', // Purple
    '#ffb86c', // Orange
    '#f1fa8c', // Yellow
  ],
  layout: {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      family: 'Inter, sans-serif',
      color: '#e8edf9'
    },
    xaxis: {
      gridcolor: '#1f2a45',
      zerolinecolor: '#1f2a45',
      showgrid: true,
    },
    yaxis: {
      gridcolor: '#1f2a45',
      zerolinecolor: '#1f2a45',
      showgrid: true,
    },
    margin: { t: 30, r: 20, l: 40, b: 40 },
    showlegend: true,
    legend: {
      orientation: 'h',
      y: 1.1,
      x: 0.5,
      xanchor: 'center'
    }
  }
};

// --- Data Fetching Layer ---

class DataFetcher {
  constructor() {}

  async fetch(source, assets, lookbackDays) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - lookbackDays);

    if (source === 'mock') {
      return this.generateMockData(assets, lookbackDays);
    } else if (source === 'fiat') {
      return this.fetchFiat(assets, startDate, endDate);
    } else if (source === 'crypto') {
      return this.fetchCrypto(assets, startDate, endDate);
    }
    throw new Error(`Unknown source: ${source}`);
  }

  // --- Fiat (Frankfurter) ---
  // Endpoint: https://api.frankfurter.app/{start}..{end}?from=USD&to=EUR,GBP
  // Note: Frankfurter is free and open, but rate limits apply.
  async fetchFiat(assets, startDate, endDate) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    // We fetch everything relative to USD for consistency, then rebase later if needed.
    // Or we can just use the first asset as base if the API supports it. 
    // Frankfurter "from" is the base.
    
    // To compare A, B, C properly, we often want a neutral stable base (like USD or EUR)
    // and then compare their performance against that. 
    // Let's assume the user inputs "EUR, GBP, JPY" and we fetch them all vs USD.
    
    const base = 'USD';
    // If USD is in the list, we need to handle it carefully or just pick another base.
    // Frankfurter requires 'from' to be one of the supported currencies.
    // Let's try to fetch all against USD. If user asks for USD, it returns 1.
    
    const symbols = assets.filter(a => a !== base).join(',');
    const url = `https://api.frankfurter.app/${startStr}..${endStr}?from=${base}&to=${symbols}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);
    
    const data = await res.json();
    // Format: { rates: { "2023-01-01": { "EUR": 0.9, "GBP": 0.8 }, ... } }
    
    return this._processFiatResponse(data, assets, base);
  }

  _processFiatResponse(data, assets, base) {
    // Convert to array of { date, prices: { ASSET: price } }
    // Note: The API returns rates as 1 USD = X Currency.
    // So if we want the "value" of the currency in USD, we take 1/rate.
    // However, for "Strength", usually higher rate = stronger currency is not always true depending on quotation.
    // Standard: EURUSD = 1.1 (1 EUR = 1.1 USD). 
    // Frankfurter gives: from=USD, to=EUR => 0.9 (1 USD = 0.9 EUR).
    // So Price of EUR in USD = 1 / 0.9.
    
    const dates = Object.keys(data.rates).sort();
    const result = dates.map(date => {
      const rates = data.rates[date];
      const prices = {};
      
      assets.forEach(asset => {
        if (asset === base) {
          prices[asset] = 1.0;
        } else if (rates[asset]) {
          // Invert to get price in USD
          prices[asset] = 1 / rates[asset];
        } else {
          prices[asset] = null; // Missing
        }
      });
      
      return { date, prices };
    });
    
    return result;
  }

  // --- Crypto (Binance) ---
  // Endpoint: https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d
  async fetchCrypto(assets, startDate, endDate) {
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();
    
    // For crypto, we usually assume the user inputs "BTC", "ETH" and we append "USDT".
    // Or the user inputs full pairs. Let's assume asset symbols "BTC", "ETH".
    // We will fetch BTCUSDT, ETHUSDT.
    
    const promises = assets.map(async (asset) => {
      // Handle special cases or defaults? Assume USDT pair.
      const symbol = asset.toUpperCase().endsWith('USDT') ? asset : `${asset}USDT`;
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${startTime}&endTime=${endTime}&limit=1000`;
      
      try {
        const res = await fetch(url);
        if (!res.ok) return { asset, data: [] }; // Fail silently?
        const klines = await res.json();
        return { asset, data: klines };
      } catch (e) {
        console.error(e);
        return { asset, data: [] };
      }
    });

    const results = await Promise.all(promises);
    return this._processCryptoResponse(results, assets);
  }

  _processCryptoResponse(results, requestedAssets) {
    // Align data by time. Binance returns [time, open, high, low, close, ...]
    // We need to merge them into a single timeline.
    
    const map = new Map(); // timestamp -> { prices }
    
    results.forEach(({ asset, data }) => {
      // asset is the full symbol used (e.g. BTC)
      // data is klines
      data.forEach(kline => {
        const t = kline[0];
        const close = parseFloat(kline[4]);
        
        // Normalize date to midnight/day string to group easily? 
        // Or keep millis. Crypto is 24/7.
        // Let's use date string YYYY-MM-DD for simpler daily comparison with Fiat style
        const d = new Date(t);
        const dateStr = d.toISOString().split('T')[0];
        
        if (!map.has(dateStr)) {
          map.set(dateStr, { date: dateStr, prices: {} });
        }
        map.get(dateStr).prices[asset] = close;
      });
    });

    // Sort by date
    const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
  }

  generateMockData(assets, lookbackDays) {
    const data = [];
    const now = new Date();
    // Random walk
    const prices = {};
    assets.forEach(a => prices[a] = 100);

    for (let i = lookbackDays; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayPrices = {};
      assets.forEach(a => {
        const change = (Math.random() - 0.5) * 0.04; // +/- 2%
        prices[a] = prices[a] * (1 + change);
        dayPrices[a] = prices[a];
      });
      
      data.push({ date: dateStr, prices: { ...dayPrices } });
    }
    return Promise.resolve(data);
  }
}

// --- Data Processing Layer ---

class DataProcessor {
  constructor() {}

  // Process raw data into a rich format for plotting
  // Input: [ { date: "2023-01-01", prices: { A: 10, B: 20 } }, ... ]
  process(rawData, assets) {
    if (!rawData || rawData.length === 0) return null;

    // Filter out rows where any asset is missing? Or forward fill?
    // Let's do a simple forward fill first.
    const cleanData = this._forwardFill(rawData, assets);
    
    // Calculate stats
    const dates = cleanData.map(d => d.date);
    
    // 1. Normalized / Rebased (Start = 100)
    // 2. Cumulative Return (Start = 0%)
    const rebased = {}; 
    const cumRet = {}; 
    
    assets.forEach(a => {
      const startPrice = cleanData[0].prices[a];
      rebased[a] = cleanData.map(row => (row.prices[a] / startPrice) * 100);
      cumRet[a] = cleanData.map(row => (row.prices[a] / startPrice) - 1);
    });

    // 3. Relative Strength vs Asset 0 (Base)
    const baseAsset = assets[0];
    const relative = {};
    assets.forEach(a => {
      // Difference in cumulative returns
      relative[a] = cumRet[a].map((val, i) => val - cumRet[baseAsset][i]);
    });

    // 4. Monthly Returns (Heatmap)
    // Group by Month
    const monthlyReturns = this._calculateMonthlyReturns(cleanData, assets);

    // 5. Rolling Z-Score (20d)
    const zScores = this._calculateRollingZScore(cleanData, assets, 20);

    // 6. Ranks (Bump Chart)
    const ranks = cleanData.map((row, i) => {
      // Rank based on rebased value (performance since start)
      // Or rank based on current price? Usually performance since start.
      const currentPerf = assets.map(a => ({ asset: a, val: rebased[a][i] }));
      currentPerf.sort((x, y) => y.val - x.val); // Descending
      const rankMap = {};
      currentPerf.forEach((item, idx) => rankMap[item.asset] = idx + 1);
      return rankMap;
    });

    return {
      dates,
      prices: cleanData, // aligned
      rebased,
      cumRet,
      relative,
      monthlyReturns,
      zScores,
      ranks,
      baseAsset
    };
  }

  _forwardFill(data, assets) {
    // Basic fill
    const filled = [];
    let lastKnown = {};
    
    data.forEach(row => {
      const newPrices = { ...row.prices };
      assets.forEach(a => {
        if (newPrices[a] !== undefined && newPrices[a] !== null) {
          lastKnown[a] = newPrices[a];
        } else {
          newPrices[a] = lastKnown[a];
        }
      });
      
      // Only include if we have all assets started?
      // Or just push what we have.
      filled.push({ date: row.date, prices: newPrices });
    });
    
    // Trim start if some assets are NaN
    return filled.filter(row => assets.every(a => row.prices[a] !== undefined));
  }

  _calculateMonthlyReturns(data, assets) {
    // Return format: { x: [Months], y: [Assets], z: [[...returns...]] }
    // Group by YYYY-MM
    const monthMap = new Map();
    
    data.forEach(row => {
      const monthKey = row.date.substring(0, 7); // "2023-01"
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { start: row, end: row });
      } else {
        monthMap.get(monthKey).end = row;
      }
    });

    const months = Array.from(monthMap.keys());
    const zData = []; // Rows = Assets
    
    assets.forEach(asset => {
      const assetRow = [];
      months.forEach(m => {
        const { start, end } = monthMap.get(m);
        const pStart = start.prices[asset];
        const pEnd = end.prices[asset];
        const ret = (pEnd - pStart) / pStart;
        assetRow.push(ret * 100); // %
      });
      zData.push(assetRow);
    });

    return {
      x: months,
      y: assets,
      z: zData
    };
  }

  _calculateRollingZScore(data, assets, window) {
    // Simple SMA/StdDev
    const result = {};
    assets.forEach(asset => {
      const series = data.map(d => d.prices[asset]);
      // Calculate returns or price Z-score? 
      // Plan said: Rolling Return Z-Score. 
      // "z_t = (r_t - mu_t) / sigma_t" where r_t is 20-day cumulative log return?
      // Let's stick to "Price Z-score relative to 20d MA" or "Return Z-score".
      // Let's implement Price Deviation from 20d MA (Bollinger Band %B-like) or simple Z.
      // Or: 20-day return z-score.
      
      // Let's do: 20-day Return Z-Score.
      // r_20 = ln(P_t) - ln(P_{t-20})
      const logPrices = series.map(p => Math.log(p));
      const zValues = [];
      
      for(let i=0; i < logPrices.length; i++) {
        if (i < window * 2) { // Need enough history for stats of returns
           zValues.push(null);
           continue;
        }
        
        // 20-day return at time t
        const r_t = logPrices[i] - logPrices[i-window];
        
        // We need a history of these 20-day returns to calculate mu and sigma.
        // Let's just use a simpler metric: "Distance from 20d MA / 20d StdDev" (Price Z-Score)
        // This is easier to interpret for "Overextended".
        
        const slice = series.slice(i - window, i);
        const mean = slice.reduce((a,b) => a+b, 0) / window;
        const variance = slice.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / window;
        const std = Math.sqrt(variance);
        
        const z = (series[i] - mean) / (std || 1);
        zValues.push(z);
      }
      result[asset] = zValues;
    });
    return result;
  }
}

// --- Chart Rendering Layer ---

class ChartRenderer {
  constructor() {}

  renderRebased(divId, processedData) {
    const { dates, rebased } = processedData;
    const assets = Object.keys(rebased);
    
    const traces = assets.map((asset, i) => ({
      x: dates,
      y: rebased[asset],
      name: asset,
      mode: 'lines',
      line: { color: CONFIG.colors[i % CONFIG.colors.length], width: 2 }
    }));

    const layout = {
      ...CONFIG.layout,
      title: 'Rebased Performance (Start = 100)',
      yaxis: { ...CONFIG.layout.yaxis, title: 'Index' }
    };

    Plotly.newPlot(divId, traces, layout, {responsive: true});
  }

  renderRelative(divId, processedData) {
    const { dates, relative, baseAsset } = processedData;
    const assets = Object.keys(relative).filter(a => a !== baseAsset);
    
    const traces = assets.map((asset, i) => ({
      x: dates,
      y: relative[asset].map(v => v * 100), // %
      name: `${asset} vs ${baseAsset}`,
      mode: 'lines',
      line: { color: CONFIG.colors[(i + 1) % CONFIG.colors.length], width: 2 } // Offset color
    }));
    
    // Add zero line
    traces.unshift({
        x: [dates[0], dates[dates.length-1]],
        y: [0, 0],
        mode: 'lines',
        name: baseAsset,
        line: { color: '#ffffff', width: 1, dash: 'dash' },
        hoverinfo: 'none'
    });

    const layout = {
      ...CONFIG.layout,
      title: `Relative Strength vs ${baseAsset}`,
      yaxis: { ...CONFIG.layout.yaxis, title: 'Relative Perf (%)' }
    };

    Plotly.newPlot(divId, traces, layout, {responsive: true});
  }

  renderHeatmap(divId, processedData) {
    const { x, y, z } = processedData.monthlyReturns;
    
    const trace = {
      z: z,
      x: x,
      y: y,
      type: 'heatmap',
      colorscale: 'RdBu', // Red to Blue (Red=Negative, Blue=Positive) usually? Or Red=Hot?
      // Financial: Red=Down, Green/Blue=Up.
      // Let's use a custom scale or RdBu (Red=Low, Blue=High)
      colorscale: [
        [0, '#f87171'],   // Red
        [0.5, '#11172d'], // Dark (Zero)
        [1, '#34d399']    // Green
      ],
      zmid: 0,
      showscale: true
    };

    const layout = {
      ...CONFIG.layout,
      title: 'Monthly Returns (%)',
      margin: { t: 30, r: 20, l: 80, b: 40 }, // More left margin for labels
      xaxis: { ...CONFIG.layout.xaxis, type: 'category' }
    };

    Plotly.newPlot(divId, [trace], layout, {responsive: true});
  }

  renderBump(divId, processedData) {
    const { dates, ranks } = processedData;
    const assets = Object.keys(ranks[0]);
    
    // Ranks is [{ A:1, B:2 }, ...]
    const traces = assets.map((asset, i) => ({
      x: dates,
      y: ranks.map(r => r[asset]),
      name: asset,
      mode: 'lines+markers',
      line: { color: CONFIG.colors[i % CONFIG.colors.length], width: 3, shape: 'spline' },
      marker: { size: 6 }
    }));

    const layout = {
      ...CONFIG.layout,
      title: 'Rank Evolution',
      yaxis: { 
        ...CONFIG.layout.yaxis, 
        autorange: 'reversed', // Rank 1 at top
        tickmode: 'linear',
        tick0: 1,
        dtick: 1
      }
    };

    Plotly.newPlot(divId, traces, layout, {responsive: true});
  }

  renderZScore(divId, processedData) {
    const { dates, zScores } = processedData;
    const assets = Object.keys(zScores);
    
    const traces = assets.map((asset, i) => ({
      x: dates,
      y: zScores[asset],
      name: asset,
      mode: 'lines',
      line: { color: CONFIG.colors[i % CONFIG.colors.length], width: 1.5 }
    }));

    // Add bands
    const bandStyle = { color: 'rgba(255,255,255,0.2)', width: 1, dash: 'dot' };
    traces.push({ x: dates, y: dates.map(()=>2), mode:'lines', name:'+2 Sigma', line: bandStyle, showlegend:false });
    traces.push({ x: dates, y: dates.map(()=>-2), mode:'lines', name:'-2 Sigma', line: bandStyle, showlegend:false });

    const layout = {
      ...CONFIG.layout,
      title: 'Price Z-Score (vs 20d MA)',
      yaxis: { ...CONFIG.layout.yaxis, title: 'Sigma' }
    };

    Plotly.newPlot(divId, traces, layout, {responsive: true});
  }
  
  renderTernary(divId, processedData) {
    // Ternary only works for exactly 3 assets
    // We calculate "Strength Share" based on Rebased Index?
    // Or based on recent momentum?
    // Let's use Rebased Index for "Dominance" since start.
    
    const { dates, rebased } = processedData;
    const assets = Object.keys(rebased);
    if (assets.length < 3) return; // Need at least 3
    
    const A = assets[0];
    const B = assets[1];
    const C = assets[2];
    
    // We plot the path over time
    const aVals = rebased[A];
    const bVals = rebased[B];
    const cVals = rebased[C];
    
    // Normalize to sum to 1 at each step for ternary coords
    const aNorm = [];
    const bNorm = [];
    const cNorm = [];
    
    for(let i=0; i<dates.length; i++) {
        const sum = aVals[i] + bVals[i] + cVals[i];
        aNorm.push(aVals[i]/sum);
        bNorm.push(bVals[i]/sum);
        cNorm.push(cVals[i]/sum);
    }
    
    const trace = {
        type: 'scatterternary',
        mode: 'lines',
        a: aNorm,
        b: bNorm,
        c: cNorm,
        text: dates,
        line: { color: '#8be9fd', width: 2 },
        name: 'Evolution'
    };
    
    // Add end point marker
    const lastIdx = dates.length - 1;
    const endPoint = {
        type: 'scatterternary',
        mode: 'markers',
        a: [aNorm[lastIdx]],
        b: [bNorm[lastIdx]],
        c: [cNorm[lastIdx]],
        marker: { symbol: 'circle', color: '#ff79c6', size: 10 },
        name: 'Current'
    };

    const layout = {
      ...CONFIG.layout,
      title: 'Relative Dominance Path',
      ternary: {
        sum: 1,
        aaxis: { title: A, color: '#e8edf9' },
        baxis: { title: B, color: '#e8edf9' },
        caxis: { title: C, color: '#e8edf9' },
        bgcolor: 'rgba(0,0,0,0)'
      }
    };
    
    Plotly.newPlot(divId, [trace, endPoint], layout, {responsive: true});
  }
}

// --- App Controller ---

const app = {
  fetcher: new DataFetcher(),
  processor: new DataProcessor(),
  renderer: new ChartRenderer(),
  
  elements: {
    source: document.getElementById('source-select'),
    assets: document.getElementById('assets-input'),
    lookback: document.getElementById('lookback-select'),
    btnFetch: document.getElementById('btn-fetch'),
    btnMock: document.getElementById('btnMock'),
    statusBar: document.getElementById('status-bar'),
    baseName: document.getElementById('base-asset-name')
  },

  init() {
    this.elements.btnFetch.addEventListener('click', () => this.run());
    if (this.elements.btnMock) {
        this.elements.btnMock.addEventListener('click', () => {
            this.elements.source.value = 'mock';
            this.run();
        });
    }
    
    // Initial run
    // this.run();
  },

  setStatus(msg, type='normal') {
    const el = this.elements.statusBar;
    el.textContent = msg;
    el.className = 'status-bar'; // reset
    if (type === 'loading') el.classList.add('loading');
    if (type === 'error') el.classList.add('error');
  },

  async run() {
    try {
      this.setStatus('Fetching data...', 'loading');
      
      const source = this.elements.source.value;
      const assetsStr = this.elements.assets.value;
      const assets = assetsStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const lookback = this.elements.lookback.value === 'ytd' ? 
          (new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24) : 
          parseInt(this.elements.lookback.value);

      if (assets.length < 2) {
        throw new Error("Please provide at least 2 assets.");
      }

      const rawData = await this.fetcher.fetch(source, assets, lookback);
      if (!rawData || rawData.length === 0) throw new Error("No data returned.");

      this.setStatus('Processing...', 'loading');
      const processed = this.processor.process(rawData, assets);
      
      this.elements.baseName.textContent = processed.baseAsset;
      
      this.setStatus('Rendering...');
      this.renderer.renderRebased('chart-rebased', processed);
      this.renderer.renderRelative('chart-relative', processed);
      this.renderer.renderHeatmap('chart-heatmap', processed);
      this.renderer.renderBump('chart-bump', processed);
      this.renderer.renderZScore('chart-zscore', processed);
      this.renderer.renderTernary('chart-ternary', processed);
      
      this.setStatus(`Updated: ${new Date().toLocaleTimeString()}`, 'success');
      
    } catch (err) {
      console.error(err);
      this.setStatus(`Error: ${err.message}`, 'error');
    }
  }
};

// Start
app.init();
