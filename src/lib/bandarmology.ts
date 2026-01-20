/**
 * Enhanced Bandarmology Analysis for Indonesian Market
 *
 * Bandarmology = Tracking "smart money" / institutional flow
 * Key patterns:
 * - ABSORPTION: High volume, price stable = bandar collecting quietly
 * - MARKUP: Price rises on high volume = bandar pushing price up
 * - DISTRIBUTION_CEILING: Price fails at resistance on volume = bandar selling
 * - SHAKEOUT: Sharp drop + quick recovery = bandar scaring retail
 * - BREAKOUT: Volume surge + price breaks key level
 */

import { BandarmologyAnalysis, BandarmologySignal } from '@/types';

interface PriceVolumeData {
  prices: number[];      // [oldest...newest]
  volumes: number[];     // [oldest...newest]
  highs: number[];
  lows: number[];
  opens: number[];
}

export function analyzeBandarmology(data: PriceVolumeData): BandarmologyAnalysis {
  const signals: BandarmologySignal[] = [];
  let totalScore = 50; // Start neutral

  if (data.prices.length < 20) {
    return createNeutralResult();
  }

  const len = data.prices.length;
  const currentPrice = data.prices[len - 1];
  const currentVolume = data.volumes[len - 1];

  // Calculate averages
  const avgVolume20 = average(data.volumes.slice(-20));
  const avgVolume5 = average(data.volumes.slice(-5));
  const avgPrice5 = average(data.prices.slice(-5));
  const avgPrice20 = average(data.prices.slice(-20));

  // Price changes
  const priceChange1d = (currentPrice - data.prices[len - 2]) / data.prices[len - 2] * 100;
  const priceChange5d = (currentPrice - data.prices[len - 6]) / data.prices[len - 6] * 100;
  const priceChange20d = len >= 21 ? (currentPrice - data.prices[len - 21]) / data.prices[len - 21] * 100 : 0;

  // Volume metrics
  const volumeRatio = currentVolume / avgVolume20;
  const volumeRatio5d = avgVolume5 / avgVolume20;

  // ============================================
  // SIGNAL 1: Volume-Price Divergence Analysis
  // ============================================

  // BULLISH: Price down but volume high = potential absorption
  if (priceChange5d < -2 && priceChange5d > -8 && volumeRatio5d > 1.5) {
    signals.push({
      type: 'BULLISH',
      name: 'Absorption Pattern',
      description: `Price dropped ${priceChange5d.toFixed(1)}% but volume ${(volumeRatio5d * 100 - 100).toFixed(0)}% above average. Bandar mungkin sedang akumulasi.`,
      weight: 15
    });
    totalScore += 15;
  }

  // BULLISH: Price stable, volume surging = quiet accumulation
  if (Math.abs(priceChange5d) < 3 && volumeRatio5d > 2) {
    signals.push({
      type: 'BULLISH',
      name: 'Silent Accumulation',
      description: `Price stable but volume 2x+ average. Smart money collecting quietly.`,
      weight: 12
    });
    totalScore += 12;
  }

  // BEARISH: Price up but volume dying = weak rally
  if (priceChange5d > 3 && volumeRatio5d < 0.7) {
    signals.push({
      type: 'BEARISH',
      name: 'Weak Rally',
      description: `Price up ${priceChange5d.toFixed(1)}% but volume below average. Rally tidak didukung volume.`,
      weight: -10
    });
    totalScore -= 10;
  }

  // ============================================
  // SIGNAL 2: Distribution Detection
  // ============================================

  // Check for distribution ceiling pattern
  const recentHighs = data.highs.slice(-10);
  const maxRecent = Math.max(...recentHighs);
  const hitsAtResistance = recentHighs.filter(h => h >= maxRecent * 0.98).length;

  if (hitsAtResistance >= 3 && volumeRatio5d > 1.3) {
    signals.push({
      type: 'BEARISH',
      name: 'Distribution Ceiling',
      description: `Price tested resistance ${hitsAtResistance}x with high volume. Bandar mungkin distribusi.`,
      weight: -18
    });
    totalScore -= 18;
  }

  // ============================================
  // SIGNAL 3: Shakeout Detection
  // ============================================

  // Sharp drop followed by recovery within 3 days
  for (let i = len - 3; i < len - 1; i++) {
    if (i < 1) continue;
    const dayDrop = (data.prices[i] - data.prices[i - 1]) / data.prices[i - 1] * 100;
    const recovery = (currentPrice - data.prices[i]) / data.prices[i] * 100;

    if (dayDrop < -4 && recovery > 3 && data.volumes[i] > avgVolume20 * 2) {
      signals.push({
        type: 'BULLISH',
        name: 'Shakeout Recovery',
        description: `Sharp ${dayDrop.toFixed(1)}% drop on huge volume, recovered ${recovery.toFixed(1)}%. Classic bandar shakeout.`,
        weight: 20
      });
      totalScore += 20;
      break;
    }
  }

  // ============================================
  // SIGNAL 4: Trend Strength with Volume
  // ============================================

  // Strong uptrend confirmed by volume
  if (priceChange20d > 10 && currentPrice > avgPrice20 && volumeRatio5d > 1.2) {
    signals.push({
      type: 'BULLISH',
      name: 'Volume-Confirmed Uptrend',
      description: `+${priceChange20d.toFixed(1)}% in 20 days with strong volume. Trend healthy.`,
      weight: 10
    });
    totalScore += 10;
  }

  // Downtrend with increasing volume = distribution
  if (priceChange20d < -10 && volumeRatio5d > 1.5) {
    signals.push({
      type: 'BEARISH',
      name: 'Distribution Downtrend',
      description: `${priceChange20d.toFixed(1)}% drop with high volume. Active selling pressure.`,
      weight: -15
    });
    totalScore -= 15;
  }

  // ============================================
  // SIGNAL 5: Breakout Analysis
  // ============================================

  const resistance20 = Math.max(...data.highs.slice(-20, -1));
  const support20 = Math.min(...data.lows.slice(-20, -1));

  // Breakout above resistance
  if (currentPrice > resistance20 && volumeRatio > 2) {
    signals.push({
      type: 'BULLISH',
      name: 'Volume Breakout',
      description: `Broke above Rp${resistance20.toLocaleString()} on ${volumeRatio.toFixed(1)}x volume!`,
      weight: 18
    });
    totalScore += 18;
  }

  // Breakdown below support
  if (currentPrice < support20 && volumeRatio > 1.5) {
    signals.push({
      type: 'BEARISH',
      name: 'Volume Breakdown',
      description: `Broke below support Rp${support20.toLocaleString()} on high volume.`,
      weight: -20
    });
    totalScore -= 20;
  }

  // ============================================
  // SIGNAL 6: Consecutive Days Analysis
  // ============================================

  let consecutiveUp = 0;
  let consecutiveDown = 0;
  let consecutiveHighVol = 0;

  for (let i = len - 1; i >= Math.max(0, len - 5); i--) {
    const isUp = data.prices[i] > data.opens[i];
    const isHighVol = data.volumes[i] > avgVolume20 * 1.2;

    if (isUp) consecutiveUp++;
    else break;
  }

  for (let i = len - 1; i >= Math.max(0, len - 5); i--) {
    const isDown = data.prices[i] < data.opens[i];
    if (isDown) consecutiveDown++;
    else break;
  }

  for (let i = len - 1; i >= Math.max(0, len - 5); i--) {
    if (data.volumes[i] > avgVolume20 * 1.3) consecutiveHighVol++;
    else break;
  }

  if (consecutiveUp >= 3 && consecutiveHighVol >= 2) {
    signals.push({
      type: 'BULLISH',
      name: 'Momentum Building',
      description: `${consecutiveUp} hari hijau berturut-turut dengan volume tinggi.`,
      weight: 8
    });
    totalScore += 8;
  }

  if (consecutiveDown >= 3 && consecutiveHighVol >= 2) {
    signals.push({
      type: 'BEARISH',
      name: 'Selling Momentum',
      description: `${consecutiveDown} hari merah berturut-turut dengan volume tinggi.`,
      weight: -12
    });
    totalScore -= 12;
  }

  // ============================================
  // SIGNAL 7: Warning Signals
  // ============================================

  // RSI-like overbought condition with volume
  const priceVsLow = (currentPrice - support20) / (resistance20 - support20) * 100;
  if (priceVsLow > 90 && volumeRatio5d < 1) {
    signals.push({
      type: 'WARNING',
      name: 'Overbought + Volume Dry',
      description: `Price near top of range but volume drying up. Potensi reversal.`,
      weight: -8
    });
    totalScore -= 8;
  }

  // Volume spike without price movement = potential top/bottom
  if (volumeRatio > 3 && Math.abs(priceChange1d) < 1) {
    signals.push({
      type: 'WARNING',
      name: 'Volume Anomaly',
      description: `3x+ volume spike without price movement. Watch for direction.`,
      weight: 0
    });
  }

  // ============================================
  // Determine Pattern
  // ============================================

  let pattern: BandarmologyAnalysis['pattern'] = null;
  let daysSincePatternStart = 0;

  // Check for specific patterns
  if (signals.some(s => s.name === 'Absorption Pattern' || s.name === 'Silent Accumulation')) {
    pattern = 'ABSORPTION';
    daysSincePatternStart = countPatternDays(data, 'absorption');
  } else if (signals.some(s => s.name === 'Distribution Ceiling')) {
    pattern = 'DISTRIBUTION_CEILING';
    daysSincePatternStart = countPatternDays(data, 'distribution');
  } else if (signals.some(s => s.name === 'Shakeout Recovery')) {
    pattern = 'SHAKEOUT';
    daysSincePatternStart = 2;
  } else if (signals.some(s => s.name === 'Volume Breakout')) {
    pattern = 'BREAKOUT';
    daysSincePatternStart = 1;
  } else if (signals.some(s => s.name === 'Volume-Confirmed Uptrend')) {
    pattern = 'MARKUP';
    daysSincePatternStart = countPatternDays(data, 'markup');
  }

  // ============================================
  // Determine Status and Warning Level
  // ============================================

  // Clamp score
  totalScore = Math.max(0, Math.min(100, totalScore));

  let status: BandarmologyAnalysis['status'];
  if (totalScore >= 75) status = 'STRONG_ACCUMULATION';
  else if (totalScore >= 60) status = 'ACCUMULATION';
  else if (totalScore >= 40) status = 'NEUTRAL';
  else if (totalScore >= 25) status = 'DISTRIBUTION';
  else status = 'STRONG_DISTRIBUTION';

  let warningLevel: BandarmologyAnalysis['warningLevel'] = 'SAFE';
  if (status === 'DISTRIBUTION' || status === 'STRONG_DISTRIBUTION') {
    warningLevel = status === 'STRONG_DISTRIBUTION' ? 'DANGER' : 'CAUTION';
  } else if (signals.some(s => s.type === 'WARNING')) {
    warningLevel = 'CAUTION';
  }

  // Confidence based on signal count and consistency
  const bullishSignals = signals.filter(s => s.type === 'BULLISH').length;
  const bearishSignals = signals.filter(s => s.type === 'BEARISH').length;
  const signalConsistency = Math.abs(bullishSignals - bearishSignals);

  let confidence: BandarmologyAnalysis['confidence'] = 'LOW';
  if (signals.length >= 3 && signalConsistency >= 2) confidence = 'HIGH';
  else if (signals.length >= 2) confidence = 'MEDIUM';

  return {
    score: Math.round(totalScore),
    status,
    signals,
    confidence,
    pattern,
    daysSincePatternStart,
    warningLevel
  };
}

