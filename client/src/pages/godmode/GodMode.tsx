import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { GODMODE_SECRET_TOKEN } from '../../../../shared/constants';
import {
  ShieldAlert,
  Server,
  Cpu,
  Layers,
  Zap,
  Power,
  RefreshCw,
  Edit3,
  DollarSign,
  Lock,
  CheckCircle,
  AlertTriangle,
  Key,
} from 'lucide-react';

export const GodMode: React.FC = () => {
  const [tokenInput, setTokenInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');

  const [overview, setOverview] = useState<any>(null);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({
    digitalcoreKey: '',
    canbosoKey: '',
    platformFeeFixedUsd: 0.01,
    platformFeePct: 0.0,
    ownerBinanceUid: '',
    ownerBinanceApiKey: '',
    ownerBinanceApiSecret: '',
  });

  const [loading, setLoading] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Read token from URL query if present (e.g. ?token=hkjhl-sadmin-godmode-2026)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryToken = params.get('token');
    const storedToken = sessionStorage.getItem('godmode_token');

    if (queryToken === GODMODE_SECRET_TOKEN || storedToken === GODMODE_SECRET_TOKEN) {
      sessionStorage.setItem('godmode_token', GODMODE_SECRET_TOKEN);
      setAuthenticated(true);
    }
  }, []);

  const godmodeHeaders = {
    headers: { 'x-godmode-token': GODMODE_SECRET_TOKEN },
  };

  const loadGodModeData = async () => {
    setLoading(true);
    try {
      const [overviewRes, merchantsRes, configRes] = await Promise.all([
        axios.get('/api/godmode/overview', godmodeHeaders),
        axios.get('/api/godmode/merchants', godmodeHeaders),
        axios.get('/api/godmode/config', godmodeHeaders),
      ]);
      setOverview(overviewRes.data);
      setMerchants(merchantsRes.data);
      setConfig(configRes.data);
    } catch (err: any) {
      console.error('GodMode fetch error:', err);
      if (err.response?.status === 403) {
        setAuthenticated(false);
        sessionStorage.removeItem('godmode_token');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadGodModeData();
    }
  }, [authenticated]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tokenInput.trim() === GODMODE_SECRET_TOKEN) {
      sessionStorage.setItem('godmode_token', GODMODE_SECRET_TOKEN);
      setAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('INVALID ACCESS TOKEN. TERMINAL LOCKED.');
    }
  };

  // Toggle Merchant Killswitch
  const handleToggleKillswitch = async (merchantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const action = newStatus === 'SUSPENDED' ? 'SUSPEND (Kill Bot & Lock Store)' : 'ACTIVATE';

    if (!confirm(`Are you sure you want to ${action} this merchant store?`)) return;

    try {
      await axios.post(
        `/api/godmode/merchants/${merchantId}/status`,
        { status: newStatus },
        godmodeHeaders
      );
      loadGodModeData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Killswitch toggle failed');
    }
  };

  // Adjust Wallet Balance
  const handleAdjustWallet = async (merchantId: string, merchantName: string) => {
    const delta = prompt(`Enter amount delta in USD to add or deduct for "${merchantName}" (e.g. 50 or -10):`);
    if (!delta || isNaN(parseFloat(delta))) return;

    const note = prompt('Audit note for this adjustment:', 'Platform admin manual credit');

    try {
      await axios.post(
        `/api/godmode/merchants/${merchantId}/adjust-wallet`,
        { amountDeltaUsd: parseFloat(delta), note },
        godmodeHeaders
      );
      alert('Wallet balance updated successfully.');
      loadGodModeData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Adjustment failed');
    }
  };

  // Save Wholesale & Binance Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put('/api/godmode/config', config, godmodeHeaders);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      loadGodModeData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save configuration');
    }
  };

  // ==========================================
  // VIEW A: ACCESS GATE (TERMINAL LOCK)
  // ==========================================
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-carbon-950 flex items-center justify-center p-4">
        <div className="glass-card-cyber rounded-3xl p-8 max-w-md w-full border border-crimson-600/40 text-center space-y-6 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-crimson-500/10 border border-crimson-500/30 text-crimson-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <div>
            <span className="text-[10px] font-mono tracking-widest text-crimson-500 uppercase font-bold">
              SECURITY CLEARANCE LEVEL 0
            </span>
            <h2 className="text-xl font-mono font-extrabold text-white mt-1">
              GOD-MODE COMMAND CENTER
            </h2>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-crimson-600/20 text-crimson-400 font-mono text-xs border border-crimson-500/30">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="Enter God-Mode Token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-carbon-900 border border-crimson-500/30 text-white font-mono text-xs focus:outline-none focus:border-crimson-400 text-center tracking-widest"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-mono font-bold text-xs shadow-lg shadow-crimson-600/30 transition-all uppercase tracking-wider active:scale-98"
            >
              Authenticate Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW B: AUTHENTICATED COMMAND CENTER
  // ==========================================
  return (
    <div className="min-h-screen bg-carbon-950 text-zinc-100 flex flex-col font-sans">
      {/* Top Cyber Command Header */}
      <header className="bg-carbon-900/95 border-b border-crimson-600/30 px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-crimson-600 flex items-center justify-center shadow-md shadow-crimson-600/40">
            <ShieldAlert className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs font-mono font-black text-white tracking-widest uppercase flex items-center gap-2">
              <span>MOGENT // GOD-MODE</span>
              <span className="w-1.5 h-1.5 rounded-full bg-crimson-500 animate-pulse"></span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Platform Fleet & Wholesale Command</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadGodModeData}
            className="p-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300"
            title="Refresh Fleet Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              sessionStorage.removeItem('godmode_token');
              setAuthenticated(false);
            }}
            className="px-3 py-1.5 rounded-xl bg-carbon-800 hover:bg-crimson-500/20 text-zinc-400 hover:text-crimson-400 text-xs font-mono border border-white/10"
          >
            Lock Terminal
          </button>
        </div>
      </header>

      {/* Main Command Dashboard */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* Row 1: System Telemetry & Wholesale Live Balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Lightsail Server RAM */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">SERVER RAM USAGE</span>
              <Server className="w-4 h-4 text-laser-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-white">
              {overview?.system?.nodeMemoryRssMb || 0} <span className="text-xs text-zinc-500">MB RSS</span>
            </div>
            <div className="w-full bg-carbon-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-laser-500 h-full rounded-full"
                style={{ width: `${Math.min(100, ((overview?.system?.nodeMemoryRssMb || 50) / 300) * 100)}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">
              Budget: &lt;300MB RAM (Node Heap: {overview?.system?.nodeMemoryHeapMb || 0}MB)
            </span>
          </div>

          {/* Card 2: DigitalCore Balance */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">DIGITALCORE LIVE</span>
              <Zap className="w-4 h-4 text-crimson-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-crimson-400">
              ${overview?.wholesaleBalances?.digitalcore?.balance?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-500">USD</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> API Status: Connected
            </span>
          </div>

          {/* Card 3: Canboso Balance */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">CANBOSO LIVE</span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-purple-400">
              ${overview?.wholesaleBalances?.canboso?.balanceUsd?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-500">USD</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              VND: {overview?.wholesaleBalances?.canboso?.balanceVnd?.toLocaleString() || '0'}
            </span>
          </div>

          {/* Card 4: Fleet Overview */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">MERCHANT STORES</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-white">
              {overview?.fleet?.activeMerchants || 0} / {overview?.fleet?.totalMerchants || 0}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              Merchant Wallets: ${overview?.fleet?.totalMerchantWalletsUsd?.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>

        {/* Row 2: Merchant Fleet Table & 1-Click Killswitches */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider">
                Merchant Fleet Table ({merchants.length})
              </h3>
              <p className="text-xs text-zinc-400">Monitor all stores, wallets, and toggle emergency killswitches</p>
            </div>
          </div>

          <div className="glass-card-cyber rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-carbon-900 text-zinc-400 font-bold uppercase border-b border-white/10">
                  <tr>
                    <th className="p-4">Store / Slug</th>
                    <th className="p-4">Owner Email</th>
                    <th className="p-4">Bot Status</th>
                    <th className="p-4">Wallet (USD)</th>
                    <th className="p-4">Orders</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Emergency Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {merchants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500 font-sans">
                        No registered merchant stores found in fleet.
                      </td>
                    </tr>
                  ) : (
                    merchants.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="p-4">
                          <span className="font-bold text-white block">{m.name}</span>
                          <span className="text-[11px] text-crimson-400">bot.mogent.tech/{m.slug}</span>
                        </td>
                        <td className="p-4 text-zinc-400">{m.owner_email}</td>
                        <td className="p-4">
                          {m.botHasToken ? (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] ${m.botOnline ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'bg-amber-500/20 text-amber-300'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${m.botOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                              {m.bot_username ? `@${m.bot_username}` : 'Configured'}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[10px]">No Token</span>
                          )}
                        </td>
                        <td className="p-4 font-bold text-laser-400 font-mono">${Number(m.wallet_usd).toFixed(2)}</td>
                        <td className="p-4">{m.orders_count || 0}</td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m.status === 'ACTIVE'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-crimson-500/20 text-crimson-400 animate-pulse'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => handleAdjustWallet(m.id, m.name)}
                            className="px-2.5 py-1 rounded bg-carbon-800 hover:bg-carbon-700 text-white font-bold text-[10px]"
                          >
                            Adjust $
                          </button>
                          <button
                            onClick={() => handleToggleKillswitch(m.id, m.status)}
                            className={`px-2.5 py-1 rounded font-bold text-[10px] ${
                              m.status === 'ACTIVE'
                                ? 'bg-crimson-500/20 text-crimson-400 hover:bg-crimson-500/30 border border-crimson-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                            }`}
                          >
                            {m.status === 'ACTIVE' ? 'KILLSWITCH' : 'ACTIVATE'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Row 3: Platform Margin Engine & Owner Binance Pay Credentials */}
        <form onSubmit={handleSaveConfig} className="glass-card-cyber rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-mono font-bold text-white uppercase">
                Global Wholesale Margin & Binance Pay Engine
              </h3>
              <p className="text-xs text-zinc-400">
                Configure provider API keys, automated platform profit margin, and your receiving Binance credentials.
              </p>
            </div>
            {configSaved && (
              <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Config Applied Live
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wholesale Keys */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-crimson-400 uppercase">1. Upstream Wholesale Providers</h4>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">DigitalCore API Key</label>
                <input
                  type="text"
                  placeholder="Paste digitalcore.top key"
                  value={config.digitalcoreKey}
                  onChange={(e) => setConfig({ ...config, digitalcoreKey: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Canboso Buyer API Key</label>
                <input
                  type="text"
                  placeholder="Paste canboso.com buyer key"
                  value={config.canbosoKey}
                  onChange={(e) => setConfig({ ...config, canbosoKey: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Platform Fixed Fee ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.platformFeeFixedUsd}
                    onChange={(e) => setConfig({ ...config, platformFeeFixedUsd: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                  />
                  <span className="text-[10px] text-zinc-500">e.g. +$0.01 USD / item</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Platform Margin (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={config.platformFeePct}
                    onChange={(e) => setConfig({ ...config, platformFeePct: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                  />
                  <span className="text-[10px] text-zinc-500">Optional % markup</span>
                </div>
              </div>
            </div>

            {/* Platform Owner Binance Pay */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-bold text-laser-400 uppercase">2. Platform Owner Binance Pay (Tier 2)</h4>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Your Binance Pay UID</label>
                <input
                  type="text"
                  placeholder="Your personal UID shown to merchants"
                  value={config.ownerBinanceUid}
                  onChange={(e) => setConfig({ ...config, ownerBinanceUid: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Binance Read-Only API Key</label>
                <input
                  type="text"
                  placeholder="Your Read-Only API Key"
                  value={config.ownerBinanceApiKey}
                  onChange={(e) => setConfig({ ...config, ownerBinanceApiKey: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Binance API Secret {config.ownerBinanceHasSecret && '(Secret already configured)'}
                </label>
                <input
                  type="password"
                  placeholder="Your Binance Secret Key"
                  value={config.ownerBinanceApiSecret}
                  onChange={(e) => setConfig({ ...config, ownerBinanceApiSecret: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-mono font-bold text-xs uppercase tracking-wider shadow-lg shadow-crimson-600/30 active:scale-98"
          >
            Deploy & Save System Engine
          </button>
        </form>
      </div>
    </div>
  );
};
