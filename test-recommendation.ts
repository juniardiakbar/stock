import { getStockData } from "./src/lib/stock-api";
import { calculatePortfolio } from "./src/lib/engine";
import { Transaction, UserSettings, Stock } from "./src/types";

async function runTest() {
  console.log("Fetching stock data for BBCA...");
  const stock = await getStockData("BBCA");

  if (!stock) {
    console.error("Failed to fetch stock data");
    return;
  }

  console.log("Stock Data:", JSON.stringify(stock, null, 2));

  const stocksData: Record<string, Stock> = {
    BBCA: stock,
  };

  const transactions: Transaction[] = [
    {
      id: "1",
      type: "BUY",
      symbol: "BBCA",
      buyPrice: stock.currentPrice, // Bought at current price
      lots: 10,
      date: new Date().toISOString(),
    },
  ];

  const settings: UserSettings = {
    totalCapital: 100000000,
    maxAllocationPerStock: 15, // 15%
    riskTolerance: "MODERATE",
    takeProfitTarget: 20,
    stopLossTarget: 7,
  };

  console.log("Calculating portfolio...");
  const portfolio = calculatePortfolio(transactions, stocksData, settings);

  console.log("\n--- PORTFOLIO ITEM & RECOMMENDATION ---");
  const item = portfolio[0];
  console.log(`Symbol: ${item.symbol}`);
  console.log(`Lots: ${item.totalLots}`);
  console.log(`Avg Price: Rp ${item.avgPrice.toLocaleString()}`);
  console.log(`Current Price: Rp ${item.currentPrice.toLocaleString()}`);
  console.log(`P/L: ${item.unrealizedPLPercent.toFixed(2)}%`);

  console.log("\n--- SUGGESTION ---");
  console.log(`Action: ${item.suggestion.action} (${item.suggestion.urgency})`);
  console.log(`Reason: ${item.suggestion.reason}`);
  console.log(`Analysis: ${item.suggestion.analysis}`);
  console.log(
    `Bandarmology Score: ${item.suggestion.bandarmologyScore}/100 (${item.suggestion.bandarmologyStatus})`,
  );
  if (item.suggestion.warningFlags.length > 0) {
    console.log(`Warnings: ${item.suggestion.warningFlags.join(", ")}`);
  }

  console.log("\n--- TRADING PLAN ---");
  console.log(`Position Health: ${item.tradingPlan.positionHealth}`);
  console.log(
    `Stop Loss: Rp ${item.tradingPlan.stopLoss.price.toLocaleString()} (${item.tradingPlan.stopLoss.reason})`,
  );
  console.log(
    `TP1: Rp ${item.tradingPlan.takeProfit1.price.toLocaleString()} (+${item.tradingPlan.takeProfit1.percentFromCurrent.toFixed(1)}%)`,
  );
  console.log(
    `TP2: Rp ${item.tradingPlan.takeProfit2.price.toLocaleString()} (+${item.tradingPlan.takeProfit2.percentFromCurrent.toFixed(1)}%)`,
  );
  console.log(
    `TP3: Rp ${item.tradingPlan.takeProfit3.price.toLocaleString()} (+${item.tradingPlan.takeProfit3.percentFromCurrent.toFixed(1)}%)`,
  );
  console.log(`Risk:Reward = 1:${item.tradingPlan.riskRewardRatio}`);

  if (item.tradingPlan.addZones.length > 0) {
    console.log("\n--- ADD ZONES ---");
    item.tradingPlan.addZones.forEach((zone, i) => {
      console.log(
        `  ${i + 1}. ${zone.lots} lots @ Rp ${zone.price.toLocaleString()} (${zone.priority}) - ${zone.reason}`,
      );
    });
  }

  console.log("\n--- SELL STRATEGY ---");
  item.tradingPlan.sellStrategy.forEach((step, i) => {
    const lots = step.lotsToSell === "ALL" ? "ALL" : `${step.lotsToSell} lots`;
    console.log(
      `  ${i + 1}. ${step.triggerCondition}: ${lots} @ Rp ${step.price.toLocaleString()} - ${step.reason}`,
    );
  });

  console.log("\n--- ACTION SUMMARY ---");
  console.log(`Immediate: ${item.tradingPlan.immediateAction}`);
  console.log(`Short-term: ${item.tradingPlan.shortTermPlan}`);
  if (item.tradingPlan.notes) {
    console.log(`Notes: ${item.tradingPlan.notes}`);
  }
}

runTest();
