import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  CreditCard,
  Wallet,
  Settings,
  Bot,
  LogOut,
  TrendingUp,
  Users,
  Package,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Zap,
  ArrowUpRight,
  Shield,
  Key,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, tenant, token, logout, refreshSession } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'wholesale' | 'deposits' | 'settings'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [wholesaleCatalog, setWholesaleCatalog] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Wholesale Topup Modal
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupInfo, setTopupInfo] = useState<any>(null);
  const [topupTrxId, setTopupTrxId] = useState('');
  const [topupAmountUsd, setTopupAmountUsd] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg, setTopupMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Custom Product Modal
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Streaming');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdKeys, setNewProdKeys] = useState('');
  const [addStockProdId, setAddStockProdId] = useState<string | null>(null);
  const [addStockKeys, setAddStockKeys] = useState('');

  // Settings State
  const [settingsData, setSettingsData] = useState<any>({
    name: '',
    botToken: '',
    usdToBdtRate: 125,
    paymentNumbers: { bkash: '', nagad: '', rocket: '' },
    binanceConfig: { uid: '', apiKey: '', hasSecret: false },
    autoMarkup: { enabled: true, pct: 20, fixedUsd: 0.50 },
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Fetch Overview Data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, productsRes, depositsRes] = await Promise.all([
        axios.get('/api/merchant/overview', authHeaders),
        axios.get('/api/merchant/products', authHeaders),
        axios.get('/api/merchant/deposits', authHeaders),
      ]);
      setOverview(overviewRes.data);
      setProducts(productsRes.data);
      setDeposits(depositsRes.data);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    loadDashboardData();
  }, [token]);

  // Load Wholesale Catalog
  const loadWholesaleCatalog = async () => {
    try {
      const res = await axios.get('/api/merchant/wholesale/catalog', authHeaders);
      setWholesaleCatalog(res.data);
    } catch (err) {
      console.error('Failed to load wholesale catalog:', err);
    }
  };

  // Load Settings
  const loadSettings = async () => {
    try {
      const res = await axios.get('/api/merchant/settings', authHeaders);
      setSettingsData(res.data);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'wholesale') loadWholesaleCatalog();
    if (activeTab === 'settings') loadSettings();
  }, [activeTab]);

  // Open Topup Modal
  const handleOpenTopup = async () => {
    setShowTopupModal(true);
    setTopupMsg(null);
    try {
      const res = await axios.get('/api/merchant/wholesale-wallet/info', authHeaders);
      setTopupInfo(res.data);
    } catch (err) {
      console.error('Failed to load wholesale wallet info:', err);
    }
  };

  // Verify Wholesale Topup
  const handleVerifyTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopupLoading(true);
    setTopupMsg(null);
    try {
      const res = await axios.post(
        '/api/merchant/wholesale-wallet/verify',
        { trxId: topupTrxId, amountUsd: parseFloat(topupAmountUsd) },
        authHeaders
      );
      setTopupMsg({ text: res.data.message, type: 'success' });
      setTopupTrxId('');
      setTopupAmountUsd('');
      loadDashboardData();
      refreshSession();
    } catch (err: any) {
      setTopupMsg({ text: err.response?.data?.error || 'Verification failed', type: 'error' });
    } finally {
      setTopupLoading(false);
    }
  };

  // Approve Deposit
  const handleApproveDeposit = async (id: number) => {
    try {
      await axios.post(`/api/merchant/deposits/${id}/approve`, {}, authHeaders);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Approval failed');
    }
  };

  // Reject Deposit
  const handleRejectDeposit = async (id: number) => {
    const reason = prompt('Enter rejection reason (sent to customer):', 'Incorrect TrxID or amount mismatch');
    if (reason === null) return;
    try {
      await axios.post(`/api/merchant/deposits/${id}/reject`, { reason }, authHeaders);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Rejection failed');
    }
  };

  // Create Custom Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/merchant/products',
        {
          name: newProdName,
          category: newProdCategory,
          retailPriceUsd: parseFloat(newProdPrice),
          inventoryItems: newProdKeys,
        },
        authHeaders
      );
      setShowAddProductModal(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdKeys('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create product');
    }
  };

  // Add more keys to existing product
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStockProdId) return;
    try {
      await axios.post(
        `/api/merchant/products/${addStockProdId}/stock`,
        { itemsText: addStockKeys },
        authHeaders
      );
      setAddStockProdId(null);
      setAddStockKeys('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add stock');
    }
  };

  // Import single wholesale product
  const handleImportWholesale = async (item: any) => {
    const retail = prompt(`Set your retail selling price for "${item.name}" (Wholesale Cost: $${item.cost_with_platform_fee_usd.toFixed(2)} USD):`, (item.cost_with_platform_fee_usd * 1.3).toFixed(2));
    if (!retail) return;

    try {
      await axios.post(
        '/api/merchant/wholesale/import',
        {
          wholesaleProductId: item.id,
          name: item.name,
          category: item.category,
          wholesaleCostUsd: item.cost_with_platform_fee_usd,
          retailPriceUsd: parseFloat(retail),
          provider: item.provider,
        },
        authHeaders
      );
      alert('Product imported successfully to your store catalog!');
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to import product');
    }
  };

  // Bulk Import
  const handleBulkImport = async () => {
    if (!confirm('Auto-import all wholesale items with a default +20% and +$0.50 profit margin?')) return;
    try {
      const res = await axios.post('/api/merchant/wholesale/bulk-enable', { markupPct: 20, markupFixedUsd: 0.50 }, authHeaders);
      alert(`Successfully synchronized ${res.data.count} wholesale products!`);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Bulk import failed');
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put('/api/merchant/settings', {
        storeName: settingsData.name,
        botToken: settingsData.botToken,
        usdToBdtRate: settingsData.usdToBdtRate,
        paymentNumbers: settingsData.paymentNumbers,
        binanceConfig: settingsData.binanceConfig,
        autoMarkup: settingsData.autoMarkup,
      }, authHeaders);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      loadDashboardData();
      refreshSession();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save settings');
    }
  };

  const storeName = overview?.storeName || tenant?.name || 'My Store';
  const botOnline = overview?.botStatus?.is_online;
  const botUsername = overview?.botStatus?.bot_username;

  return (
    <div className="min-h-screen bg-carbon-900 text-zinc-100 flex flex-col">
      {/* ==========================================
          WHITE-LABELED TOP NAVIGATION BAR
         ========================================== */}
      <header className="bg-carbon-900/90 backdrop-blur-xl border-b border-white/10 px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-crimson-600 to-laser-600 flex items-center justify-center font-bold text-white shadow-md">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-white block tracking-tight">
                {storeName}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                Store Dashboard · bot.mogent.tech/{overview?.slug || tenant?.slug}
              </span>
            </div>
          </div>

          {/* Bot Live Pulse Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-carbon-800 border border-white/10 text-xs">
            <span className={`w-2 h-2 rounded-full ${botOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            <span className="text-[11px] font-medium text-zinc-300">
              {botOnline ? `@${botUsername || 'StoreBot'} (Live)` : 'Bot Offline (Add Token)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-zinc-400 bg-carbon-800/80 px-3 py-1.5 rounded-xl border border-white/5">
            <span>Rate:</span>
            <span className="text-white font-bold">$1 = {overview?.usdToBdtRate || 125} ৳</span>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* ==========================================
          MAIN DASHBOARD BODY
         ========================================== */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Overview
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'products'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> Custom Products ({products.filter(p => p.provider === 'custom').length})
          </button>
          <button
            onClick={() => setActiveTab('wholesale')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'wholesale'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" /> Wholesale Reseller Catalog
          </button>
          <button
            onClick={() => setActiveTab('deposits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'deposits'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" /> Deposits
            {overview?.pendingDepositsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-crimson-500 text-white text-[10px] flex items-center justify-center font-bold">
                {overview.pendingDepositsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" /> Settings & Bot Token
          </button>
        </div>

        {/* ==========================================
            TAB 1: OVERVIEW METRIC CARDS
           ========================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* 6 High-Impact Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Card 1: Total Revenue */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-2 relative overflow-hidden">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Total Gross Revenue</span>
                  <div className="p-2 rounded-xl bg-laser-500/10 text-laser-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  ${overview?.totalRevenueUsd?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-400 font-normal">USD</span>
                </div>
                <span className="text-[11px] text-zinc-500 font-mono">
                  ~ ৳ {((overview?.totalRevenueUsd || 0) * (overview?.usdToBdtRate || 125)).toLocaleString()} BDT
                </span>
              </div>

              {/* Card 2: Net Profit */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-2 relative overflow-hidden">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Net Store Profit</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-emerald-400 font-mono">
                  ${overview?.totalProfitUsd?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-400 font-normal">USD</span>
                </div>
                <span className="text-[11px] text-zinc-500 font-mono">
                  ~ ৳ {((overview?.totalProfitUsd || 0) * (overview?.usdToBdtRate || 125)).toLocaleString()} BDT
                </span>
              </div>

              {/* Card 3: Wholesale Wallet Balance */}
              <div className="glass-card rounded-2xl p-6 border border-crimson-500/30 bg-gradient-to-br from-carbon-800 to-carbon-850 space-y-2 relative shadow-lg shadow-crimson-500/5">
                <div className="flex justify-between items-center text-xs text-zinc-300 font-medium">
                  <span>Wholesale Balance</span>
                  <button
                    onClick={handleOpenTopup}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-crimson-500 hover:bg-crimson-400 text-white text-[11px] font-bold shadow-sm active:scale-95 transition-all"
                  >
                    <Zap className="w-3 h-3" /> Top Up
                  </button>
                </div>
                <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-crimson-400 to-white font-mono">
                  ${overview?.walletUsd?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-400 font-normal">USD</span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Used for automated DigitalCore & Canboso wholesale orders
                </span>
              </div>

              {/* Card 4: Total Orders */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Completed Orders</span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {overview?.totalOrders || 0}
                </div>
                <span className="text-[11px] text-zinc-500">Instant digital automated deliveries</span>
              </div>

              {/* Card 5: Telegram Customers */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Telegram Customers</span>
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {overview?.totalCustomers || 0}
                </div>
                <span className="text-[11px] text-zinc-500">Unique shoppers in your Telegram bot</span>
              </div>

              {/* Card 6: Pending Deposits */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Pending Deposits</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-amber-400 font-mono">
                  {overview?.pendingDepositsCount || 0}
                </div>
                <button
                  onClick={() => setActiveTab('deposits')}
                  className="text-[11px] text-laser-400 hover:underline block"
                >
                  Review and approve deposits &rarr;
                </button>
              </div>
            </div>

            {/* Quick Action Banner */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-carbon-800/80 to-carbon-850/80">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-xl font-bold text-white">Need to sell custom accounts or serial codes?</h3>
                <p className="text-xs text-zinc-400 max-w-xl">
                  Add your own digital products and paste accounts line-by-line. The bot will automatically pop and deliver them instantly upon customer checkout.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs shadow-md shadow-crimson-500/25 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Custom Product
                </button>
                <button
                  onClick={() => setActiveTab('wholesale')}
                  className="px-5 py-3 rounded-xl bg-carbon-700 hover:bg-carbon-600 border border-white/10 text-white font-bold text-xs flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-laser-400" /> Browse Wholesale
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: CUSTOM PRODUCTS & STOCK
           ========================================== */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Custom Digital Products</h3>
                <p className="text-xs text-zinc-400">Manage your own digital licenses, logins, and accounts</p>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs flex items-center gap-2 shadow-md"
              >
                <Plus className="w-4 h-4" /> Add Custom Product
              </button>
            </div>

            {/* Products Table */}
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-carbon-800/80 text-zinc-400 font-semibold uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Provider</th>
                      <th className="p-4">Retail Price (USD)</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500">
                          Your catalog is completely clean and empty. Click "Add Custom Product" or import from wholesale to get started.
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4 font-semibold text-white">{p.name}</td>
                          <td className="p-4 text-zinc-400">{p.category}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${p.provider === 'custom' ? 'bg-purple-500/20 text-purple-300' : 'bg-laser-500/20 text-laser-300'}`}>
                              {p.provider}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-400">${Number(p.retail_price_usd).toFixed(2)}</td>
                          <td className="p-4 font-mono">{p.stock} items</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'}`}>
                              {p.is_active ? 'ACTIVE' : 'DISABLED'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {p.provider === 'custom' && (
                              <button
                                onClick={() => setAddStockProdId(p.id)}
                                className="px-2.5 py-1 rounded-lg bg-carbon-700 hover:bg-carbon-600 text-white font-semibold text-[11px]"
                              >
                                + Add Stock
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                if (confirm(`Delete "${p.name}"?`)) {
                                  await axios.delete(`/api/merchant/products/${p.id}`, authHeaders);
                                  loadDashboardData();
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-crimson-500/20 text-crimson-400 hover:bg-crimson-500/30 text-[11px]"
                            >
                              Delete
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
            TAB 3: WHOLESALE RESELLER CATALOG
           ========================================== */}
        {activeTab === 'wholesale' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-crimson-400" /> Upstream Wholesale Products
                </h3>
                <p className="text-xs text-zinc-400">
                  Sourced live from DigitalCore & Canboso with platform wholesale fee included.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBulkImport}
                  className="px-4 py-2 rounded-xl bg-laser-600 hover:bg-laser-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Auto-Import All (+20% Margin)
                </button>
                <button
                  onClick={loadWholesaleCatalog}
                  className="p-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Wholesale Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {wholesaleCatalog.length === 0 ? (
                <div className="col-span-3 glass-card rounded-2xl p-12 text-center text-zinc-500 space-y-3">
                  <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p>No wholesale products available yet or API keys are being synchronized.</p>
                </div>
              ) : (
                wholesaleCatalog.map((item) => (
                  <div key={item.id} className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-carbon-800 text-zinc-400 uppercase">
                          {item.provider}
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">
                          In Stock ({item.stock})
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white">{item.name}</h4>
                      <div className="text-xs text-zinc-400">Category: {item.category}</div>
                    </div>

                    <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-zinc-500 block">Wholesale Cost:</span>
                        <span className="font-mono text-base font-bold text-white">
                          ${item.cost_with_platform_fee_usd.toFixed(2)} USD
                        </span>
                      </div>
                      <button
                        onClick={() => handleImportWholesale(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Import
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: DEPOSITS APPROVAL
           ========================================== */}
        {activeTab === 'deposits' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Customer Deposit Requests</h3>
                <p className="text-xs text-zinc-400">bKash, Nagad, Rocket, and automated Binance Pay deposits</p>
              </div>
              <button
                onClick={loadDashboardData}
                className="p-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-carbon-800/80 text-zinc-400 font-semibold uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Method</th>
                      <th className="p-4">BDT Sent</th>
                      <th className="p-4">USD Credited</th>
                      <th className="p-4">TrxID</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deposits.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-500">
                          No deposit requests found yet.
                        </td>
                      </tr>
                    ) : (
                      deposits.map((d) => (
                        <tr key={d.id} className="hover:bg-white/[0.02]">
                          <td className="p-4">
                            <span className="font-semibold text-white block">
                              {d.customer_username ? `@${d.customer_username}` : d.customer_telegram_id}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">ID: {d.customer_telegram_id}</span>
                          </td>
                          <td className="p-4 font-semibold text-zinc-300">{d.method}</td>
                          <td className="p-4 font-mono font-bold text-white">{d.amount_bdt} ৳</td>
                          <td className="p-4 font-mono font-bold text-emerald-400">${Number(d.amount_usd).toFixed(2)}</td>
                          <td className="p-4 font-mono text-zinc-300 select-all bg-carbon-800 px-2 py-1 rounded inline-block">
                            {d.trx_id}
                          </td>
                          <td className="p-4 text-zinc-500 text-[10px]">{d.created_at}</td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                d.status === 'APPROVED'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : d.status === 'PENDING'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-crimson-500/20 text-crimson-400'
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {d.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleApproveDeposit(d.id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectDeposit(d.id)}
                                  className="px-3 py-1.5 rounded-lg bg-carbon-700 hover:bg-carbon-600 text-crimson-400 font-bold text-[11px]"
                                >
                                  Reject
                                </button>
                              </>
                            )}
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
            TAB 5: SETTINGS
           ========================================== */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
            {settingsSaved && (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Settings saved and Telegram bot reloaded successfully!
              </div>
            )}

            {/* Section 1: Telegram Bot Token */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-crimson-400" /> Telegram Bot Configuration
              </h4>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Telegram Bot Token</label>
                <input
                  type="text"
                  placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  value={settingsData.botToken}
                  onChange={(e) => setSettingsData({ ...settingsData, botToken: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-crimson-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Get this from @BotFather on Telegram.</p>
              </div>
            </div>

            {/* Section 2: Local Payment Numbers */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-laser-400" /> Local Payment Numbers (Personal)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">bKash Number</label>
                  <input
                    type="text"
                    placeholder="017xxxxxxxx"
                    value={settingsData.paymentNumbers?.bkash || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        paymentNumbers: { ...settingsData.paymentNumbers, bkash: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nagad Number</label>
                  <input
                    type="text"
                    placeholder="018xxxxxxxx"
                    value={settingsData.paymentNumbers?.nagad || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        paymentNumbers: { ...settingsData.paymentNumbers, nagad: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Rocket Number</label>
                  <input
                    type="text"
                    placeholder="019xxxxxxxx"
                    value={settingsData.paymentNumbers?.rocket || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        paymentNumbers: { ...settingsData.paymentNumbers, rocket: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">1 USD to BDT Conversion Rate</label>
                <div className="flex items-center gap-2 max-w-xs">
                  <span className="text-xs text-zinc-400 font-mono">$1.00 USD = </span>
                  <input
                    type="number"
                    value={settingsData.usdToBdtRate}
                    onChange={(e) => setSettingsData({ ...settingsData, usdToBdtRate: parseFloat(e.target.value) })}
                    className="w-24 px-3 py-1.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-laser-500"
                  />
                  <span className="text-xs text-zinc-400">৳ BDT</span>
                </div>
              </div>
            </div>

            {/* Section 3: Merchant's Own Isolated Binance Pay */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" /> Isolated Binance Pay (Instant Auto-Crediting)
              </h4>
              <p className="text-xs text-zinc-400">
                Configure your own Binance Pay UID & Read-Only API Key so customers can pay USDT directly to your Binance wallet.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Binance Pay UID</label>
                  <input
                    type="text"
                    placeholder="e.g. 198273645"
                    value={settingsData.binanceConfig?.uid || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        binanceConfig: { ...settingsData.binanceConfig, uid: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Binance Read-Only API Key</label>
                  <input
                    type="text"
                    placeholder="Enter API Key"
                    value={settingsData.binanceConfig?.apiKey || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        binanceConfig: { ...settingsData.binanceConfig, apiKey: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Binance API Secret {settingsData.binanceConfig?.hasSecret && '(Secret already configured)'}
                  </label>
                  <input
                    type="password"
                    placeholder="Enter API Secret"
                    value={settingsData.binanceConfig?.apiSecret || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        binanceConfig: { ...settingsData.binanceConfig, apiSecret: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs shadow-lg shadow-crimson-500/25 active:scale-95 transition-all"
            >
              Save All Settings
            </button>
          </form>
        )}
      </div>

      {/* ==========================================
          MODAL 1: WHOLESALE WALLET TOP-UP (TIER 2)
         ========================================== */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card-cyber rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 border border-crimson-500/40 relative">
            <button
              onClick={() => setShowTopupModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-crimson-500/20 text-crimson-400 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Top Up Wholesale Balance</h3>
                <span className="text-xs text-zinc-400">Automated Binance Pay Deposit</span>
              </div>
            </div>

            {topupMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold ${
                  topupMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-crimson-500/20 text-crimson-400'
                }`}
              >
                {topupMsg.text}
              </div>
            )}

            <div className="bg-carbon-900/90 p-4 rounded-2xl border border-white/10 space-y-2">
              <span className="text-[11px] text-zinc-400 block font-semibold">1. Send USDT to Platform Owner UID:</span>
              <div className="flex items-center justify-between bg-carbon-800 p-2.5 rounded-xl font-mono text-xs text-white">
                <span className="font-bold text-laser-400 select-all">{topupInfo?.platformOwnerBinanceUid}</span>
                <span className="text-[10px] text-zinc-400">Binance Pay</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Open Binance App &rarr; Pay &rarr; Send &rarr; Enter UID above and transfer USDT.
              </p>
            </div>

            <form onSubmit={handleVerifyTopup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Amount Sent (USDT)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 20"
                  value={topupAmountUsd}
                  onChange={(e) => setTopupAmountUsd(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Transaction ID / Order ID</label>
                <input
                  type="text"
                  required
                  placeholder="Paste 17-digit TxID from Binance"
                  value={topupTrxId}
                  onChange={(e) => setTopupTrxId(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-crimson-500"
                />
              </div>

              <button
                type="submit"
                disabled={topupLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs shadow-lg shadow-crimson-500/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
              >
                {topupLoading ? 'Verifying with Binance...' : 'Verify & Credit Balance Instant ⚡'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: ADD CUSTOM PRODUCT
         ========================================== */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-4 border border-white/10 relative">
            <button
              onClick={() => setShowAddProductModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-white">Create Custom Product</h3>

            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix 4K UHD 1 Month Shared"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Retail Price ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="2.50"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Initial Inventory Stock (1 Item / Serial Key per line)
                </label>
                <textarea
                  rows={4}
                  placeholder={`user1:pass1:netflix@mail.com\nuser2:pass2:netflix2@mail.com\nKEY-XXXX-YYYY-ZZZZ`}
                  value={newProdKeys}
                  onChange={(e) => setNewProdKeys(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-crimson-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 text-white font-bold text-xs shadow-md"
              >
                Create Product & Save Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: ADD STOCK KEYS
         ========================================== */}
      {addStockProdId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 border border-white/10 relative">
            <button
              onClick={() => setAddStockProdId(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-white">Add Stock Items</h3>
            <p className="text-xs text-zinc-400">Paste digital serials, links or accounts (one per line):</p>

            <form onSubmit={handleAddStock} className="space-y-3">
              <textarea
                rows={5}
                required
                placeholder={`SERIAL-KEY-001\nSERIAL-KEY-002`}
                value={addStockKeys}
                onChange={(e) => setAddStockKeys(e.target.value)}
                className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-crimson-500"
              />

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs shadow-md"
              >
                Append to Inventory
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
