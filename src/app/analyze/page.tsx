"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Search, 
  TrendingUp, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Zap, 
  Flame,
  Star,
  Target,
  ShieldCheck} from "lucide-react";
import Link from "next/link";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { UserSettings } from "@/types";
import { fetchMultipleStockPrices } from "@/app/actions";
import { analyzePotentialBuy } from "@/lib/engine";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SETTINGS: UserSettings = {
  totalCapital: 100000000,
  maxAllocationPerStock: 15,
  riskTolerance: "MODERATE",
  takeProfitTarget: 20,
  stopLossTarget: 7,
};

export default function OpportunityScanner() {
  const [settings] = useLocalStorage<UserSettings>("settings", DEFAULT_SETTINGS);
  const [watchlist, setWatchlist] = useLocalStorage<string[]>("analyze_watchlist", ["BBCA", "TLKM", "ASII", "UNTR", "ADRO"]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");

  const runAnalysis = useCallback(async () => {
    if (watchlist.length === 0) return;
    setIsLoading(true);
    try {
      const stocksData = await fetchMultipleStockPrices(watchlist);
      const analysisResults = Object.values(stocksData).map(stock => {
        return analyzePotentialBuy(stock, settings);
      });

      // Sort results by recommendation quality
      const sortedResults = analysisResults.sort((a, b) => {
        const scoreA = getRankScore(a.suggestion);
        const scoreB = getRankScore(b.suggestion);
        return scoreB - scoreA;
      });

      setResults(sortedResults);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [watchlist, settings]);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const getRankScore = (suggestion: any) => {
    let score = 0;
    if (suggestion.action === "STRONG_BUY") score += 100;
    if (suggestion.action === "BUY") score += 50;
    if (suggestion.urgency === "IMMEDIATE") score += 30;
    if (suggestion.urgency === "SOON") score += 15;
    score += (suggestion.bandarmologyScore || 0);
    return score;
  };

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol && !watchlist.includes(newSymbol.toUpperCase())) {
      setWatchlist([...watchlist, newSymbol.toUpperCase()]);
      setNewSymbol("");
    }
  };

  const removeSymbol = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft size={20} className="text-white/40" />
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20 text-white">
              S
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              Opportunity <span className="text-blue-500 italic">Scanner</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-black uppercase text-blue-400 tracking-widest animate-pulse">
              Live Engine Active
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar: Watchlist Management */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-white/40">
                  <Search size={14} />
                  Scan List
                </h3>
                {watchlist.length > 0 && (
                  <button 
                    onClick={() => setWatchlist([])}
                    className="text-[9px] font-black uppercase text-white/20 hover:text-red-400 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <form onSubmit={handleAddSymbol} className="space-y-4 mb-8">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ENTER TICKER..."
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    className="glass-input w-full h-12 pl-4 pr-12 text-sm font-black uppercase tracking-widest"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:bg-blue-500 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {watchlist.map(symbol => (
                  <div 
                    key={symbol}
                    className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                  >
                    <span className="font-black text-sm tracking-tight">{symbol}</span>
                    <button 
                      onClick={() => removeSymbol(symbol)}
                      className="p-1.5 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {watchlist.length === 0 && (
                  <div className="text-center py-8 text-white/20 italic text-xs">
                    Watchlist empty
                  </div>
                )}
              </div>

              <div className="pt-6">
                <button
                  onClick={runAnalysis}
                  disabled={isLoading || watchlist.length === 0}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <Zap size={16} className={cn(isLoading && "animate-spin")} />
                  {isLoading ? "Analyzing..." : "Run Analysis"}
                </button>
              </div>
            </div>
          </div>

          {/* Main Results Area */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold flex items-center gap-3">
                <TrendingUp size={24} className="text-blue-500" />
                Best Opportunities Today
              </h3>
              <div className="text-xs text-white/40">
                Sorted by engine confidence & signal strength
              </div>
            </div>

            <div className="space-y-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                  <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Scanning IDX Market Signals...</p>
                </div>
              ) : results.length > 0 ? (
                results.map((item, index) => (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={item.symbol}
                    className={cn(
                      "glass-card p-6 border-white/5 relative overflow-hidden group transition-all hover:bg-white/[0.03]",
                      getRankScore(item.suggestion) > 150 ? "border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.05)]" : ""
                    )}
                  >
                    {/* Rank Indicator */}
                    <div className="absolute top-0 right-0 p-4">
                      {index === 0 && <Star size={24} className="text-amber-400 fill-amber-400/20" />}
                      {index === 1 && <Star size={20} className="text-slate-400 fill-slate-400/20" />}
                      {index === 2 && <Star size={16} className="text-amber-700/50 fill-amber-700/10" />}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {/* Stock Summary */}
                      <div className="md:col-span-1 border-r border-white/5 pr-6">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl font-black tracking-tighter group-hover:text-blue-400 transition-colors">
                            {item.symbol}
                          </span>
                          {getRankScore(item.suggestion) > 150 && (
                            <span className="flex items-center gap-1 text-[9px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded leading-none">
                              <Flame size={10} /> HOT
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-mono font-bold text-white/90">
                          Rp {item.currentPrice.toLocaleString("id-ID")}
                        </div>
                        <div className="mt-4 flex flex-col gap-1">
                          <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Confidence</span>
                          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full transition-all duration-1000"
                              style={{ width: `${Math.min(100, (getRankScore(item.suggestion) / 250) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Engine Suggestion */}
                      <div className="md:col-span-1 flex flex-col justify-center gap-3">
                        <div className={cn(
                          "px-4 py-2 rounded-xl flex items-center justify-center gap-2 text-sm font-black tracking-tighter shadow-lg w-full",
                          (item.suggestion.action === 'BUY' || item.suggestion.action === 'STRONG_BUY') ? "bg-blue-600 text-white shadow-blue-500/20" :
                          (item.suggestion.action === 'SELL' || item.suggestion.action === 'REDUCE') ? "bg-red-600 text-white shadow-red-500/20" :
                          item.suggestion.action === 'TAKE_PROFIT' ? "bg-emerald-600 text-white shadow-emerald-500/20" :
                          "bg-white/5 text-white/40 border border-white/5 shadow-none"
                        )}>
                          {(item.suggestion.action === 'BUY' || item.suggestion.action === 'STRONG_BUY') && <Plus size={16} strokeWidth={3} />}
                          {item.suggestion.action.replace('_', ' ')}
                        </div>
                        <div className="text-xs font-bold text-white/70 leading-relaxed text-center italic">
                          {item.suggestion.reason}
                        </div>
                      </div>

                      {/* Analysis Details */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase text-white/30">Bandar Score</span>
                            <span className={cn(
                              "text-xs font-mono font-black",
                              item.suggestion.bandarmologyScore >= 70 ? "text-emerald-400" :
                              item.suggestion.bandarmologyScore >= 50 ? "text-blue-400" : "text-amber-400"
                            )}>
                              {item.suggestion.bandarmologyScore}/100
                            </span>
                          </div>
                          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase text-white/30">Trend</span>
                            <span className={cn(
                              "text-xs font-black",
                              item.suggestion.trend === 'UP' ? "text-emerald-400" : "text-red-400"
                            )}>
                              {item.suggestion.trend}
                            </span>
                          </div>
                          {item.tradingPlan.riskRewardRatio > 0 && (
                            <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase text-white/30">R:R Ratio</span>
                              <span className="text-xs font-black text-white">
                                1:{item.tradingPlan.riskRewardRatio.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-white/40">
                              <Target size={12} className="text-blue-500" />
                              Entry Strategy & Plan
                            </div>
                            <div className="text-[9px] font-bold text-white/20">NEXT 1-5 DAYS</div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[9px] text-white/30 uppercase font-black mb-1">Buy Zone (Add)</div>
                              {item.tradingPlan.addZones.length > 0 ? (
                                <div className="text-xs font-mono font-bold text-blue-400">
                                  Rp {item.tradingPlan.addZones[0].price.toLocaleString()}
                                </div>
                              ) : (
                                <div className="text-xs text-white/20">Wait for dip</div>
                              )}
                            </div>
                            <div>
                              <div className="text-[9px] text-white/30 uppercase font-black mb-1">Primary Target</div>
                              <div className="text-xs font-mono font-bold text-emerald-400">
                                Rp {item.tradingPlan.takeProfit2.price.toLocaleString()} 
                                <span className="ml-1 text-[9px]">(+{item.tradingPlan.takeProfit2.percentFromCurrent.toFixed(1)}%)</span>
                              </div>
                            </div>
                          </div>
                          
                          {item.tradingPlan.immediateAction && (
                            <div className="mt-3 flex items-start gap-2 bg-blue-500/5 p-2 rounded-lg">
                              <Zap size={10} className="text-blue-400 mt-0.5" />
                              <p className="text-[10px] text-white/60 font-medium leading-tight">
                                {item.tradingPlan.immediateAction}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="glass-card py-24 px-6 text-center border-white/5">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search size={32} className="text-white/20" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">No Clear Opportunities</h4>
                  <p className="text-white/40 text-sm max-w-md mx-auto">
                    The engine didn&apos;t find any stocks meeting the required criteria. 
                    Try adding more tickers or wait for the next market cycle.
                  </p>
                  <button 
                    onClick={runAnalysis}
                    className="mt-8 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Rescan Market
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Risk Disclaimer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-white/20">
            <ShieldCheck size={40} />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">Risk Management System</p>
              <p className="text-[10px]">Algos adjusted for {settings.riskTolerance} profile</p>
            </div>
          </div>
          <div className="text-[9px] text-white/10 max-w-md text-center md:text-right uppercase tracking-[0.2em] leading-relaxed">
            Recommendations are based on VPA and Technical Analysis proxy. 
            All trading involves risk. Not financial advice.
          </div>
        </div>
      </footer>
    </div>
  );
}
