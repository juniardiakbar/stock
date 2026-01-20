"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  Download,
  Upload,
  HelpCircle,
} from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Transaction, UserSettings, Stock } from "@/types";
import { fetchMultipleStockPrices } from "@/app/actions";
import { calculatePortfolio } from "@/lib/engine";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SETTINGS: UserSettings = {
  totalCapital: 100000000, // 100jt
  maxAllocationPerStock: 15,
  riskTolerance: "MODERATE",
  takeProfitTarget: 20,
  stopLossTarget: 7,
};

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

export default function Dashboard() {
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>(
    "transactions",
    [],
  );
  const [settings, setSettings] = useLocalStorage<UserSettings>(
    "settings",
    DEFAULT_SETTINGS,
  );
  const [stocksData, setStocksData] = useState<Record<string, Stock>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    symbol: "",
    buyPrice: 0,
    lots: 0,
    type: "BUY",
  });

  const portfolio = useMemo(() => {
    return calculatePortfolio(transactions, stocksData, settings);
  }, [transactions, stocksData, settings]);

  const totalMarketValue = portfolio.reduce(
    (acc, item) => acc + item.marketValue,
    0,
  );
  const totalCost = portfolio.reduce((acc, item) => acc + item.costBasis, 0);
  const totalPL = totalMarketValue - totalCost;
  const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
  const cashRemaining = settings.totalCapital - totalCost;

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    const symbols = Array.from(new Set(transactions.map((t) => t.symbol)));
    if (symbols.length > 0) {
      const data = await fetchMultipleStockPrices(symbols);
      setStocksData(data);
    }
    setIsLoading(false);
  }, [transactions]);

  useEffect(() => {
    if (transactions.length > 0) {
      refreshData();
    }
  }, [transactions.length, refreshData]);

  const handleAddTransaction = () => {
    if (
      newTransaction.symbol &&
      newTransaction.buyPrice &&
      newTransaction.lots
    ) {
      const transaction: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        symbol: newTransaction.symbol.toUpperCase(),
        buyPrice: Number(newTransaction.buyPrice),
        lots: Number(newTransaction.lots),
        date: new Date().toISOString(),
        type: (newTransaction.type as "BUY" | "SELL") || "BUY",
      };
      setTransactions([...transactions, transaction]);
      setNewTransaction({ symbol: "", buyPrice: 0, lots: 0, type: "BUY" });
      setIsAdding(false);
    }
  };

  const removeTransaction = (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const handleExportData = () => {
    const data = {
      transactions,
      settings,
      exportDate: new Date().toISOString(),
      version: "1.0",
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `stockwise-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.transactions && Array.isArray(json.transactions)) {
          setTransactions(json.transactions);
        }
        if (json.settings) {
          setSettings(json.settings);
        }
        alert("Data imported successfully!");
      } catch (err) {
        alert(
          "Failed to parse import file. Please ensure it is a valid JSON backup.",
        );
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Navigation */}
      <nav className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg shadow-blue-500/20">
              S
            </div>
            <span className="font-bold text-xl tracking-tight">
              StockWise <span className="text-blue-500 italic">ID</span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-white/60">
            <button
              onClick={() => setIsHelpOpen(true)}
              className="hover:text-white flex items-center gap-1.5 transition-colors group"
            >
              <HelpCircle
                size={18}
                className="text-blue-400 group-hover:scale-110 transition-transform"
              />
              <span className="hidden sm:inline">Guide</span>
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={handleExportData}
              className="hover:text-white flex items-center gap-1.5 transition-colors"
              title="Export Data"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <label
              className="hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Import Data"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Import</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
            <div className="w-px h-4 bg-white/10 mx-2" />
            <div className="flex items-center gap-2 text-white bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              IDX Live
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12"
        >
          <div className="glass-card p-6">
            <p className="text-white/50 text-xs mb-1 uppercase tracking-widest font-bold">
              Total Assets
            </p>
            <h2 className="text-2xl font-bold">
              Rp {(totalMarketValue + cashRemaining).toLocaleString("id-ID")}
            </h2>
            <p className="text-xs text-white/30 mt-1">
              Capital: Rp {settings.totalCapital.toLocaleString("id-ID")}
            </p>
          </div>
          <div className="glass-card p-6">
            <p className="text-white/50 text-xs mb-1 uppercase tracking-widest font-bold">
              Stock Value
            </p>
            <h2 className="text-2xl font-bold">
              Rp {totalMarketValue.toLocaleString("id-ID")}
            </h2>
            <p
              className={cn(
                "text-xs mt-1 font-bold",
                totalPL >= 0 ? "text-emerald-400" : "text-red-400",
              )}
            >
              {totalPL >= 0 ? "▲" : "▼"} {totalPLPercent.toFixed(2)}% (Rp{" "}
              {Math.abs(totalPL).toLocaleString("id-ID")})
            </p>
          </div>
          <div className="glass-card p-6">
            <p className="text-white/50 text-xs mb-1 uppercase tracking-widest font-bold">
              Unallocated Cash
            </p>
            <h2 className="text-2xl font-bold">
              Rp {cashRemaining.toLocaleString("id-ID")}
            </h2>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-1000"
                style={{
                  width: `${Math.min(100, (cashRemaining / settings.totalCapital) * 100)}%`,
                }}
              />
            </div>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="glass-card p-6 flex flex-col justify-center items-center group hover:bg-white/[0.05] transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-2 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="font-bold text-sm uppercase tracking-wider">
              Add Position
            </span>
          </button>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Portfolio Table */}
          <div className="xl:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp size={24} className="text-blue-500" />
                Live Portfolio
              </h3>
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <RefreshCw
                  size={14}
                  className={cn(isLoading && "animate-spin")}
                />
                Sync Market
              </button>
            </div>

            <div className="glass-card overflow-hidden border-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left table-auto">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        Ticker
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest text-right">
                        Avg Price
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest text-right">
                        Current
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest text-right">
                        P/L Value
                      </th>
                      <th className="px-6 py-4 text-[10px] font-bold text-white/40 uppercase tracking-widest min-w-[320px]">
                        Analysis & Recommendation
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {portfolio.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-20 text-center text-white/20 italic"
                        >
                          No active positions. Add your first stock to begin
                          tracking.
                        </td>
                      </tr>
                    ) : (
                      portfolio.map((item) => (
                        <tr
                          key={item.symbol}
                          className="hover:bg-white/[0.01] transition-colors group"
                        >
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-black text-lg tracking-tight group-hover:text-blue-400 transition-colors">
                                {item.symbol}
                              </span>
                              <span className="text-xs font-bold text-white/30 uppercase">
                                {item.totalLots} Lots
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right font-mono text-sm text-white/60">
                            Rp{" "}
                            {item.avgPrice.toLocaleString("id-ID", {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm font-bold">
                                Rp {item.currentPrice.toLocaleString("id-ID")}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] font-black px-1.5 py-0.5 rounded-sm mt-1",
                                  item.currentPrice >= item.avgPrice
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400",
                                )}
                              >
                                {item.unrealizedPLPercent >= 0 ? "+" : ""}
                                {item.unrealizedPLPercent.toFixed(2)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <span
                              className={cn(
                                "font-mono font-bold text-sm",
                                item.unrealizedPL >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400",
                              )}
                            >
                              {item.unrealizedPL >= 0 ? "+" : ""}Rp{" "}
                              {item.unrealizedPL.toLocaleString("id-ID")}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-3">
                              {/* Warning Flags */}
                              {item.suggestion.warningFlags &&
                                item.suggestion.warningFlags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {item.suggestion.warningFlags
                                      .slice(0, 2)
                                      .map((flag, i) => (
                                        <span
                                          key={i}
                                          className="text-[9px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20"
                                        >
                                          {flag}
                                        </span>
                                      ))}
                                  </div>
                                )}

                              {/* Action & Reason */}
                              <div className="flex items-start gap-4">
                                <div
                                  className={cn(
                                    "px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-xs w-[110px] flex-shrink-0 font-black tracking-tighter shadow-lg transition-all",
                                    (item.suggestion.action === "BUY" ||
                                      item.suggestion.action ===
                                        "STRONG_BUY") &&
                                      "bg-blue-600 text-white shadow-blue-500/20",
                                    (item.suggestion.action === "SELL" ||
                                      item.suggestion.action === "REDUCE") &&
                                      "bg-red-600 text-white shadow-red-500/20",
                                    item.suggestion.action === "TAKE_PROFIT" &&
                                      "bg-emerald-600 text-white shadow-emerald-500/20",
                                    item.suggestion.action === "HOLD" &&
                                      !item.suggestion.isNearExit &&
                                      "bg-white/5 text-white/40 border border-white/5 shadow-none",
                                    item.suggestion.action === "HOLD" &&
                                      item.suggestion.isNearExit &&
                                      "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-amber-500/10",
                                  )}
                                >
                                  {(item.suggestion.action === "BUY" ||
                                    item.suggestion.action ===
                                      "STRONG_BUY") && (
                                    <Plus size={14} strokeWidth={3} />
                                  )}
                                  {(item.suggestion.action === "SELL" ||
                                    item.suggestion.action === "REDUCE") && (
                                    <AlertCircle size={14} strokeWidth={3} />
                                  )}
                                  {item.suggestion.action === "TAKE_PROFIT" && (
                                    <CheckCircle2 size={14} strokeWidth={3} />
                                  )}
                                  {item.suggestion.action === "HOLD" && (
                                    <Info size={14} strokeWidth={3} />
                                  )}
                                  {item.suggestion.action.replace("_", " ")}
                                </div>

                                <div className="flex flex-col gap-1.5 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        "text-sm font-bold leading-tight",
                                        !item.suggestion.isNearExit &&
                                          item.suggestion.action === "HOLD"
                                          ? "text-white/40"
                                          : "text-white/90",
                                      )}
                                      style={{
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                      }}
                                    >
                                      {item.suggestion.reason}
                                    </span>
                                    {item.suggestion.urgency ===
                                      "IMMEDIATE" && (
                                      <span className="text-[9px] font-black uppercase text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded animate-pulse">
                                        URGENT
                                      </span>
                                    )}
                                    {item.suggestion.isNearExit &&
                                      item.suggestion.action === "HOLD" && (
                                        <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded animate-pulse">
                                          Near Limit
                                        </span>
                                      )}
                                  </div>

                                  {item.suggestion.analysis && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-white/40 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                        {item.suggestion.analysis}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Trading Plan Card */}
                              {item.tradingPlan && (
                                <div
                                  className={cn(
                                    "flex flex-wrap gap-4 p-3 rounded-xl border transition-all",
                                    item.tradingPlan.positionHealth === "DANGER"
                                      ? "bg-red-500/[0.05] border-red-500/20"
                                      : item.tradingPlan.positionHealth ===
                                          "WARNING"
                                        ? "bg-amber-500/[0.05] border-amber-500/20"
                                        : item.tradingPlan.positionHealth ===
                                            "EXCELLENT"
                                          ? "bg-emerald-500/[0.05] border-emerald-500/20"
                                          : "bg-white/[0.03] border-white/5",
                                  )}
                                >
                                  {item.tradingPlan.takeProfit1.price > 0 && (
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-white/30 uppercase font-bold tracking-tighter">
                                        TP1
                                      </span>
                                      <span className="text-emerald-400 font-mono text-xs font-bold">
                                        Rp{" "}
                                        {item.tradingPlan.takeProfit1.price.toLocaleString(
                                          "id-ID",
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {item.tradingPlan.stopLoss.price > 0 && (
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-white/30 uppercase font-bold tracking-tighter">
                                        Stop Loss
                                      </span>
                                      <span className="text-red-400 font-mono text-xs font-bold">
                                        Rp{" "}
                                        {item.tradingPlan.stopLoss.price.toLocaleString(
                                          "id-ID",
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {item.tradingPlan.addZones.length > 0 &&
                                    item.tradingPlan.addZones[0].priority ===
                                      "HIGH" && (
                                      <div className="flex flex-col">
                                        <span className="text-[9px] text-white/30 uppercase font-bold tracking-tighter">
                                          Add Zone
                                        </span>
                                        <span className="text-blue-400 font-mono text-xs font-bold">
                                          {item.tradingPlan.addZones[0].lots}{" "}
                                          lot @ Rp{" "}
                                          {item.tradingPlan.addZones[0].price.toLocaleString(
                                            "id-ID",
                                          )}
                                        </span>
                                      </div>
                                    )}
                                  {item.tradingPlan.riskRewardRatio > 0 && (
                                    <div className="flex flex-col">
                                      <span className="text-[9px] text-white/30 uppercase font-bold tracking-tighter">
                                        R:R
                                      </span>
                                      <span className="text-white font-mono text-xs font-bold">
                                        1:
                                        {item.tradingPlan.riskRewardRatio.toFixed(
                                          1,
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Immediate Action */}
                              {item.tradingPlan &&
                                item.tradingPlan.immediateAction &&
                                item.suggestion.action !== "HOLD" && (
                                  <div className="text-[10px] text-white/50 italic">
                                    → {item.tradingPlan.immediateAction}
                                  </div>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Allocation Card */}
            <div className="glass-card p-6 border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-white/40">
                <SettingsIcon size={14} />
                Asset Allocation
              </h3>
              <div className="h-56 w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={
                        portfolio.length > 0
                          ? (portfolio as any[])
                          : [{ symbol: "Cash", marketValue: cashRemaining }]
                      }
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="marketValue"
                      stroke="none"
                    >
                      {portfolio.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                      {portfolio.length === 0 && <Cell fill="#1a1a1a" />}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                      itemStyle={{ color: "#fff" }}
                      formatter={(value: any) =>
                        `Rp ${Number(value || 0).toLocaleString("id-ID")}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {portfolio.map((item, index) => (
                  <div
                    key={item.symbol}
                    className="flex items-center justify-between text-xs group"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shadow-sm"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="text-white/60 font-bold group-hover:text-white transition-colors">
                        {item.symbol}
                      </span>
                    </div>
                    <span className="font-mono font-bold">
                      {item.allocationPercent.toFixed(1)}%
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                    <span className="text-white/40 font-bold uppercase tracking-tighter text-[10px]">
                      Cash Reserve
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white/40">
                    {((cashRemaining / settings.totalCapital) * 100).toFixed(1)}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Money Management Settings */}
            <div className="glass-card p-6 border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <SettingsIcon size={48} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-6">
                Strategy Settings
              </h3>
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block">
                    Trading Capital (IDR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/30">
                      Rp
                    </span>
                    <input
                      type="number"
                      value={settings.totalCapital}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          totalCapital: Number(e.target.value),
                        })
                      }
                      className="glass-input w-full pl-9 text-sm font-mono font-bold focus:ring-1 focus:ring-blue-500/50"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block">
                    Risk Profile
                  </label>
                  <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                    {["CONSERVATIVE", "MODERATE", "AGGRESSIVE"].map((risk) => (
                      <button
                        key={risk}
                        onClick={() =>
                          setSettings({
                            ...settings,
                            riskTolerance: risk as any,
                          })
                        }
                        className={cn(
                          "flex-1 py-2 rounded-lg text-[9px] font-black transition-all uppercase tracking-tighter",
                          settings.riskTolerance === risk
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                            : "text-white/30 hover:text-white/60",
                        )}
                      >
                        {risk.slice(0, 4)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-white/30 tracking-widest block">
                    Max Risk Per Stock (%)
                  </label>
                  <input
                    type="number"
                    value={settings.maxAllocationPerStock}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxAllocationPerStock: Number(e.target.value),
                      })
                    }
                    className="glass-input w-full text-sm font-mono font-bold focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-emerald-500/40 tracking-widest block">
                      TP Target
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.takeProfitTarget}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            takeProfitTarget: Number(e.target.value),
                          })
                        }
                        className="glass-input w-full text-sm font-mono font-bold text-emerald-400 bg-emerald-500/[0.02] border-emerald-500/10 focus:border-emerald-500/30"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-500/30">
                        %
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-red-500/40 tracking-widest block">
                      SL Buffer
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.stopLossTarget}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            stopLossTarget: Number(e.target.value),
                          })
                        }
                        className="glass-input w-full text-sm font-mono font-bold text-red-400 bg-red-500/[0.02] border-red-500/10 focus:border-red-500/30"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-500/30">
                        %
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    onClick={refreshData}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-blue-600/20"
                  >
                    Apply Strategy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Footer */}
        {transactions.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">
                Portfolio Activity
              </h3>
              <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded text-white/30 uppercase">
                {transactions.length} Positions
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {transactions
                .map((t) => (
                  <div
                    key={t.id}
                    className="group relative flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all overflow-hidden"
                  >
                    <div className="relative z-10 flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded",
                            t.type === "SELL"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-blue-500/20 text-blue-400",
                          )}
                        >
                          {t.type || "BUY"}
                        </span>
                        <span className="font-black text-sm tracking-tighter">
                          {t.symbol}
                        </span>
                        <span className="text-[9px] font-bold text-white/20">
                          {new Date(t.date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-white/50">
                        {t.lots} <span className="text-[9px]">LOTS</span>{" "}
                        <span className="mx-1 text-white/10">|</span>{" "}
                        <span className="text-[9px]">@</span>{" "}
                        {t.buyPrice.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeTransaction(t.id)}
                      className="relative z-10 p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
                .reverse()}
            </div>
          </div>
        )}

        {/* Add Modal */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="glass-card w-full max-w-md p-10 shadow-[0_0_100px_rgba(59,130,246,0.1)] border-white/10"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl transition-colors",
                      newTransaction.type === "SELL"
                        ? "bg-red-600 shadow-red-600/20"
                        : "bg-blue-600 shadow-blue-600/20",
                    )}
                  >
                    {newTransaction.type === "SELL" ? (
                      <TrendingUp size={28} className="rotate-180" />
                    ) : (
                      <Plus size={28} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">
                      {newTransaction.type === "SELL"
                        ? "Close Position"
                        : "Open Position"}
                    </h2>
                    <p className="text-xs font-medium text-white/40 uppercase tracking-widest">
                      {newTransaction.type === "SELL"
                        ? "Realize profit or loss"
                        : "Add stock to your portfolio"}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Transaction Type Toggle */}
                  <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
                    <button
                      onClick={() =>
                        setNewTransaction({ ...newTransaction, type: "BUY" })
                      }
                      className={cn(
                        "flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                        newTransaction.type === "BUY"
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      Buy Stock
                    </button>
                    <button
                      onClick={() =>
                        setNewTransaction({ ...newTransaction, type: "SELL" })
                      }
                      className={cn(
                        "flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all",
                        newTransaction.type === "SELL"
                          ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                          : "text-white/40 hover:text-white",
                      )}
                    >
                      Sell Stock
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">
                      Stock Ticker
                    </label>
                    <input
                      autoFocus
                      placeholder="E.G. BBCA OR TLKM"
                      value={newTransaction.symbol}
                      onChange={(e) =>
                        setNewTransaction({
                          ...newTransaction,
                          symbol: e.target.value.toUpperCase(),
                        })
                      }
                      className={cn(
                        "glass-input w-full h-14 text-2xl font-black uppercase tracking-tighter placeholder:text-white/5 focus:ring-2 transition-all",
                        newTransaction.type === "SELL"
                          ? "focus:ring-red-600/20"
                          : "focus:ring-blue-600/20",
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">
                        Execution Price
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={newTransaction.buyPrice || ""}
                        onChange={(e) =>
                          setNewTransaction({
                            ...newTransaction,
                            buyPrice: Number(e.target.value),
                          })
                        }
                        className="glass-input w-full h-12 text-lg font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">
                        Lots (1=100)
                      </label>
                      <input
                        type="number"
                        placeholder="1"
                        value={newTransaction.lots || ""}
                        onChange={(e) =>
                          setNewTransaction({
                            ...newTransaction,
                            lots: Number(e.target.value),
                          })
                        }
                        className="glass-input w-full h-12 text-lg font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="pt-6 flex gap-4">
                    <button
                      onClick={handleAddTransaction}
                      className={cn(
                        "h-14 text-white flex-1 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl",
                        newTransaction.type === "SELL"
                          ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                          : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20",
                      )}
                    >
                      {newTransaction.type === "SELL"
                        ? "Confirm Sell"
                        : "Confirm Buy"}
                    </button>
                    <button
                      onClick={() => setIsAdding(false)}
                      className="h-14 bg-white/5 hover:bg-white/10 text-white/60 flex-1 rounded-2xl font-black uppercase tracking-widest transition-all border border-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Beginners Guide Modal */}
        <AnimatePresence>
          {isHelpOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="glass-card w-full max-w-2xl p-8 shadow-2xl border-white/10 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400">
                      <HelpCircle size={24} />
                    </div>
                    <h2 className="text-2xl font-black tracking-tight">
                      Trading Guide
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsHelpOpen(false)}
                    className="text-white/20 hover:text-white transition-colors"
                  >
                    <Trash2 size={24} className="rotate-45" />{" "}
                    {/* Close icon using Trash2 rotated for now or add X icon */}
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Actions */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400 mb-4 px-1">
                      How to read actions
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-blue-600 text-[10px] font-black rounded text-white">
                            STRONG BUY
                          </span>
                          <span className="font-bold text-sm">Best Entry</span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">
                          Strong accumulation detected! Bandar is buying
                          heavily. Great time to enter.
                        </p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-blue-600/70 text-[10px] font-black rounded text-white">
                            BUY
                          </span>
                          <span className="font-bold text-sm">Good Entry</span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">
                          Accumulation phase or near support. Good time to add
                          lots.
                        </p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-red-600 text-[10px] font-black rounded text-white">
                            SELL
                          </span>
                          <span className="font-bold text-sm">Exit Now</span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">
                          Strong distribution or stop loss hit. Exit to protect
                          capital.
                        </p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-red-600/70 text-[10px] font-black rounded text-white">
                            REDUCE
                          </span>
                          <span className="font-bold text-sm">
                            Cut Exposure
                          </span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">
                          Warning signs detected. Sell part of your position to
                          reduce risk.
                        </p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-emerald-600 text-[10px] font-black rounded text-white">
                            TAKE PROFIT
                          </span>
                          <span className="font-bold text-sm">
                            Secure Gains
                          </span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">
                          Target reached or overbought. Lock in your profits!
                        </p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-white/10 text-[10px] font-black rounded text-white/40">
                            HOLD
                          </span>
                          <span className="font-bold text-sm">Be Patient</span>
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed">
                          No clear signal yet. Wait for better opportunity.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Bandarmology */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400 mb-4 px-1">
                      What is Flow (Bandarmology)?
                    </h3>
                    <div className="p-5 bg-blue-600/5 rounded-2xl border border-blue-600/10">
                      <div className="flex flex-col gap-4">
                        <div>
                          <span className="text-xs font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded mr-2 uppercase">
                            Accumulation
                          </span>
                          <p className="text-sm mt-2 text-white/80 font-medium">
                            Big Institutions/Banks are quietly buying.
                          </p>
                          <p className="text-xs text-white/40 mt-1 leading-relaxed">
                            Think of them as &quot;Smart Money.&quot; When they
                            buy, the price usually follows up later.
                          </p>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div>
                          <span className="text-xs font-black px-2 py-0.5 bg-red-500/20 text-red-400 rounded mr-2 uppercase">
                            Distribution
                          </span>
                          <p className="text-sm mt-2 text-white/80 font-medium">
                            Big Institutions are selling to the public.
                          </p>
                          <p className="text-xs text-white/40 mt-1 leading-relaxed">
                            This is a warning! If they are leaving, you
                            don&apos;t want to be left holding the bag.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Bandarmology Patterns */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400 mb-4 px-1">
                      5 Institutional Patterns (Bandarmology)
                    </h3>
                    <div className="space-y-3">
                      <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded uppercase">
                            Absorption
                          </span>
                          <span className="text-xs font-bold text-white">
                            Quiet Collection
                          </span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          High volume but price stays stable = bandar collecting
                          shares quietly before big move. BULLISH signal.
                        </p>
                      </div>

                      <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded uppercase">
                            Markup
                          </span>
                          <span className="text-xs font-bold text-white">
                            Pushing Higher
                          </span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Price rising on high volume = bandar aggressively
                          pushing price up. Strong BULLISH momentum.
                        </p>
                      </div>

                      <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black rounded uppercase">
                            Distribution Ceiling
                          </span>
                          <span className="text-xs font-bold text-white">
                            Seller Resistance
                          </span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Price fails at resistance multiple times with volume =
                          bandar selling at the top. Warning to TAKE PROFIT.
                        </p>
                      </div>

                      <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-black rounded uppercase">
                            Shakeout
                          </span>
                          <span className="text-xs font-bold text-white">
                            Scare Retail
                          </span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Sharp drop on huge volume but quick recovery = bandar
                          shaking out weak hands before next leg up. BUY THE
                          DIP!
                        </p>
                      </div>

                      <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-black rounded uppercase">
                            Breakout
                          </span>
                          <span className="text-xs font-bold text-white">
                            Breaking Key Level
                          </span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">
                          Volume surge + price breaks resistance = confirmation
                          of strong move. Bullish momentum continues higher.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Technical Jargon */}
                  <section>
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-blue-400 mb-4 px-1">
                      Technical Jargon
                    </h3>
                    <div className="space-y-4 px-1">
                      <div className="flex gap-4">
                        <div className="font-mono text-xs font-black bg-blue-500/10 text-blue-400 px-2 py-1 h-fit rounded">
                          RSI
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white mb-1">
                            Momentum Speedometer
                          </p>
                          <p className="text-[11px] text-white/40 leading-relaxed">
                            Measured 0-100. Over 80 means the stock is
                            &quot;Overbought&quot; (running too hot). Under 30
                            means it&apos;s &quot;Oversold&quot; (potential
                            bargain).
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="font-mono text-xs font-black bg-blue-500/10 text-blue-400 px-2 py-1 h-fit rounded">
                          Trend
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white mb-1">
                            Market Direction
                          </p>
                          <p className="text-[11px] text-white/40 leading-relaxed">
                            <span className="text-emerald-400">UP</span> means
                            the stock is climbing.{" "}
                            <span className="text-red-400">DOWN</span> means
                            it&apos;s falling. We always prefer stocks moving
                            UP.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="font-mono text-xs font-black bg-blue-500/10 text-blue-400 px-2 py-1 h-fit rounded">
                          SL/TP
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-white mb-1">
                            Your Safety Buffer
                          </p>
                          <p className="text-[11px] text-white/40 leading-relaxed">
                            Stop Loss (SL) is your exit if things go wrong. Take
                            Profit (TP) is where you cash out your victory
                            hard-earned money.
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="mt-10">
                  <button
                    onClick={() => setIsHelpOpen(false)}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20"
                  >
                    Got it, let&apos;s trade!
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
