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
  Folder,
  FolderPlus,
  Search,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, tenant, token, logout, refreshSession } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'custom_products' | 'wholesale' | 'store_products' | 'deposits' | 'settings'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [wholesaleCatalog, setWholesaleCatalog] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [storeFilter, setStoreFilter] = useState<'all' | 'custom' | 'wholesale'>('all');
  const [wholesaleSearch, setWholesaleSearch] = useState('');
  const [wholesaleCategoryFilter, setWholesaleCategoryFilter] = useState('all');

  // Wholesale Topup Modal
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [topupInfo, setTopupInfo] = useState<any>(null);
  const [topupTrxId, setTopupTrxId] = useState('');
  const [topupAmountUsd, setTopupAmountUsd] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg, setTopupMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Group Management Modal
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('🎬');
  const [newGroupSortOrder, setNewGroupSortOrder] = useState('0');

  // New Custom Product Modal
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Streaming');
  const [newProdGroupId, setNewProdGroupId] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdKeys, setNewProdKeys] = useState('');
  const [addStockProdId, setAddStockProdId] = useState<string | null>(null);
  const [addStockKeys, setAddStockKeys] = useState('');

  // Wholesale Import Modal
  const [importModalItem, setImportModalItem] = useState<any | null>(null);
  const [importGroupId, setImportGroupId] = useState('');
  const [importRetailPrice, setImportRetailPrice] = useState('');
  const [importLoading, setImportLoading] = useState(false);

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

  // Fetch Dashboard Core Data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, productsRes, groupsRes, depositsRes] = await Promise.all([
        axios.get('/api/merchant/overview', authHeaders),
        axios.get('/api/merchant/products', authHeaders),
        axios.get('/api/merchant/groups', authHeaders),
        axios.get('/api/merchant/deposits', authHeaders),
      ]);
      setOverview(overviewRes.data);
      setProducts(productsRes.data);
      setGroups(groupsRes.data);
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

  const loadGroups = async () => {
    try {
      const res = await axios.get('/api/merchant/groups', authHeaders);
      setGroups(res.data);
    } catch (err) {
      console.error('Failed to load groups:', err);
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
    if (activeTab === 'groups') loadGroups();
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

  // 1-Click Product ON/OFF Toggle
  const handleToggleProduct = async (productId: string, currentActive: number) => {
    try {
      const res = await axios.patch(`/api/merchant/products/${productId}/toggle`, {}, authHeaders);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: res.data.is_active } : p))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to toggle product status');
    }
  };

  // Group Management Handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await axios.post(
        '/api/merchant/groups',
        {
          name: newGroupName.trim(),
          icon: newGroupIcon.trim() || '📁',
          sortOrder: parseInt(newGroupSortOrder) || 0,
        },
        authHeaders
      );
      setNewGroupName('');
      setNewGroupIcon('🎬');
      setNewGroupSortOrder('0');
      setShowAddGroupModal(false);
      loadGroups();
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create category');
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Delete category "${groupName}"? Products in this folder will be unassigned safely.`)) return;
    try {
      await axios.delete(`/api/merchant/groups/${groupId}`, authHeaders);
      loadGroups();
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete category');
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
          groupId: newProdGroupId || null,
          retailPriceUsd: parseFloat(newProdPrice),
          inventoryItems: newProdKeys,
        },
        authHeaders
      );
      setShowAddProductModal(false);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdKeys('');
      setNewProdGroupId('');
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create product');
    }
  };

  // Add stock keys to existing product
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

  // Delete product
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Delete "${productName}" from your store?`)) return;
    try {
      await axios.delete(`/api/merchant/products/${productId}`, authHeaders);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete product');
    }
  };

  // Open Wholesale Import Modal
  const handleOpenImportModal = (item: any) => {
    setImportModalItem(item);
    // Suggest 30% margin by default
    const suggestedPrice = (item.cost_with_platform_fee_usd * 1.30).toFixed(2);
    setImportRetailPrice(suggestedPrice);
    setImportGroupId('');
  };

  // Confirm Wholesale Import
  const handleConfirmImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importModalItem) return;
    setImportLoading(true);
    try {
      await axios.post(
        '/api/merchant/wholesale/import',
        {
          wholesaleProductId: importModalItem.id,
          name: importModalItem.name,
          category: importModalItem.category,
          wholesaleCostUsd: importModalItem.cost_with_platform_fee_usd,
          retailPriceUsd: parseFloat(importRetailPrice),
          provider: importModalItem.provider,
          groupId: importGroupId || null,
        },
        authHeaders
      );
      setImportModalItem(null);
      loadDashboardData();
      alert('Product imported successfully to your store catalog!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to import product');
    } finally {
      setImportLoading(false);
    }
  };

  // Bulk Import
  const handleBulkImport = async () => {
    if (!confirm('Auto-import all available wholesale items with a default +20% and +$0.50 profit margin?')) return;
    try {
      const res = await axios.post('/api/merchant/wholesale/bulk-enable', { markupPct: 20, markupFixedUsd: 0.50 }, authHeaders);
      alert(`Successfully synchronized ${res.data.count} wholesale products!`);
      loadDashboardData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Bulk import failed');
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

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put(
        '/api/merchant/settings',
        {
          storeName: settingsData.name,
          botToken: settingsData.botToken,
          usdToBdtRate: settingsData.usdToBdtRate,
          paymentNumbers: settingsData.paymentNumbers,
          binanceConfig: settingsData.binanceConfig,
          autoMarkup: settingsData.autoMarkup,
        },
        authHeaders
      );
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

  // Filtered Products for Active Store Tab
  const activeStoreProducts = products.filter((p) => {
    if (storeFilter === 'custom') return p.provider === 'custom';
    if (storeFilter === 'wholesale') return p.provider !== 'custom';
    return true;
  });

  // Filtered Wholesale Catalog
  const filteredWholesale = wholesaleCatalog.filter((item) => {
    const matchSearch =
      wholesaleSearch === '' ||
      item.name.toLowerCase().includes(wholesaleSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(wholesaleSearch.toLowerCase()) ||
      item.provider.toLowerCase().includes(wholesaleSearch.toLowerCase());

    const matchCategory =
      wholesaleCategoryFilter === 'all' ||
      item.category.toLowerCase() === wholesaleCategoryFilter.toLowerCase();

    return matchSearch && matchCategory;
  });

  // Unique wholesale categories for filter chips
  const wholesaleCategories = Array.from(new Set(wholesaleCatalog.map((i) => i.category))).filter(Boolean);

  return (
    <div className="min-h-screen bg-carbon-900 text-zinc-100 flex flex-col">
      {/* ==========================================
          TOP NAVIGATION BAR
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
        {/* Navigation Tabs (7 Focused Lenses) */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" /> Overview
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'groups'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Folder className="w-4 h-4" /> Categories & Folders ({groups.length})
          </button>

          <button
            onClick={() => setActiveTab('custom_products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'custom_products'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" /> Custom Accounts ({products.filter((p) => p.provider === 'custom').length})
          </button>

          <button
            onClick={() => setActiveTab('wholesale')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'wholesale'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" /> Wholesale Sourcing
          </button>

          <button
            onClick={() => setActiveTab('store_products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'store_products'
                ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> My Active Store ({products.length})
          </button>

          <button
            onClick={() => setActiveTab('deposits')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap relative ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
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
                <span className="text-[11px] text-zinc-400 font-mono">
                  Auto-deducted on wholesale orders
                </span>
              </div>

              {/* Card 4: Total Orders */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Total Delivered Orders</span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {overview?.totalOrders || 0}
                </div>
                <span className="text-[11px] text-zinc-500">Autonomous instant fulfillment</span>
              </div>

              {/* Card 5: Customers */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs text-zinc-400 font-medium">
                  <span>Total Registered Customers</span>
                  <div className="p-2 rounded-xl bg-laser-500/10 text-laser-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white font-mono">
                  {overview?.totalCustomers || 0}
                </div>
                <span className="text-[11px] text-zinc-500">Active Telegram users</span>
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
                  className="text-[11px] text-crimson-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Review Deposits &rarr;
                </button>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-carbon-800/80 to-carbon-850/80">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-xl font-bold text-white">Scale your Telegram Store in 2 Taps</h3>
                <p className="text-xs text-zinc-400 max-w-xl">
                  Create clean categories (e.g. 🎬 OTT, 🛡️ VPN), import wholesale products or add custom accounts. Customers browse smoothly by folders in Telegram.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowAddGroupModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-laser-600 hover:bg-laser-500 text-white font-bold text-xs shadow-md flex items-center gap-2"
                >
                  <FolderPlus className="w-4 h-4" /> New Category
                </button>
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs shadow-md flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Custom Product
                </button>
                <button
                  onClick={() => setActiveTab('wholesale')}
                  className="px-4 py-2.5 rounded-xl bg-carbon-700 hover:bg-carbon-600 border border-white/10 text-white font-bold text-xs flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-laser-400" /> Sourcing Catalog
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: CATEGORIES & GROUPS MANAGER
           ========================================== */}
        {activeTab === 'groups' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Folder className="w-5 h-5 text-laser-400" /> Custom Categories & Folders
                </h3>
                <p className="text-xs text-zinc-400">
                  When customers tap "🛍️ Products" in Telegram, these folders appear first. Tapping a folder reveals its products!
                </p>
              </div>
              <button
                onClick={() => setShowAddGroupModal(true)}
                className="px-4 py-2.5 rounded-xl bg-laser-600 hover:bg-laser-500 text-white font-bold text-xs flex items-center gap-2 shadow-md self-start sm:self-auto"
              >
                <FolderPlus className="w-4 h-4" /> Add Category / Group
              </button>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {groups.length === 0 ? (
                <div className="col-span-full glass-card rounded-2xl p-12 text-center text-zinc-500 space-y-3">
                  <Folder className="w-10 h-10 text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-300">No categories created yet.</p>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    Create categories like 🎬 Streaming, 🛡️ VPN, or 🎮 Gaming to organize your bot menu into a smooth 2-tap customer experience.
                  </p>
                  <button
                    onClick={() => setShowAddGroupModal(true)}
                    className="px-4 py-2 rounded-xl bg-laser-600 hover:bg-laser-500 text-white text-xs font-bold shadow-md inline-flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-4 h-4" /> Create First Category
                  </button>
                </div>
              ) : (
                groups.map((g) => (
                  <div
                    key={g.id}
                    className="glass-card rounded-2xl p-5 border border-white/10 hover:border-laser-500/40 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl p-2 rounded-xl bg-carbon-800 border border-white/5">
                          {g.icon || '📁'}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-white">{g.name}</h4>
                          <span className="text-[11px] text-zinc-400">
                            {g.product_count || 0} active products
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteGroup(g.id, g.name)}
                        className="text-zinc-500 hover:text-crimson-400 p-1.5 rounded-lg hover:bg-crimson-500/10 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>Order Priority: #{g.sort_order || 0}</span>
                      <span className="font-mono text-zinc-400">ID: {g.id}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 3: CUSTOM INVENTORY (PURE CUSTOM)
           ========================================== */}
        {activeTab === 'custom_products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-400" /> Custom Digital Stock & Accounts
                </h3>
                <p className="text-xs text-zinc-400">
                  Manage your manually stocked digital accounts, license keys, and serial codes.
                </p>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-4 py-2.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs flex items-center gap-2 shadow-md self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Add Custom Product
              </button>
            </div>

            {/* Custom Products Table */}
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-carbon-800/80 text-zinc-400 font-semibold uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Category / Folder</th>
                      <th className="p-4">Retail Price (USD)</th>
                      <th className="p-4">Stock Remaining</th>
                      <th className="p-4">Bot Availability</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.filter((p) => p.provider === 'custom').length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-zinc-500">
                          No custom accounts added yet. Click "Add Custom Product" to add your own serial keys.
                        </td>
                      </tr>
                    ) : (
                      products
                        .filter((p) => p.provider === 'custom')
                        .map((p) => (
                          <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-4">
                              <span className="font-semibold text-white block">{p.name}</span>
                              <span className="text-[10px] text-zinc-500 font-mono">ID: {p.id}</span>
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-lg text-xs bg-carbon-800 border border-white/5 text-zinc-300 inline-flex items-center gap-1.5 font-medium">
                                <span>{p.group_icon || '📁'}</span>
                                <span>{p.group_name || p.category || 'General'}</span>
                              </span>
                            </td>
                            <td className="p-4 font-mono font-bold text-emerald-400">
                              ${Number(p.retail_price_usd).toFixed(2)} USD
                              <span className="block text-[10px] text-zinc-500 font-normal">
                                ~ ৳ {(Number(p.retail_price_usd) * (overview?.usdToBdtRate || 125)).toFixed(0)} BDT
                              </span>
                            </td>
                            <td className="p-4 font-mono">
                              <span className={`font-bold ${p.stock > 0 ? 'text-white' : 'text-crimson-400'}`}>
                                {p.stock} accounts
                              </span>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleToggleProduct(p.id, p.is_active)}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                                  p.is_active
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                                }`}
                                title="Click to toggle ON/OFF in bot"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-400' : 'bg-zinc-500'}`}></span>
                                {p.is_active ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
                              </button>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <button
                                onClick={() => setAddStockProdId(p.id)}
                                className="px-2.5 py-1 rounded-lg bg-carbon-700 hover:bg-carbon-600 text-white font-semibold text-[11px]"
                              >
                                + Add Stock
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id, p.name)}
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
            TAB 4: WHOLESALE SOURCING (SEARCH & DISCOVER)
           ========================================== */}
        {activeTab === 'wholesale' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-crimson-400" /> Upstream Wholesale Products
                </h3>
                <p className="text-xs text-zinc-400">
                  Search live upstream products from DigitalCore & Canboso. Import with 1 click to your bot!
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
                  title="Refresh Catalog"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search Input & Category Filters */}
            <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Instant Search wholesale catalog (e.g. Netflix, Spotify, VPN, Canva, Telegram Premium)..."
                  value={wholesaleSearch}
                  onChange={(e) => setWholesaleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
                />
                {wholesaleSearch && (
                  <button
                    onClick={() => setWholesaleSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                <button
                  onClick={() => setWholesaleCategoryFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    wholesaleCategoryFilter === 'all'
                      ? 'bg-crimson-500 text-white'
                      : 'bg-carbon-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  All Categories ({wholesaleCatalog.length})
                </button>
                {wholesaleCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setWholesaleCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      wholesaleCategoryFilter.toLowerCase() === cat.toLowerCase()
                        ? 'bg-crimson-500 text-white'
                        : 'bg-carbon-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Wholesale Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredWholesale.length === 0 ? (
                <div className="col-span-full glass-card rounded-2xl p-12 text-center text-zinc-500 space-y-3">
                  <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-white font-semibold">No matching wholesale products found.</p>
                  <p className="text-xs text-zinc-400">
                    Try adjusting your search query or check if upstream API keys are active.
                  </p>
                </div>
              ) : (
                filteredWholesale.map((item) => (
                  <div
                    key={item.id}
                    className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all"
                  >
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
                        onClick={() => handleOpenImportModal(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Import to Bot
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: MY ACTIVE STORE (ALL BOT PRODUCTS & 1-CLICK TOGGLE)
           ========================================== */}
        {activeTab === 'store_products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" /> My Active Store & Bot Items
                </h3>
                <p className="text-xs text-zinc-400">
                  Every product currently available in your Telegram bot. Use 1-Click Toggle to turn items ON or OFF instantly.
                </p>
              </div>

              {/* Sub-Filter Pills */}
              <div className="flex items-center gap-2 bg-carbon-800 p-1 rounded-xl border border-white/5">
                <button
                  onClick={() => setStoreFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    storeFilter === 'all' ? 'bg-crimson-500 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  All ({products.length})
                </button>
                <button
                  onClick={() => setStoreFilter('custom')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    storeFilter === 'custom' ? 'bg-crimson-500 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Custom ({products.filter((p) => p.provider === 'custom').length})
                </button>
                <button
                  onClick={() => setStoreFilter('wholesale')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    storeFilter === 'wholesale' ? 'bg-crimson-500 text-white' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Wholesale ({products.filter((p) => p.provider !== 'custom').length})
                </button>
              </div>
            </div>

            {/* Products Master Table */}
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-carbon-800/80 text-zinc-400 font-semibold uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Category / Group</th>
                      <th className="p-4">Source Type</th>
                      <th className="p-4">Selling Price (USD)</th>
                      <th className="p-4">Stock</th>
                      <th className="p-4">Bot Status (1-Click Toggle)</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeStoreProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500">
                          No products found in this filter.
                        </td>
                      </tr>
                    ) : (
                      activeStoreProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <span className="font-semibold text-white block">{p.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono">ID: {p.id}</span>
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs bg-carbon-800 border border-white/5 text-zinc-300 inline-flex items-center gap-1.5 font-medium">
                              <span>{p.group_icon || '📁'}</span>
                              <span>{p.group_name || p.category || 'General'}</span>
                            </span>
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                p.provider === 'custom'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : 'bg-laser-500/20 text-laser-300'
                              }`}
                            >
                              {p.provider === 'custom' ? 'Custom Stock' : `Wholesale (${p.provider})`}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-400">
                            ${Number(p.retail_price_usd).toFixed(2)} USD
                            <span className="block text-[10px] text-zinc-500 font-normal">
                              ~ ৳ {(Number(p.retail_price_usd) * (overview?.usdToBdtRate || 125)).toFixed(0)} BDT
                            </span>
                          </td>
                          <td className="p-4 font-mono">
                            {p.provider === 'custom' ? `${p.stock} keys` : 'Live API (Auto)'}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleToggleProduct(p.id, p.is_active)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                                p.is_active
                                  ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'
                                  : 'bg-zinc-800/80 text-zinc-500 hover:bg-zinc-800 border border-zinc-700'
                              }`}
                              title="Click to toggle product live on your bot"
                            >
                              {p.is_active ? (
                                <>
                                  <ToggleRight className="w-4 h-4 text-emerald-400" />
                                  <span>LIVE IN BOT</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="w-4 h-4 text-zinc-500" />
                                  <span>TURNED OFF</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="p-4 text-right space-x-2">
                            {p.provider === 'custom' && (
                              <button
                                onClick={() => setAddStockProdId(p.id)}
                                className="px-2.5 py-1 rounded-lg bg-carbon-700 hover:bg-carbon-600 text-white font-semibold text-[11px]"
                              >
                                + Stock
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
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
            TAB 6: DEPOSITS APPROVAL
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
                                  : d.status === 'REJECTED'
                                  ? 'bg-crimson-500/20 text-crimson-400'
                                  : 'bg-amber-500/20 text-amber-300 animate-pulse'
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
                                  className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-[11px] shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectDeposit(d.id)}
                                  className="px-2.5 py-1 rounded bg-crimson-500/20 text-crimson-400 hover:bg-crimson-500/30 font-bold text-[11px]"
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
            TAB 7: STORE SETTINGS & BOT TOKEN
           ========================================== */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Store & Payment Engine Settings</h3>
                <p className="text-xs text-zinc-400">Configure your Telegram bot token, exchange rates, and receiving payment accounts.</p>
              </div>
              {settingsSaved && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Settings Saved!
                </span>
              )}
            </div>

            {/* Telegram Bot Token Card */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h4 className="text-xs font-mono font-bold text-laser-400 uppercase">1. Telegram Bot Token Setup</h4>
              <p className="text-xs text-zinc-400">
                Create a bot using @BotFather in Telegram and paste your HTTP API token below.
              </p>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Bot Token</label>
                <input
                  type="text"
                  placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                  value={settingsData.botToken}
                  onChange={(e) => setSettingsData({ ...settingsData, botToken: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                />
              </div>
            </div>

            {/* Currency & Exchange Rate Card */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h4 className="text-xs font-mono font-bold text-emerald-400 uppercase">2. BDT / USD Exchange Rate</h4>
              <p className="text-xs text-zinc-400">
                Base ledger is 100% USD ($). Customers paying via bKash/Nagad see conversions using this rate.
              </p>
              <div className="max-w-xs">
                <label className="block text-xs font-semibold text-zinc-300 mb-1">$1.00 USD Equivalent in BDT (৳)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settingsData.usdToBdtRate}
                  onChange={(e) => setSettingsData({ ...settingsData, usdToBdtRate: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Local Mobile Banking Numbers (bKash/Nagad/Rocket) */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <h4 className="text-xs font-mono font-bold text-crimson-400 uppercase">3. Local Payment Numbers (Manual Verify)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">bKash Personal</label>
                  <input
                    type="text"
                    placeholder="01XXXXXXXXX"
                    value={settingsData.paymentNumbers?.bkash || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        paymentNumbers: { ...settingsData.paymentNumbers, bkash: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nagad Personal</label>
                  <input
                    type="text"
                    placeholder="01XXXXXXXXX"
                    value={settingsData.paymentNumbers?.nagad || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        paymentNumbers: { ...settingsData.paymentNumbers, nagad: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Rocket Personal</label>
                  <input
                    type="text"
                    placeholder="01XXXXXXXXX"
                    value={settingsData.paymentNumbers?.rocket || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        paymentNumbers: { ...settingsData.paymentNumbers, rocket: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs shadow-lg shadow-crimson-500/30 transition-all"
            >
              Save Store Configuration
            </button>
          </form>
        )}
      </div>

      {/* ==========================================
          MODAL 1: WHOLESALE TOPUP (WALLET)
         ========================================== */}
      {showTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 border border-white/10 relative">
            <button
              onClick={() => setShowTopupModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-crimson-400 font-bold text-base">
              <Zap className="w-5 h-5" /> Top Up Wholesale Wallet
            </div>

            <p className="text-xs text-zinc-400">
              Transfer USDT to the platform owner via Binance Pay. Enter the 17-digit Transaction ID for automated verification.
            </p>

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
          MODAL 2: ADD CATEGORY / GROUP
         ========================================== */}
      {showAddGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 border border-white/10 relative">
            <button
              onClick={() => setShowAddGroupModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-laser-400 font-bold text-base">
              <FolderPlus className="w-5 h-5" /> Create Custom Category / Folder
            </div>
            <p className="text-xs text-zinc-400">
              Group your products into clean folders so your Telegram bot displays them in a 2-tap menu.
            </p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Icon/Emoji</label>
                  <input
                    type="text"
                    required
                    value={newGroupIcon}
                    onChange={(e) => setNewGroupIcon(e.target.value)}
                    className="w-full px-3 py-2 text-center rounded-xl bg-carbon-800 border border-white/10 text-white text-lg focus:outline-none focus:border-laser-500"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 🎬 Streaming / OTT"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-laser-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Display Sort Order</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newGroupSortOrder}
                  onChange={(e) => setNewGroupSortOrder(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-laser-500"
                />
                <span className="text-[10px] text-zinc-500">Lower numbers appear first in the Telegram bot menu.</span>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-laser-600 hover:bg-laser-500 text-white font-bold text-xs shadow-md transition-all active:scale-98"
              >
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: ADD CUSTOM PRODUCT
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
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Assign to Category / Folder</label>
                  <select
                    value={newProdGroupId}
                    onChange={(e) => setNewProdGroupId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                  >
                    <option value="">📁 General (Unassigned)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.icon || '📁'} {g.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Retail Selling Price ($ USD)</label>
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
          MODAL 4: ADD STOCK KEYS
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

      {/* ==========================================
          MODAL 5: IMPORT WHOLESALE PRODUCT WITH GROUP
         ========================================== */}
      {importModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 border border-white/10 relative">
            <button
              onClick={() => setImportModalItem(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-crimson-400 font-bold text-base">
              <Plus className="w-5 h-5" /> Import to Your Telegram Store
            </div>

            <div className="bg-carbon-800/80 p-4 rounded-2xl border border-white/5 space-y-2">
              <h4 className="font-bold text-sm text-white">{importModalItem.name}</h4>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Wholesale Base Cost:</span>
                <span className="font-mono font-bold text-white">
                  ${importModalItem.cost_with_platform_fee_usd.toFixed(2)} USD
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Assign to Category / Folder
                </label>
                <select
                  value={importGroupId}
                  onChange={(e) => setImportGroupId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                >
                  <option value="">📁 General (No Category Folder)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.icon || '📁'} {g.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-zinc-500">
                  Customers will find this product inside this folder in Telegram.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Your Retail Selling Price ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5.99"
                  value={importRetailPrice}
                  onChange={(e) => setImportRetailPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
                {parseFloat(importRetailPrice) > 0 && (
                  <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 mt-1">
                    <span>
                      Estimated Profit:{' '}
                      <strong className="text-emerald-400">
                        +${(parseFloat(importRetailPrice) - importModalItem.cost_with_platform_fee_usd).toFixed(2)} USD
                      </strong>
                    </span>
                    <span>
                      ~ ৳ {(parseFloat(importRetailPrice) * (overview?.usdToBdtRate || 125)).toFixed(0)} BDT
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={importLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs shadow-md active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {importLoading ? 'Importing...' : 'Confirm & Add to Bot 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
