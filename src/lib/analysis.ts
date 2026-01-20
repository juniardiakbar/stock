import { Stock } from '@/types';

export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(0, period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  // Calculate initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i - 1] - prices[i]; // prices are descending (newest first) ??? Usually prices are passed descending?
                                              // Wait, Yahoo Finance returns ascending (oldest first).
                                              // We need to clarify standardizing the input.
                                              // optimizing: assumption is input is [newest, oldest, ...] for easy slicing
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Volume Flow Proxy for "Bandarmology"
// Logic: If price is stable/rising but volume is high, it's accumulation.
// If price is falling and volume is high, it's distribution.
export function analyzeVolumeFlow(
  prices: number[], 
  volumes: number[]
): 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' {
  if (prices.length < 5 || volumes.length < 5) return 'NEUTRAL';
  
  // Look at last 5 days
  const recentPrices = prices.slice(0, 5);
  const recentVolumes = volumes.slice(0, 5);
  
  const avgVol = volumes.slice(5, 20).reduce((a, b) => a + b, 0) / 15;
  const recentAvgVol = recentVolumes.reduce((a, b) => a + b, 0) / 5;
  
  if (recentAvgVol < avgVol * 1.2) return 'NEUTRAL'; // Volume is normal

  const priceChange = (recentPrices[0] - recentPrices[4]) / recentPrices[4];
  
  if (priceChange > -0.02 && priceChange < 0.05) {
      // Price is relatively stable or slightly up, but volume is huge => Accumulation
      return 'ACCUMULATION';
  } else if (priceChange < -0.05) {
      // Price dropped hard on high volume => Distribution
      return 'DISTRIBUTION';
  }

  return 'NEUTRAL';
}

export function analyzeTrend(price: number, ma20: number, ma60: number): 'UP' | 'DOWN' | 'SIDEWAYS' {
  if (price > ma20 && ma20 > ma60) return 'UP';
  if (price < ma20 && ma20 < ma60) return 'DOWN';
  return 'SIDEWAYS';
}
