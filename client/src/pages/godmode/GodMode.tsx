import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  ShoppingBag,
  Sliders,
  Folder,
  FolderOpen,
  Ban,
} from 'lucide-react';

export const GodMode: React.FC = () => {
  const [tokenInput, setTokenInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Navigation tab inside GodMode
  const [godTab, setGodTab] = useState<'merchants' | 'wholesale' | 'config'>('merchants');

  const [overview, setOverview] = useState<any>(null);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [wholesaleCatalog, setWholesaleCatalog] = useState<any[]>([]);
  const [wholesaleSearch, setWholesaleSearch] = useState('');
  const [wholesaleProviderFilter, setWholesaleProviderFilter] = useState<'all' | 'digitalcore' | 'canboso'>('all');
  const [wholesaleCategoryFilter, setWholesaleCategoryFilter] = useState('all');
  const [wholesaleLoading, setWholesaleLoading] = useState(false);

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

  // Check existing session token on mount (strictly from memory, NO auto-login via URL)
  useEffect(() => {
    const storedJwt = sessionStorage.getItem('godmode_jwt');
    if (storedJwt) {
      setAuthenticated(true);
    }
  }, []);

  const getHeaders = () => {
    const jwt = sessionStorage.getItem('godmode_jwt');
    return {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    };
  };

  const loadGodModeData = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      const [overviewRes, merchantsRes, configRes, wholesaleRes] = await Promise.all([
        axios.get('/api/godmode/overview', headers),
        axios.get('/api/godmode/merchants', headers),
        axios.get('/api/godmode/config', headers),
        axios.get('/api/godmode/wholesale-catalog', headers),
      ]);
      setOverview(overviewRes.data);
      setMerchants(merchantsRes.data);
      setConfig(configRes.data);
      setWholesaleCatalog(wholesaleRes.data);
    } catch (err: any) {
      console.error('GodMode fetch error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setAuthenticated(false);
        sessionStorage.removeItem('godmode_jwt');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadWholesaleCatalog = async () => {
    setWholesaleLoading(true);
    try {
      const res = await axios.get('/api/godmode/wholesale-catalog?refresh=true', getHeaders());
      setWholesaleCatalog(res.data);
    } catch (err) {
      console.error('Failed to load wholesale catalog in GodMode:', err);
    } finally {
      setWholesaleLoading(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      loadGodModeData();
    }
  }, [authenticated]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    try {
      const res = await axios.post('/api/godmode/login', {
        token: tokenInput.trim(),
      });

      if (res.data?.token) {
        sessionStorage.setItem('godmode_jwt', res.data.token);
        setAuthenticated(true);
        setTokenInput('');
      } else {
        setAuthError('INVALID MASTER TOKEN. ACCESS DENIED.');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.error || 'INVALID MASTER TOKEN. ACCESS DENIED.');
    } finally {
      setIsSubmitting(false);
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
        getHeaders()
      );
      loadGodModeData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update merchant status');
    }
  };

  // Adjust Merchant Wallet
  const handleAdjustWallet = async (merchantId: string, storeName: string) => {
    const delta = prompt(`Adjust USD balance for "${storeName}". Enter delta amount (e.g. +10 or -5):`);
    if (!delta || isNaN(parseFloat(delta))) return;

    const note = prompt('Audit note for this adjustment:', 'Manual GodMode credit');

    try {
      await axios.post(
        `/api/godmode/merchants/${merchantId}/adjust-wallet`,
        { amountDeltaUsd: parseFloat(delta), note },
        getHeaders()
      );
      loadGodModeData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Wallet adjustment failed');
    }
  };

  // Wholesale Product Availability Toggle
  const handleToggleWholesaleStatus = async (productId: string, currentActive: number) => {
    const newActive = currentActive === 1 ? 0 : 1;
    try {
      await axios.put(
        `/api/godmode/wholesale-rules/${productId}`,
        { isActive: newActive },
        getHeaders()
      );
      setWholesaleCatalog((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active_platform: newActive } : p))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to toggle product status');
    }
  };

  // Minimum Plan Tier Gating Change
  const handleChangeMinPlanTier = async (productId: string, newTier: string) => {
    try {
      await axios.put(
        `/api/godmode/wholesale-rules/${productId}`,
        { minPlanTier: newTier },
        getHeaders()
      );
      setWholesaleCatalog((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, min_plan_tier: newTier } : p))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change plan tier requirement');
    }
  };

  // 1-Click Delete / Remove Product from Platform
  const handleDeleteWholesaleProduct = async (productId: string, name: string) => {
    if (
      !confirm(
        `Globally delete/disable "${name}"? It will immediately disappear from merchant wholesale catalogs and Telegram bots.`
      )
    )
      return;

    try {
      await axios.delete(`/api/godmode/wholesale-rules/${productId}`, getHeaders());
      setWholesaleCatalog((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active_platform: 0 } : p))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete product rule');
    }
  };

  // 1-Click Bulk Wholesale Governance Action
  const handleBulkWholesaleAction = async (action: 'disable_all' | 'enable_all' | 'set_tier', minPlanTier?: string) => {
    const providerName = wholesaleProviderFilter.toUpperCase();
    const confirmMsg =
      action === 'disable_all'
        ? `Disable all wholesale products currently shown (${providerName})? They will immediately be hidden from all merchant stores and Telegram bots.`
        : action === 'enable_all'
        ? `Enable all wholesale products (${providerName}) for merchants?`
        : `Set minimum plan tier for all ${providerName} products to "${minPlanTier}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      setWholesaleLoading(true);
      const res = await axios.post(
        '/api/godmode/wholesale-rules/bulk',
        {
          action,
          provider: wholesaleProviderFilter,
          minPlanTier,
        },
        getHeaders()
      );
      alert(res.data.message || 'Bulk action executed successfully.');
      await loadWholesaleCatalog();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Bulk action failed');
    } finally {
      setWholesaleLoading(false);
    }
  };

  // Save Margin & Binance Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put('/api/godmode/config', config, getHeaders());
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      loadGodModeData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save global configuration');
    }
  };

  // Filtered Wholesale Catalog for GodMode (with Provider & API Category Folders)
  const filteredWholesale = wholesaleCatalog.filter((item) => {
    const q = wholesaleSearch ? wholesaleSearch.toLowerCase().trim() : '';
    const matchSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.provider.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q);

    const matchProvider =
      wholesaleProviderFilter === 'all' ||
      item.provider.toLowerCase() === wholesaleProviderFilter.toLowerCase();

    const matchCategory =
      wholesaleCategoryFilter === 'all' ||
      item.category.toLowerCase() === wholesaleCategoryFilter.toLowerCase();

    return matchSearch && matchProvider && matchCategory;
  });

  const wholesaleCategories = Array.from(
    new Set(
      wholesaleCatalog
        .filter((i) => wholesaleProviderFilter === 'all' || i.provider.toLowerCase() === wholesaleProviderFilter.toLowerCase())
        .map((i) => i.category)
    )
  ).filter(Boolean);

  // ==========================================
  // VIEW A: CYBER TERMINAL LOCK SCREEN
  // ==========================================
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-carbon-950 flex items-center justify-center p-4 font-mono select-none">
        <div className="w-full max-w-md glass-card-cyber rounded-2xl p-8 border border-crimson-600/30 space-y-6 shadow-2xl shadow-crimson-600/10">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-crimson-600/20 border border-crimson-500/40 flex items-center justify-center mx-auto text-crimson-400">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-xl font-black tracking-widest text-white uppercase">
              MOGENT // GOD-MODE
            </h2>
            <p className="text-xs text-zinc-500">
              RESTRICTED SUPER-ADMIN COMMAND TERMINAL
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1.5 uppercase tracking-wider">
                Enter Master Secret Token
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="••••••••••••••••"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-crimson-500 transition-colors"
                />
                <Key className="w-4 h-4 text-zinc-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg shadow-crimson-600/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
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
              sessionStorage.removeItem('godmode_jwt');
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

        {/* Navigation Tabs in GodMode */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-2">
          <button
            onClick={() => setGodTab('merchants')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              godTab === 'merchants'
                ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Merchant Fleet ({merchants.length})
          </button>
          <button
            onClick={() => setGodTab('wholesale')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              godTab === 'wholesale'
                ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Wholesale Governance & Plan Gating ({wholesaleCatalog.length})
          </button>
          <button
            onClick={() => setGodTab('config')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all ${
              godTab === 'config'
                ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Wholesale Margin & Binance Engine
          </button>
        </div>

        {/* ==========================================
            TAB 1: MERCHANT FLEET & KILLSWITCHES
           ========================================== */}
        {godTab === 'merchants' && (
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
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] ${
                                  m.botOnline
                                    ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    m.botOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                                  }`}
                                ></span>
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
        )}

        {/* ==========================================
            TAB 2: WHOLESALE GOVERNANCE & PLAN GATING
           ========================================== */}
        {godTab === 'wholesale' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-5 h-5 text-crimson-400" /> Wholesale Catalog Governance & Gating
                </h3>
                <p className="text-xs text-zinc-400">
                  Control which wholesale products are available to merchants, set minimum subscription plan tiers, or 1-click delete/disable items.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start">
                <button
                  onClick={() => handleBulkWholesaleAction('disable_all')}
                  className="px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="1-Click Disable All wholesale items currently filtered"
                >
                  <Ban className="w-3.5 h-3.5" /> 1-Click Disable All
                </button>
                <button
                  onClick={() => handleBulkWholesaleAction('enable_all')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
                  title="1-Click Enable All wholesale items currently filtered"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> 1-Click Enable All
                </button>
                <button
                  onClick={loadWholesaleCatalog}
                  className="px-4 py-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300 text-xs font-mono flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${wholesaleLoading ? 'animate-spin' : ''}`} /> Refresh Upstream
                </button>
              </div>
            </div>

            {/* Upstream Provider Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
              <button
                onClick={() => {
                  setWholesaleProviderFilter('all');
                  setWholesaleCategoryFilter('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  wholesaleProviderFilter === 'all'
                    ? 'bg-crimson-600 text-white shadow-md shadow-crimson-600/30'
                    : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>ALL PROVIDERS</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40">
                  {wholesaleCatalog.length}
                </span>
              </button>
              <button
                onClick={() => {
                  setWholesaleProviderFilter('digitalcore');
                  setWholesaleCategoryFilter('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  wholesaleProviderFilter === 'digitalcore'
                    ? 'bg-laser-600 text-white shadow-md shadow-laser-600/30'
                    : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                <span>DIGITALCORE API</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40">
                  {wholesaleCatalog.filter((i) => i.provider?.toLowerCase() === 'digitalcore').length}
                </span>
              </button>
              <button
                onClick={() => {
                  setWholesaleProviderFilter('canboso');
                  setWholesaleCategoryFilter('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  wholesaleProviderFilter === 'canboso'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-purple-300" />
                <span>CANBOSO API</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40">
                  {wholesaleCatalog.filter((i) => i.provider?.toLowerCase() === 'canboso').length}
                </span>
              </button>
            </div>

            {/* Search Input & Category Filters */}
            <div className="glass-card-cyber rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search upstream catalog by product name, category folder, or ID..."
                  value={wholesaleSearch}
                  onChange={(e) => setWholesaleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
              </div>

              {/* Upstream Category Folder Chips */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-laser-400" /> UPSTREAM API FOLDERS:
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pt-0.5 pb-1">
                  <button
                    onClick={() => setWholesaleCategoryFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      wholesaleCategoryFilter === 'all'
                        ? 'bg-crimson-600 text-white shadow'
                        : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                    }`}
                  >
                    <span>📁 ALL FOLDERS</span>
                    <span className="text-[10px] opacity-80">
                      ({wholesaleCatalog.filter((i) => wholesaleProviderFilter === 'all' || i.provider?.toLowerCase() === wholesaleProviderFilter.toLowerCase()).length})
                    </span>
                  </button>
                  {wholesaleCategories.map((cat) => {
                    const catCount = wholesaleCatalog.filter(
                      (i) =>
                        (wholesaleProviderFilter === 'all' || i.provider?.toLowerCase() === wholesaleProviderFilter.toLowerCase()) &&
                        i.category?.toLowerCase() === cat.toLowerCase()
                    ).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setWholesaleCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          wholesaleCategoryFilter.toLowerCase() === cat.toLowerCase()
                            ? 'bg-crimson-600 text-white shadow'
                            : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                        }`}
                      >
                        <Folder className="w-3 h-3 opacity-60" />
                        <span>{cat}</span>
                        <span className="text-[10px] opacity-75">({catCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Governance Table */}
            <div className="glass-card-cyber rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-carbon-900 text-zinc-400 font-bold uppercase border-b border-white/10">
                    <tr>
                      <th className="p-4">Product Name & Category</th>
                      <th className="p-4">Provider</th>
                      <th className="p-4">Base Cost</th>
                      <th className="p-4">Cost with Fee</th>
                      <th className="p-4">Minimum Plan Tier</th>
                      <th className="p-4">Global Status</th>
                      <th className="p-4 text-right">Owner Governance Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredWholesale.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500 font-sans">
                          No wholesale products match your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredWholesale.map((p) => {
                        const isGloballyActive = p.is_active_platform !== 0;
                        return (
                          <tr
                            key={p.id}
                            className={`hover:bg-white/[0.02] ${
                              !isGloballyActive ? 'opacity-50 bg-crimson-950/20' : ''
                            }`}
                          >
                            <td className="p-4">
                              <span className="font-bold text-white block">{p.name}</span>
                              <span className="text-[10px] text-zinc-500">
                                {p.category} · {p.id}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-carbon-800 text-zinc-300">
                                {p.provider}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-zinc-400">${p.base_price_usd.toFixed(2)}</td>
                            <td className="p-4 font-bold text-emerald-400">
                              ${p.cost_with_platform_fee_usd.toFixed(2)}
                            </td>
                            <td className="p-4">
                              <select
                                value={p.min_plan_tier || 'starter'}
                                onChange={(e) => handleChangeMinPlanTier(p.id, e.target.value)}
                                className="px-2.5 py-1 rounded bg-carbon-800 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-laser-500"
                              >
                                <option value="starter">Starter (All Merchants)</option>
                                <option value="pro">Pro Plan Only</option>
                                <option value="enterprise">Enterprise Only</option>
                              </select>
                            </td>
                            <td className="p-4">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isGloballyActive
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-crimson-500/20 text-crimson-400'
                                }`}
                              >
                                {isGloballyActive ? 'ENABLED' : 'DELETED / OFF'}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => handleToggleWholesaleStatus(p.id, isGloballyActive ? 1 : 0)}
                                className={`px-2.5 py-1 rounded font-bold text-[10px] ${
                                  isGloballyActive
                                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                    : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                }`}
                              >
                                {isGloballyActive ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleDeleteWholesaleProduct(p.id, p.name)}
                                className="px-2.5 py-1 rounded bg-crimson-500/20 text-crimson-400 hover:bg-crimson-500/30 font-bold text-[10px]"
                                title="Globally remove from all merchants & bots"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 3: PLATFORM MARGIN ENGINE & BINANCE CONFIG
           ========================================== */}
        {godTab === 'config' && (
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
        )}
      </div>
    </div>
  );
};
