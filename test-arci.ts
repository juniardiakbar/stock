import { getStockData } from './src/lib/stock-api';
import { calculatePortfolio } from './src/lib/engine';
import { Transaction, UserSettings, Stock } from './src/types';

async function testARCI() {
  console.log('Fetching ARCI data...');
  const stock = await getStockData('ARCI');

  if (!stock) {
    console.error('Failed to fetch stock data');
    return;
  }

  console.log('Current Price:', stock.currentPrice);
  console.log('Bandarmology:', stock.bandarmology?.status, `(${stock.bandarmology?.score}/100)`);

  const stocksData: Record<string, Stock> = { 'ARCI': stock };

  // User's position: bought at 1910, 9 lots
  const transactions: Transaction[] = [{
    id: '1',
    symbol: 'ARCI',
    buyPrice: 1910,
    lots: 9,
    date: new Date().toISOString()
  }];

  const settings: UserSettings = {
    totalCapital: 100000000,
    maxAllocationPerStock: 15,
    riskTolerance: 'MODERATE',
    takeProfitTarget: 20,  // 20% target
    stopLossTarget: 7
  };

  console.log('\n--- YOUR POSITION ---');
  console.log('Buy Price: Rp 1,910');
  console.log('Lots: 9');
  console.log('Current Price:', stock.currentPrice);

  const plPercent = ((stock.currentPrice - 1910) / 1910) * 100;
  console.log(`P/L: ${plPercent >= 0 ? '+' : ''}${plPercent.toFixed(2)}%`);

  console.log('\n--- TP LEVELS (based on your buy price 1910) ---');
  console.log('TP1 (10%): Rp', Math.round(1910 * 1.10));
  console.log('TP2 (20%): Rp', Math.round(1910 * 1.20));
  console.log('TP3 (30%): Rp', Math.round(1910 * 1.30));

  const portfolio = calculatePortfolio(transactions, stocksData, settings);
  const item = portfolio[0];

  console.log('\n--- RECOMMENDATION ---');
  console.log(`Action: ${item.suggestion.action} (${item.suggestion.urgency})`);
  console.log(`Reason: ${item.suggestion.reason}`);

  console.log('\n--- TRADING PLAN ---');
  console.log(`Position Health: ${item.tradingPlan.positionHealth}`);
  console.log(`TP1: Rp ${item.tradingPlan.takeProfit1.price.toLocaleString()} (${item.tradingPlan.takeProfit1.reason})`);
  console.log(`TP2: Rp ${item.tradingPlan.takeProfit2.price.toLocaleString()}`);
  console.log(`Stop Loss: Rp ${item.tradingPlan.stopLoss.price.toLocaleString()}`);

  console.log('\n--- SELL STRATEGY ---');
  item.tradingPlan.sellStrategy.forEach((step, i) => {
    const lots = step.lotsToSell === 'ALL' ? 'ALL' : `${step.lotsToSell} lots`;
    console.log(`${i + 1}. ${step.triggerCondition}: ${lots}`);
  });

  console.log('\n--- IMMEDIATE ACTION ---');
  console.log(item.tradingPlan.immediateAction);
}

testARCI();
