
import { Stock, TechnicalIndicators, BandarmologyAnalysis } from '@/types';
import { analyzeBandarmology } from './bandarmology';

export async function getStockData(symbol: string): Promise<Stock | null> {
  try {
    // Indonesian stocks need .JK suffix for Yahoo Finance
    const ticker = symbol.toUpperCase().endsWith('.JK') ? symbol.toUpperCase() : `${symbol.toUpperCase()}.JK`;

    // Fetch 3 months of data for indicators
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3mo`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ${ticker}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      return null;
    }

    const meta = result.meta;
    const quotes = result.indicators.quote[0];

    const prices = quotes.close || [];
    const volumes = quotes.volume || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const opens = quotes.open || [];

    // Filter out nulls
    const cleanPrices: number[] = [];
    const cleanVolumes: number[] = [];
    const cleanHighs: number[] = [];
    const cleanLows: number[] = [];
    const cleanOpens: number[] = [];

    prices.forEach((p: number | null, i: number) => {
        if (p !== null && volumes[i] !== null) {
            cleanPrices.push(p);
            cleanVolumes.push(volumes[i]);
            cleanHighs.push(highs[i] || p);
            cleanLows.push(lows[i] || p);
            cleanOpens.push(opens[i] || p);
        }
    });

    if (cleanPrices.length < 20) return null;

    const currentPrice = meta.regularMarketPrice || cleanPrices[cleanPrices.length - 1];
    const previousClose = meta.previousClose || cleanPrices[cleanPrices.length - 2];
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;

    // --- Technical Analysis ---

    // 1. Moving Averages
    const ma5 = calculateSMA(cleanPrices, 5);
    const ma20 = calculateSMA(cleanPrices, 20);
    const ma60 = calculateSMA(cleanPrices, 60);

    // 2. RSI (14)
    const rsi = calculateRSI(cleanPrices, 14);

    // 3. ATR (Average True Range) for volatility
    const atr = calculateATR(cleanHighs, cleanLows, cleanPrices, 14);

    // 4. Volume Analysis
    const recentVolume = calculateAverage(cleanVolumes.slice(-5));
    const avgVolume20 = calculateAverage(cleanVolumes.slice(-20));
    const volumeChange = avgVolume20 > 0 ? ((recentVolume - avgVolume20) / avgVolume20) * 100 : 0;

    // 5. Trend Determination
    let trend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
    const lastPrice = cleanPrices[cleanPrices.length - 1];

    if (lastPrice > ma20 && ma20 > ma60) trend = 'UP';
    else if (lastPrice < ma20 && ma20 < ma60) trend = 'DOWN';

    // 6. Support & Resistance using swing points
    const { support, resistance } = findSupportResistance(cleanPrices, cleanHighs, cleanLows);

    // 7. Price Position (0-100 scale between support and resistance)
    const priceRange = resistance - support;
    const pricePosition = priceRange > 0 ? ((currentPrice - support) / priceRange) * 100 : 50;

    // 8. Volume Flow (simplified, bandarmology has more detail)
    let volumeFlow: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' = 'NEUTRAL';
    const lastOpen = cleanOpens[cleanOpens.length - 1];
    const isGreenDay = lastPrice > lastOpen;

    if (trend === 'UP' && isGreenDay && volumeChange > 10) {
      volumeFlow = 'ACCUMULATION';
    } else if (trend === 'DOWN' && !isGreenDay && volumeChange > 10) {
      volumeFlow = 'DISTRIBUTION';
    } else if (trend === 'SIDEWAYS' && isGreenDay && volumeChange > 30) {
      volumeFlow = 'ACCUMULATION';
    }

    // 9. Enhanced Bandarmology Analysis
    const bandarmology = analyzeBandarmology({
      prices: cleanPrices,
      volumes: cleanVolumes,
      highs: cleanHighs,
      lows: cleanLows,
      opens: cleanOpens
    });

    return {
      symbol: meta.symbol.replace('.JK', ''),
      name: meta.symbol.replace('.JK', ''),
      currentPrice: currentPrice,
      change: change,
      changePercent: changePercent,
      bandarmology,
      indicators: {
        rsi,
        ma5,
        ma20,
        ma60,
        volumeChange,
        trend,
        volumeFlow,
        support,
        resistance,
        atr,
        pricePosition
      }
    };
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return null;
  }
}

export async function getMultipleStocksData(symbols: string[]) {
  const data = await Promise.all(symbols.map(s => getStockData(s)));
  const validData = data.filter((d): d is Stock => d !== null);
  
  const result: Record<string, Stock> = {};
  validData.forEach(stock => {
    result[stock.symbol] = stock;
  });
  return result;
}

// --- Helpers ---

function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return data[data.length - 1];
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateAverage(data: number[]): number {
  if (data.length === 0) return 0;
  return data.reduce((a, b) => a + b, 0) / data.length;
}

function calculateRSI(data: number[], period: number = 14): number {
  if (data.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = ((avgGain * (period - 1)) + currentGain) / period;
    avgLoss = ((avgLoss * (period - 1)) + currentLoss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);
  }

  // Simple average of last 'period' true ranges
  const recentTRs = trueRanges.slice(-period);
  return recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
}

function findSupportResistance(prices: number[], highs: number[], lows: number[]): { support: number; resistance: number } {
  const len = prices.length;
  if (len < 20) {
    return {
      support: Math.min(...lows),
      resistance: Math.max(...highs)
    };
  }

  // Find swing highs and lows in last 60 days
  const lookback = Math.min(60, len);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);
  const recentPrices = prices.slice(-lookback);

  const swingHighs: number[] = [];
  const swingLows: number[] = [];

  // Find local peaks and troughs (swing points)
  for (let i = 2; i < lookback - 2; i++) {
    // Swing high: higher than 2 bars on each side
    if (recentHighs[i] > recentHighs[i - 1] &&
        recentHighs[i] > recentHighs[i - 2] &&
        recentHighs[i] > recentHighs[i + 1] &&
        recentHighs[i] > recentHighs[i + 2]) {
      swingHighs.push(recentHighs[i]);
    }

    // Swing low: lower than 2 bars on each side
    if (recentLows[i] < recentLows[i - 1] &&
        recentLows[i] < recentLows[i - 2] &&
        recentLows[i] < recentLows[i + 1] &&
        recentLows[i] < recentLows[i + 2]) {
      swingLows.push(recentLows[i]);
    }
  }

  const currentPrice = recentPrices[recentPrices.length - 1];

  // Find nearest resistance above current price
  const resistanceCandidates = swingHighs.filter(h => h > currentPrice);
  const resistance = resistanceCandidates.length > 0
    ? Math.min(...resistanceCandidates)
    : Math.max(...recentHighs);

  // Find nearest support below current price
  const supportCandidates = swingLows.filter(l => l < currentPrice);
  const support = supportCandidates.length > 0
    ? Math.max(...supportCandidates)
    : Math.min(...recentLows);

  return { support, resistance };
}
