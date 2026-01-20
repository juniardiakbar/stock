const symbol = 'BBCA.JK';
// Fetch 3 months of daily data to calculate MA60, MA20, RSI
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=3mo`;

async function testFetch() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    const result = data.chart.result[0];
    
    console.log('Timestamps count:', result.timestamp.length);
    console.log('Indicators quote count:', result.indicators.quote[0].close.length);
    console.log('Sample Volume:', result.indicators.quote[0].volume.slice(0, 5));
    console.log('Sample Close:', result.indicators.quote[0].close.slice(0, 5));
    
  } catch (e) {
    console.error(e);
  }
}

testFetch();
