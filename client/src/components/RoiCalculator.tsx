import React, { useState } from 'react';
import { DollarSign, TrendingUp, Sparkles } from 'lucide-react';

export const RoiCalculator: React.FC = () => {
  const [dailyOrders, setDailyOrders] = useState<number>(35);
  const [avgProfitUsd, setAvgProfitUsd] = useState<number>(1.20);
  const bdtRate = 125;

  const monthlyOrders = dailyOrders * 30;
  const monthlyProfitUsd = monthlyOrders * avgProfitUsd;
  const monthlyProfitBdt = monthlyProfitUsd * bdtRate;

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-10 border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-crimson-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-laser-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Sliders Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Interactive ROI Simulator
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Calculate Your Estimated Monthly Telegram Profit
          </h3>

          <p className="text-sm text-zinc-400">
            Slide to simulate your daily digital account sales and see your projected net profit in BDT and USD.
          </p>

          {/* Slider 1: Daily Orders */}
          <div className="space-y-2 bg-carbon-800/80 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-zinc-300">Daily Accounts / Keys Sold:</span>
              <span className="text-crimson-400 font-mono text-base">{dailyOrders} orders/day</span>
            </div>
            <input
              type="range"
              min="5"
              max="200"
              step="5"
              value={dailyOrders}
              onChange={(e) => setDailyOrders(Number(e.target.value))}
              className="w-full accent-crimson-500 bg-carbon-900 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>5 orders</span>
              <span>100 orders</span>
              <span>200 orders</span>
            </div>
          </div>

          {/* Slider 2: Average Net Margin */}
          <div className="space-y-2 bg-carbon-800/80 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center text-sm font-semibold">
              <span className="text-zinc-300">Average Net Profit per Item:</span>
              <span className="text-laser-400 font-mono text-base">${avgProfitUsd.toFixed(2)} USD</span>
            </div>
            <input
              type="range"
              min="0.50"
              max="4.00"
              step="0.10"
              value={avgProfitUsd}
              onChange={(e) => setAvgProfitUsd(Number(e.target.value))}
              className="w-full accent-laser-500 bg-carbon-900 rounded-lg h-2 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
              <span>$0.50 USD</span>
              <span>$2.00 USD</span>
              <span>$4.00 USD</span>
            </div>
          </div>
        </div>

        {/* Results Card Column */}
        <div className="lg:col-span-5 bg-gradient-to-b from-carbon-800 to-carbon-850 p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative text-center space-y-6">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto">
            <TrendingUp className="w-6 h-6" />
          </div>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Projected Net Monthly Profit</span>
            <div className="mt-2 text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-white to-laser-400 font-mono">
              ${monthlyProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </div>
            <div className="text-sm font-semibold text-zinc-400 mt-1 font-mono">
              ~ ৳ {monthlyProfitBdt.toLocaleString()} BDT
            </div>
          </div>

          <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-3 text-left">
            <div className="bg-carbon-900/90 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 block">Monthly Volume:</span>
              <span className="text-sm font-bold text-white font-mono">{monthlyOrders.toLocaleString()} sales</span>
            </div>
            <div className="bg-carbon-900/90 p-3 rounded-xl border border-white/5">
              <span className="text-[11px] text-zinc-400 block">SaaS Subscription:</span>
              <span className="text-sm font-bold text-crimson-400 font-mono">$20 / mo</span>
            </div>
          </div>

          <a
            href="/register"
            className="block w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 hover:to-crimson-400 text-white font-bold text-sm shadow-lg shadow-crimson-500/25 transition-all active:scale-98 text-center"
          >
            Launch Your Store Now 🚀
          </a>
        </div>
      </div>
    </div>
  );
};
