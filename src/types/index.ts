export interface Stock {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  indicators?: TechnicalIndicators;
  bandarmology?: BandarmologyAnalysis;
}

export interface TechnicalIndicators {
  rsi: number;
  ma20: number;
  ma60: number;
  ma5: number; // Short-term for quick signals
  volumeChange: number; // percentage change in volume vs average
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  volumeFlow: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  support: number;
  resistance: number;
  atr: number; // Average True Range for volatility
  pricePosition: number; // 0-100, where price sits between support/resistance
}

// Enhanced Bandarmology Analysis
export interface BandarmologyAnalysis {
  score: number; // 0-100: 0=strong distribution, 50=neutral, 100=strong accumulation
  status: 'STRONG_ACCUMULATION' | 'ACCUMULATION' | 'NEUTRAL' | 'DISTRIBUTION' | 'STRONG_DISTRIBUTION';
  signals: BandarmologySignal[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  pattern?: 'ABSORPTION' | 'MARKUP' | 'DISTRIBUTION_CEILING' | 'SHAKEOUT' | 'BREAKOUT' | null;
  daysSincePatternStart: number;
  warningLevel: 'SAFE' | 'CAUTION' | 'DANGER'; // Early warning system
}

export interface BandarmologySignal {
  type: 'BULLISH' | 'BEARISH' | 'WARNING';
  name: string;
  description: string;
  weight: number; // How important this signal is
}


export interface Transaction {
  id: string;
  symbol: string;
  buyPrice: number;
  lots: number; // 1 lot = 100 shares in Indonesia
  date: string;
}

export interface PortfolioItem {
  symbol: string;
  totalLots: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  allocationPercent: number;
  suggestion: ActionSuggestion;
  tradingPlan: TradingPlan; // Detailed plan per stock
}

export interface ActionSuggestion {
  action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'REDUCE' | 'SELL' | 'TAKE_PROFIT';
  urgency: 'IMMEDIATE' | 'SOON' | 'WATCH' | 'NONE';
  reason: string;
  analysis: string;
  trend?: 'UP' | 'DOWN' | 'SIDEWAYS';
  bandarmologyScore?: number;
  bandarmologyStatus?: string;
  warningFlags: string[]; // Early warnings before stop loss
  isNearExit: boolean;
}

// Complete trading plan for each stock
export interface TradingPlan {
  // Current Position Summary
  positionHealth: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'DANGER';

  // Price Targets
  stopLoss: PriceLevel;
  takeProfit1: PriceLevel; // First target (partial exit)
  takeProfit2: PriceLevel; // Second target
  takeProfit3: PriceLevel; // Final target (full exit)

  // Entry Strategy (if should add)
  addZones: AddZone[];

  // Exit Strategy
  sellStrategy: SellStep[];

  // Risk Metrics
  riskRewardRatio: number;
  maxDownside: number; // Percentage to stop loss
  maxUpside: number; // Percentage to TP3

  // Action Summary
  immediateAction: string;
  shortTermPlan: string; // 1-5 days
  notes: string;
}

export interface PriceLevel {
  price: number;
  percentFromCurrent: number;
  reason: string;
}

export interface AddZone {
  price: number;
  lots: number;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SellStep {
  triggerCondition: string;
  price: number;
  lotsToSell: number | 'ALL';
  percentOfPosition: number;
  reason: string;
}

export interface UserSettings {
  totalCapital: number;
  maxAllocationPerStock: number; // percentage, e.g., 10
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  takeProfitTarget: number; // percentage, e.g., 20
  stopLossTarget: number; // percentage, e.g., 7
}
