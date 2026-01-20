'use server';

import { getStockData, getMultipleStocksData } from '@/lib/stock-api';

export async function fetchStockPrice(symbol: string) {
  return await getStockData(symbol);
}

export async function fetchMultipleStockPrices(symbols: string[]) {
  return await getMultipleStocksData(symbols);
}