function createNeutralResult(): BandarmologyAnalysis {
  return {
    score: 50,
    status: 'NEUTRAL',
    signals: [],
    confidence: 'LOW',
    pattern: null,
    daysSincePatternStart: 0,
    warningLevel: 'SAFE'
  };
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function countPatternDays(data: PriceVolumeData, pattern: string): number {
  // Simple heuristic - count recent days matching pattern criteria
  const len = data.prices.length;
  const avgVol = average(data.volumes.slice(-20));
  let count = 0;

  for (let i = len - 1; i >= Math.max(0, len - 10); i--) {
    const vol = data.volumes[i];
    const priceChange = i > 0 ? (data.prices[i] - data.prices[i - 1]) / data.prices[i - 1] * 100 : 0;

    if (pattern === 'absorption' && vol > avgVol * 1.3 && priceChange > -3 && priceChange < 2) {
      count++;
    } else if (pattern === 'distribution' && vol > avgVol * 1.2 && priceChange < 1) {
      count++;
    } else if (pattern === 'markup' && vol > avgVol && priceChange > 0) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

// Helper to generate human-readable summary
export function getBandarmologySummary(analysis: BandarmologyAnalysis): string {
  const statusText = {
    'STRONG_ACCUMULATION': '🟢 BANDAR AKUMULASI KUAT',
    'ACCUMULATION': '🟢 Akumulasi',
    'NEUTRAL': '⚪ Netral',
    'DISTRIBUTION': '🔴 Distribusi',
    'STRONG_DISTRIBUTION': '🔴 BANDAR DISTRIBUSI KUAT'
  };

  const patternText: Record<string, string> = {
    'ABSORPTION': 'Pola Absorpsi - Bandar sedang collect',
    'MARKUP': 'Fase Markup - Bandar dorong harga naik',
    'DISTRIBUTION_CEILING': 'Ceiling Distribution - Bandar jualan di resistance',
    'SHAKEOUT': 'Shakeout - Bandar goyang retail',
    'BREAKOUT': 'Breakout dengan Volume'
  };

  let summary = `${statusText[analysis.status]} (Score: ${analysis.score}/100)`;

  if (analysis.pattern) {
    summary += `\nPattern: ${patternText[analysis.pattern]}`;
  }

  if (analysis.warningLevel === 'DANGER') {
    summary += '\n⚠️ WARNING: High risk of further decline!';
  } else if (analysis.warningLevel === 'CAUTION') {
    summary += '\n⚡ CAUTION: Monitor closely';
  }

  return summary;
}
