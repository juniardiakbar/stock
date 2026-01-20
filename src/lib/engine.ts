import {
  PortfolioItem,
  Transaction,
  UserSettings,
  Stock,
  ActionSuggestion,
  TradingPlan,
  AddZone,
  SellStep,
  PriceLevel,
} from "@/types";

export function calculatePortfolio(
  transactions: Transaction[],
  stocksData: Record<string, Stock>,
  settings: UserSettings,
): PortfolioItem[] {
  // Group transactions by symbol
  const grouped = transactions.reduce(
    (acc, t) => {
      if (!acc[t.symbol]) {
        acc[t.symbol] = {
          totalLots: 0,
          totalCost: 0,
          transactions: [],
        };
      }

      if (t.type === 'SELL') {
        // Calculate cost basis removal (FIFO/Weighted Average approximation)
        const currentAvgPrice = acc[t.symbol].totalLots > 0 
          ? acc[t.symbol].totalCost / (acc[t.symbol].totalLots * 100) 
          : 0;
        
        const validSellLots = Math.min(acc[t.symbol].totalLots, t.lots); // Prevent negative lots
        acc[t.symbol].totalLots -= validSellLots;
        acc[t.symbol].totalCost -= validSellLots * 100 * currentAvgPrice;
      } else {
        // BUY (Default)
        // If transaction has no type (legacy data), assume BUY
        acc[t.symbol].totalLots += t.lots;
        acc[t.symbol].totalCost += t.lots * 100 * t.buyPrice;
      }
      
      acc[t.symbol].transactions.push(t);
      return acc;
    },
    {} as Record<
      string,
      { totalLots: number; totalCost: number; transactions: Transaction[] }
    >,
  );

  // Calculate total market value for allocation
  let totalPortfolioValue = 0;
  Object.entries(grouped).forEach(([symbol, data]) => {
    const currentPrice = stocksData[symbol]?.currentPrice || 0;
    totalPortfolioValue += data.totalLots * 100 * currentPrice;
  });

  const availableCapital = settings.totalCapital - totalPortfolioValue;

  return Object.entries(grouped).map(([symbol, data]) => {
    const stock = stocksData[symbol];
    const currentPrice = stock?.currentPrice || 0;
    const avgPrice = data.totalCost / (data.totalLots * 100);
    const marketValue = data.totalLots * 100 * currentPrice;
    const costBasis = data.totalCost;
    const unrealizedPL = marketValue - costBasis;
    const unrealizedPLPercent =
      costBasis > 0 ? (unrealizedPL / costBasis) * 100 : 0;
    const allocationPercent =
      settings.totalCapital > 0
        ? (marketValue / settings.totalCapital) * 100
        : 0;

    // Generate suggestion and trading plan
    const suggestion = generateSuggestion(
      stock,
      data.totalLots,
      avgPrice,
      unrealizedPLPercent,
      settings,
    );
    const tradingPlan = generateTradingPlan(
      stock,
      data.totalLots,
      avgPrice,
      unrealizedPLPercent,
      settings,
      availableCapital,
    );

    return {
      symbol,
      totalLots: data.totalLots,
      avgPrice,
      currentPrice,
      marketValue,
      costBasis,
      unrealizedPL,
      unrealizedPLPercent,
      allocationPercent,
      suggestion,
      tradingPlan,
    };
  });
}

function generateSuggestion(
  stock: Stock | undefined,
  totalLots: number,
  avgPrice: number,
  unrealizedPLPercent: number,
  settings: UserSettings,
): ActionSuggestion {
  const defaultSuggestion: ActionSuggestion = {
    action: "HOLD",
    urgency: "NONE",
    reason: "Data not available.",
    analysis: "Insufficient data.",
    warningFlags: [],
    isNearExit: false,
  };

  if (!stock?.indicators || !stock?.bandarmology) {
    return defaultSuggestion;
  }

  const { rsi, ma20, ma5, trend, support, resistance, pricePosition, atr } =
    stock.indicators;
  const {
    score: bandarmologyScore,
    status: bandarmologyStatus,
    warningLevel,
    signals,
    pattern,
  } = stock.bandarmology;
  const currentPrice = stock.currentPrice;

  const warningFlags: string[] = [];
  let action: ActionSuggestion["action"] = "HOLD";
  let urgency: ActionSuggestion["urgency"] = "NONE";
  let reason = "Waiting for clearer signal.";

  // Risk tolerance modifiers
  const riskMod =
    settings.riskTolerance === "CONSERVATIVE"
      ? 0.8
      : settings.riskTolerance === "AGGRESSIVE"
        ? 1.2
        : 1;

  // ========================================
  // EARLY WARNING FLAGS (Before Stop Loss)
  // ========================================

  if (warningLevel === "DANGER") {
    warningFlags.push("DANGER: Strong institutional distribution detected!");
  } else if (warningLevel === "CAUTION") {
    warningFlags.push("WARNING: Distribution signals detected");
  }

  if (
    bandarmologyStatus === "DISTRIBUTION" ||
    bandarmologyStatus === "STRONG_DISTRIBUTION"
  ) {
    warningFlags.push(`Bandarmology: ${bandarmologyStatus.replace("_", " ")}`);
  }

  if (pattern === "DISTRIBUTION_CEILING") {
    warningFlags.push("Pattern: Price failing at resistance");
  }

  if (rsi > 75) {
    warningFlags.push(`RSI Overbought (${rsi.toFixed(0)})`);
  }

  if (trend === "DOWN" && currentPrice < ma20) {
    warningFlags.push("Downtrend: Price below MA20");
  }

  // Consecutive red days check from signals
  const sellingMomentum = signals.find((s) => s.name === "Selling Momentum");
  if (sellingMomentum) {
    warningFlags.push(sellingMomentum.description);
  }

  // ========================================
  // ACTION DETERMINATION
  // ========================================

  // PRIORITY 1: STRONG DISTRIBUTION - Exit even without stop loss hit
  if (bandarmologyStatus === "STRONG_DISTRIBUTION") {
    action = "SELL";
    urgency = "IMMEDIATE";
    reason = `STRONG DISTRIBUTION detected (Score: ${bandarmologyScore}). Exit immediately!`;
  }
  // PRIORITY 2: Distribution + Loss = Cut position
  else if (bandarmologyStatus === "DISTRIBUTION" && unrealizedPLPercent < 0) {
    action = "REDUCE";
    urgency = "SOON";
    reason = `Distribution + Floating Loss (${unrealizedPLPercent.toFixed(1)}%). Reduce position.`;
  }
  // PRIORITY 3: Hard Stop Loss
  else if (unrealizedPLPercent <= -settings.stopLossTarget) {
    action = "SELL";
    urgency = "IMMEDIATE";
    reason = `Stop Loss hit (${unrealizedPLPercent.toFixed(1)}%). Cut loss now!`;
  }
  // PRIORITY 4: Take Profit conditions
  // TP1 level = half of target (e.g., 10% if target is 20%)
  else if (unrealizedPLPercent >= settings.takeProfitTarget) {
    action = "TAKE_PROFIT";
    urgency = "IMMEDIATE";
    reason = `TARGET HIT! Profit +${unrealizedPLPercent.toFixed(1)}%. Time to take profits!`;
  } else if (
    unrealizedPLPercent >= settings.takeProfitTarget * 0.5 &&
    unrealizedPLPercent > 0
  ) {
    // Price has reached TP1 level (half of target, e.g., 10% if target is 20%)
    action = "TAKE_PROFIT";
    urgency = "SOON";
    reason = `TP1 reached (+${unrealizedPLPercent.toFixed(1)}%). Consider selling a portion.`;
  } else if (
    rsi >= (settings.riskTolerance === "CONSERVATIVE" ? 70 : 80) &&
    pricePosition > 85
  ) {
    action = "TAKE_PROFIT";
    urgency = "SOON";
    reason = `RSI Overbought (${rsi.toFixed(0)}) + Near resistance. Consider selling.`;
  } else if (pattern === "DISTRIBUTION_CEILING" && unrealizedPLPercent > 5) {
    action = "TAKE_PROFIT";
    urgency = "WATCH";
    reason = `Distribution ceiling pattern - take profits before reversal.`;
  }
  // PRIORITY 5: Buy opportunities (Strong Accumulation)
  else if (bandarmologyStatus === "STRONG_ACCUMULATION" && trend !== "DOWN") {
    action = "STRONG_BUY";
    urgency = "SOON";
    reason = `STRONG ACCUMULATION (Score: ${bandarmologyScore}). Smart money buying!`;
  } else if (
    bandarmologyStatus === "ACCUMULATION" &&
    rsi < 60 &&
    currentPrice <= ma20 * 1.03
  ) {
    action = "BUY";
    urgency = "WATCH";
    reason = `Accumulation + Near MA20 support. Good entry.`;
  } else if (pattern === "SHAKEOUT") {
    action = "STRONG_BUY";
    urgency = "SOON";
    reason = `Shakeout recovery! Classic institutional shake - buy the dip.`;
  } else if (pattern === "BREAKOUT") {
    action = "BUY";
    urgency = "SOON";
    reason = `Volume breakout confirmed! Bullish momentum.`;
  }
  // PRIORITY 6: Reduce on bad conditions even with small profit
  else if (warningLevel === "DANGER" && unrealizedPLPercent > 0) {
    action = "REDUCE";
    urgency = "SOON";
    reason = `Warning level DANGER with profit. Secure some gains.`;
  }

  // Build analysis string
  const trendEmoji = trend === "UP" ? "↑" : trend === "DOWN" ? "↓" : "→";
  const analysis = [
    `Trend: ${trendEmoji} ${trend}`,
    `Bandarmology: ${bandarmologyScore}/100 (${bandarmologyStatus.replace("_", " ")})`,
    `RSI: ${rsi.toFixed(0)}`,
    pattern ? `Pattern: ${pattern.replace("_", " ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  // Check if near exit levels
  const stopLossPrice = currentPrice * (1 - settings.stopLossTarget / 100);
  const takeProfitPrice = currentPrice * (1 + settings.takeProfitTarget / 100);
  const isNearExit =
    currentPrice <= stopLossPrice * 1.1 ||
    unrealizedPLPercent >= settings.takeProfitTarget * 0.9;

  return {
    action,
    urgency,
    reason,
    analysis,
    trend,
    bandarmologyScore,
    bandarmologyStatus: bandarmologyStatus.replace("_", " "),
    warningFlags,
    isNearExit,
  };
}

function generateTradingPlan(
  stock: Stock | undefined,
  totalLots: number,
  avgPrice: number,
  unrealizedPLPercent: number,
  settings: UserSettings,
  availableCapital: number,
): TradingPlan {
  const defaultPlan: TradingPlan = {
    positionHealth: "WARNING",
    stopLoss: { price: 0, percentFromCurrent: 0, reason: "N/A" },
    takeProfit1: { price: 0, percentFromCurrent: 0, reason: "N/A" },
    takeProfit2: { price: 0, percentFromCurrent: 0, reason: "N/A" },
    takeProfit3: { price: 0, percentFromCurrent: 0, reason: "N/A" },
    addZones: [],
    sellStrategy: [],
    riskRewardRatio: 0,
    maxDownside: 0,
    maxUpside: 0,
    immediateAction: "Data not available",
    shortTermPlan: "Waiting for data",
    notes: "",
  };

  if (!stock?.indicators || !stock?.bandarmology) {
    return defaultPlan;
  }

  const currentPrice = stock.currentPrice;
  const { support, resistance, ma20, ma5, atr, rsi } = stock.indicators;
  const {
    score: bandarmologyScore,
    status: bandarmologyStatus,
    warningLevel,
    pattern,
  } = stock.bandarmology;

  // ========================================
  // POSITION HEALTH ASSESSMENT
  // ========================================

  let positionHealth: TradingPlan["positionHealth"] = "GOOD";

  if (
    bandarmologyStatus === "STRONG_DISTRIBUTION" ||
    unrealizedPLPercent <= -settings.stopLossTarget
  ) {
    positionHealth = "DANGER";
  } else if (
    bandarmologyStatus === "DISTRIBUTION" ||
    warningLevel === "DANGER" ||
    unrealizedPLPercent < -5
  ) {
    positionHealth = "WARNING";
  } else if (bandarmologyScore >= 70 && unrealizedPLPercent > 5) {
    positionHealth = "EXCELLENT";
  }

  // ========================================
  // STOP LOSS CALCULATION
  // ========================================

  // Method 1: Percentage-based
  const percentStop = avgPrice * (1 - settings.stopLossTarget / 100);

  // Method 2: Technical (support level)
  const technicalStop = support > 0 ? support * 0.98 : percentStop; // Slightly below support

  // Method 3: ATR-based (2x ATR below current)
  const atrStop = currentPrice - atr * 2;

  // Use the highest stop loss (most protective) but not above current price
  let stopLossPrice = Math.max(percentStop, technicalStop, atrStop);
  stopLossPrice = Math.min(stopLossPrice, currentPrice * 0.95); // Never more than 5% from current

  const stopLossPercent = ((stopLossPrice - currentPrice) / currentPrice) * 100;

  const stopLoss: PriceLevel = {
    price: Math.round(stopLossPrice),
    percentFromCurrent: stopLossPercent,
    reason:
      stopLossPrice === technicalStop
        ? `Support level at ${Math.round(support)}`
        : stopLossPrice === atrStop
          ? `2x ATR from current price`
          : `${settings.stopLossTarget}% from buy price`,
  };

  // ========================================
  // TAKE PROFIT LEVELS (Based on AVG BUY PRICE, not current price!)
  // ========================================

  // TP targets based on user's entry price
  const tp1Target = avgPrice * (1 + (settings.takeProfitTarget / 100) * 0.5); // Half of target (e.g., 10% if target is 20%)
  const tp2Target = avgPrice * (1 + settings.takeProfitTarget / 100); // Full target (e.g., 20%)
  const tp3Multiplier = bandarmologyScore >= 70 ? 1.5 : 1.2;
  const tp3Target =
    avgPrice * (1 + (settings.takeProfitTarget / 100) * tp3Multiplier); // Extended (e.g., 30%)

  // Consider resistance level for TP1, but NEVER below current price
  let tp1Price = tp1Target;
  if (resistance > currentPrice && resistance < tp1Target) {
    // Use resistance if it's a reasonable first target
    tp1Price = resistance;
  }
  // TP must ALWAYS be above current price (otherwise it's already hit!)
  tp1Price = Math.max(tp1Price, currentPrice * 1.01); // At least 1% above current

  // TP2 and TP3 must also be above current
  const tp2Price = Math.max(tp2Target, currentPrice * 1.05);
  const tp3Price = Math.max(tp3Target, currentPrice * 1.1);

  const takeProfit1: PriceLevel = {
    price: Math.round(tp1Price),
    percentFromCurrent: ((tp1Price - currentPrice) / currentPrice) * 100,
    reason:
      resistance > currentPrice && tp1Price >= resistance * 0.98
        ? `Near resistance at ${Math.round(resistance)}`
        : `First target (${(((tp1Price - currentPrice) / currentPrice) * 100).toFixed(1)}%)`,
  };

  const takeProfit2: PriceLevel = {
    price: Math.round(tp2Price),
    percentFromCurrent: ((tp2Price - currentPrice) / currentPrice) * 100,
    reason: `Primary target ${settings.takeProfitTarget}%`,
  };

  const takeProfit3: PriceLevel = {
    price: Math.round(tp3Price),
    percentFromCurrent: ((tp3Price - currentPrice) / currentPrice) * 100,
    reason: `Extended target (${(((tp3Price - currentPrice) / currentPrice) * 100).toFixed(1)}%)`,
  };

  // ========================================
  // ADD ZONES (Where to buy more)
  // ========================================

  const addZones: AddZone[] = [];
  const maxAllocationAmount =
    (settings.maxAllocationPerStock / 100) * settings.totalCapital;
  const currentAllocation = totalLots * 100 * currentPrice;
  const remainingAllocation = maxAllocationAmount - currentAllocation;

  if (remainingAllocation > 0 && availableCapital > 0) {
    const buyableAmount = Math.min(remainingAllocation, availableCapital);

    // Zone 1: MA20 support (if in uptrend)
    if (stock.indicators.trend === "UP" || bandarmologyScore >= 60) {
      const ma20Price = Math.round(ma20);
      const lotsAtMA20 = Math.floor((buyableAmount * 0.3) / (ma20Price * 100));
      if (lotsAtMA20 > 0 && ma20Price < currentPrice) {
        addZones.push({
          price: ma20Price,
          lots: lotsAtMA20,
          reason: `MA20 Support - add on pullback`,
          priority: "HIGH",
        });
      }
    }

    // Zone 2: Support level
    if (support > 0 && support < currentPrice * 0.95) {
      const supportPrice = Math.round(support);
      const lotsAtSupport = Math.floor(
        (buyableAmount * 0.4) / (supportPrice * 100),
      );
      if (lotsAtSupport > 0) {
        addZones.push({
          price: supportPrice,
          lots: lotsAtSupport,
          reason: `Support level - strong buy zone`,
          priority: bandarmologyScore >= 60 ? "HIGH" : "MEDIUM",
        });
      }
    }

    // Zone 3: Current price (if strong accumulation)
    if (bandarmologyScore >= 75) {
      const lotsNow = Math.floor((buyableAmount * 0.3) / (currentPrice * 100));
      if (lotsNow > 0) {
        addZones.push({
          price: Math.round(currentPrice),
          lots: lotsNow,
          reason: `Strong accumulation - entry now`,
          priority: "HIGH",
        });
      }
    }

    // Zone 4: Breakout zone (above resistance)
    if (pattern === "BREAKOUT" || (bandarmologyScore >= 70 && rsi < 70)) {
      const breakoutPrice = Math.round(resistance * 1.02);
      const lotsAtBreakout = Math.floor(
        (buyableAmount * 0.2) / (breakoutPrice * 100),
      );
      if (lotsAtBreakout > 0) {
        addZones.push({
          price: breakoutPrice,
          lots: lotsAtBreakout,
          reason: `Breakout confirmation - momentum buy`,
          priority: "MEDIUM",
        });
      }
    }
  }

  // ========================================
  // SELL STRATEGY
  // ========================================

  const sellStrategy: SellStep[] = [];

  // Strategy depends on current condition
  if (positionHealth === "DANGER") {
    // Emergency exit
    sellStrategy.push({
      triggerCondition: "IMMEDIATE - Danger condition",
      price: Math.round(currentPrice),
      lotsToSell: "ALL",
      percentOfPosition: 100,
      reason: "Cut loss / exit distribution",
    });
  } else if (positionHealth === "WARNING") {
    // Partial exit
    sellStrategy.push({
      triggerCondition: "Warning active - reduce exposure",
      price: Math.round(currentPrice),
      lotsToSell: Math.ceil(totalLots * 0.5),
      percentOfPosition: 50,
      reason: "Reduce risk - sell half position",
    });
    sellStrategy.push({
      triggerCondition: `If drops to ${stopLoss.price}`,
      price: stopLoss.price,
      lotsToSell: "ALL",
      percentOfPosition: 100,
      reason: "Stop loss - sell remaining",
    });
  } else {
    // Normal scaling out strategy
    const tp1Lots = Math.ceil(totalLots * 0.3);
    const tp2Lots = Math.ceil(totalLots * 0.4);
    const tp3Lots = totalLots - tp1Lots - tp2Lots;

    if (tp1Lots > 0) {
      sellStrategy.push({
        triggerCondition: `TP1: Price reaches ${takeProfit1.price}`,
        price: takeProfit1.price,
        lotsToSell: tp1Lots,
        percentOfPosition: 30,
        reason: "Take partial profit - secure 30%",
      });
    }
    if (tp2Lots > 0) {
      sellStrategy.push({
        triggerCondition: `TP2: Price reaches ${takeProfit2.price}`,
        price: takeProfit2.price,
        lotsToSell: tp2Lots,
        percentOfPosition: 40,
        reason: "Primary target - sell 40%",
      });
    }
    if (tp3Lots > 0) {
      sellStrategy.push({
        triggerCondition: `TP3: Price reaches ${takeProfit3.price}`,
        price: takeProfit3.price,
        lotsToSell: tp3Lots,
        percentOfPosition: 30,
        reason: "Extended target - sell remaining",
      });
    }

    // Always have stop loss
    sellStrategy.push({
      triggerCondition: `STOP LOSS: If drops to ${stopLoss.price}`,
      price: stopLoss.price,
      lotsToSell: "ALL",
      percentOfPosition: 100,
      reason: "Cut loss - protect capital",
    });
  }

  // ========================================
  // RISK/REWARD CALCULATION
  // ========================================

  const maxDownside = Math.abs(stopLossPercent);
  const maxUpside = takeProfit2.percentFromCurrent;
  const riskRewardRatio = maxDownside > 0 ? maxUpside / maxDownside : 0;

  // ========================================
  // ACTION SUMMARY
  // ========================================

  let immediateAction = "";
  let shortTermPlan = "";
  let notes = "";

  if (positionHealth === "DANGER") {
    immediateAction = `SELL ALL ${totalLots} lots now at ${Math.round(currentPrice)}`;
    shortTermPlan =
      "Exit this position. Wait for new trend confirmation before re-entry.";
    notes = "Position in danger. Prioritize capital protection.";
  } else if (positionHealth === "WARNING") {
    const sellPortion = Math.floor(totalLots * 0.5);
    immediateAction = `Consider selling ${sellPortion} lots (${new Number((sellPortion / totalLots) * 100).toFixed(0)}%) at ${Math.round(currentPrice)}`;
    shortTermPlan = `Monitor closely. Stop loss at ${stopLoss.price}`;
    notes = "Warning signals detected. Reduce exposure and monitor.";
  } else if (positionHealth === "EXCELLENT") {
    immediateAction = "HOLD - position healthy";
    if (addZones.length > 0 && addZones[0].priority === "HIGH") {
      immediateAction = `Can add ${addZones[0].lots} lots at ${addZones[0].price}`;
    }
    shortTermPlan = `Target TP1: ${takeProfit1.price}, TP2: ${takeProfit2.price}`;
    notes = "Position strong with positive bandarmology. Follow the plan.";
  } else {
    immediateAction = "HOLD - wait for clearer signal";
    shortTermPlan = `Watch support at ${Math.round(support)}, resistance at ${Math.round(resistance)}`;
    if (addZones.length > 0) {
      notes = `Add zones available: ${addZones.map((z) => `${z.price} (${z.lots} lots)`).join(", ")}`;
    }
  }

  return {
    positionHealth,
    stopLoss,
    takeProfit1,
    takeProfit2,
    takeProfit3,
    addZones,
    sellStrategy,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    maxDownside: Math.round(maxDownside * 100) / 100,
    maxUpside: Math.round(maxUpside * 100) / 100,
    immediateAction,
    shortTermPlan,
    notes,
  };
}
