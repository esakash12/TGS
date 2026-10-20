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
  Edit3,
  Sliders,
  DollarSign,
  Layers,
  FolderOpen,
  ArrowUpDown,
  Check,
  Sparkles,
  Tag,
  Menu,
  X,
} from 'lucide-react';
import { CyberDialog, CyberDialogOptions } from '../../components/CyberDialog';

export const Dashboard: React.FC = () => {
  const { user, tenant, token, logout, refreshSession } = useAuth();
  const navigate = useNavigate();

  // Modern Cyber Popup Dialog System
  const [dialog, setDialog] = useState<CyberDialogOptions | null>(null);

  const showNotice = (title: string, message: string, tone: 'success' | 'danger' | 'warning' | 'info' = 'info') => {
    setDialog({ type: 'alert', tone, title, message });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, tone: 'danger' | 'warning' | 'info' = 'danger', confirmText?: string) => {
    setDialog({ type: 'confirm', tone, title, message, onConfirm, confirmText });
  };

  const showPrompt = (title: string, message: string, inputLabel: string, defaultValue: string, onConfirm: (val?: string) => void) => {
    setDialog({ type: 'prompt', tone: 'info', title, message, inputLabel, defaultValue, onConfirm });
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'groups' | 'custom_products' | 'wholesale' | 'store_products' | 'deposits' | 'customers' | 'bot_editor' | 'payments' | 'subscription' | 'settings'>('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [wholesaleCatalog, setWholesaleCatalog] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [balanceModalCustomer, setBalanceModalCustomer] = useState<any | null>(null);
  const [balanceAdjustAction, setBalanceAdjustAction] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [balanceAdjustAmount, setBalanceAdjustAmount] = useState<string>('');
  const [balanceAdjustReason, setBalanceAdjustReason] = useState<string>('');
  const [balanceAdjustLoading, setBalanceAdjustLoading] = useState<boolean>(false);
  const [botRestartLoading, setBotRestartLoading] = useState(false);
  const [botRestartFeedback, setBotRestartFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Bot Profile Live Editor State
  const [botProfileLoading, setBotProfileLoading] = useState(false);
  const [botProfileSaving, setBotProfileSaving] = useState(false);
  const [botProfileData, setBotProfileData] = useState<{
    name: string;
    about: string;
    description: string;
    username: string;
    commands: Array<{ command: string; description: string }>;
  }>({
    name: '',
    about: '',
    description: '',
    username: '',
    commands: [
      { command: 'start', description: 'Open Store Menu' },
      { command: 'help', description: 'Customer Support' },
    ],
  });

  // Subscription State
  const [subData, setSubData] = useState<any | null>(null);
  const [subHistory, setSubHistory] = useState<any[]>([]);
  const [subCycleView, setSubCycleView] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');

  // Subscription Checkout Modal State
  const [showSubModal, setShowSubModal] = useState(false);
  const [subSelectedPlan, setSubSelectedPlan] = useState<any | null>(null);
  const [subSelectedCycle, setSubSelectedCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [subCouponCode, setSubCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [subTrxId, setSubTrxId] = useState('');
  const [subVerifying, setSubVerifying] = useState(false);
  const [subFeedback, setSubFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter & Search states
  const [storeFilter, setStoreFilter] = useState<'all' | 'custom' | 'wholesale'>('all');
  const [wholesaleSearch, setWholesaleSearch] = useState('');
  const [wholesaleProviderFilter, setWholesaleProviderFilter] = useState<'all' | 'digitalcore' | 'canboso'>('all');
  const [wholesaleCategoryFilter, setWholesaleCategoryFilter] = useState('all');

  // Clear Store / Products Modal
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearScope, setClearScope] = useState<'all' | 'wholesale' | 'custom'>('all');
  const [clearLoading, setClearLoading] = useState(false);

  // Margin Management Modal
  const [showMarginModal, setShowMarginModal] = useState(false);
  const [marginMode, setMarginMode] = useState<'fixed' | 'pct'>('fixed');
  const [marginFixedUsd, setMarginFixedUsd] = useState('0.20');
  const [marginPct, setMarginPct] = useState('20');
  const [marginLoading, setMarginLoading] = useState(false);

  // Sync Live Prices State
  const [syncingPrices, setSyncingPrices] = useState(false);

  // Inline Price Edit Modal / State
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [newEditPrice, setNewEditPrice] = useState('');

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
  const [showNewCatInputInImport, setShowNewCatInputInImport] = useState(false);
  const [importNewCategoryName, setImportNewCategoryName] = useState('');

  // Settings State
  const [settingsData, setSettingsData] = useState<any>({
    name: '',
    botToken: '',
    usdToBdtRate: 125,
    paymentNumbers: { bkash: '', nagad: '', rocket: '' },
    binanceConfig: { uid: '', apiKey: '', hasSecret: false },
    zinipayEnabled: false,
    zinipayApiKey: '',
    hasZinipayKey: false,
    autoMarkup: { enabled: true, pct: 20, fixedUsd: 0.50 },
    welcomeText: '',
    aboutText: '',
    supportText: '',
    adminTelegramId: '',
  });
  const [settingsSaved, setSettingsSaved] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // Fetch Dashboard Core Data
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [overviewRes, productsRes, groupsRes, depositsRes, customersRes] = await Promise.all([
        axios.get('/api/merchant/overview', authHeaders),
        axios.get('/api/merchant/products', authHeaders),
        axios.get('/api/merchant/groups', authHeaders),
        axios.get('/api/merchant/deposits', authHeaders),
        axios.get('/api/merchant/customers', authHeaders),
      ]);
      setOverview(overviewRes.data);
      setProducts(productsRes.data);
      setGroups(groupsRes.data);
      setDeposits(depositsRes.data);
      setCustomers(customersRes.data);
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

  const loadCustomers = async () => {
    try {
      const res = await axios.get('/api/merchant/customers', authHeaders);
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const handleAdjustCustomerBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModalCustomer) return;

    const numAmount = parseFloat(balanceAdjustAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showNotice('Invalid Amount', 'Please enter a valid amount greater than 0 USD.', 'warning');
      return;
    }

    if (balanceAdjustAction === 'DEDUCT' && Number(balanceModalCustomer.balance_usd || 0) < numAmount) {
      showNotice(
        'Insufficient Balance',
        `Cannot deduct $${numAmount.toFixed(2)} USD. Customer balance is only $${Number(balanceModalCustomer.balance_usd || 0).toFixed(2)} USD.`,
        'danger'
      );
      return;
    }

    setBalanceAdjustLoading(true);
    try {
      const res = await axios.post(
        `/api/merchant/customers/${balanceModalCustomer.telegram_id}/balance`,
        {
          amount: numAmount,
          action: balanceAdjustAction,
          reason: balanceAdjustReason.trim(),
        },
        authHeaders
      );

      showNotice(
        'Wallet Adjusted',
        res.data?.message || 'Customer balance updated successfully.',
        'success'
      );

      // Close modal and refresh customers list
      setBalanceModalCustomer(null);
      setBalanceAdjustAmount('');
      setBalanceAdjustReason('');
      await loadCustomers();
    } catch (err: any) {
      showNotice('Failed to Adjust', err.response?.data?.error || err.message || 'Error updating balance.', 'danger');
    } finally {
      setBalanceAdjustLoading(false);
    }
  };

  const handleRestartBot = async () => {
    setBotRestartLoading(true);
    setBotRestartFeedback(null);
    try {
      const res = await axios.post('/api/merchant/bot/restart', {}, authHeaders);
      setBotRestartFeedback({ type: 'success', message: res.data.message || 'Bot connected successfully!' });
      loadDashboardData();
    } catch (err: any) {
      setBotRestartFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to connect bot' });
    } finally {
      setBotRestartLoading(false);
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

  // Load Subscription Data
  const loadSubscriptionData = async () => {
    try {
      const [currRes, histRes] = await Promise.all([
        axios.get('/api/merchant/subscription/current', authHeaders),
        axios.get('/api/merchant/subscription/history', authHeaders),
      ]);
      setSubData(currRes.data);
      setSubHistory(histRes.data);
    } catch (err) {
      console.error('Failed to load subscription data:', err);
    }
  };

  // Load Live Bot Profile from Telegram API
  const loadBotProfile = async () => {
    setBotProfileLoading(true);
    try {
      const res = await axios.get('/api/merchant/bot/profile', authHeaders);
      if (res.data) {
        setBotProfileData({
          name: res.data.name || '',
          about: res.data.about || '',
          description: res.data.description || '',
          username: res.data.username || '',
          commands: res.data.commands || [
            { command: 'start', description: 'Open Store Menu' },
            { command: 'help', description: 'Customer Support' },
          ],
        });
      }
    } catch (err: any) {
      console.warn('Failed to load bot profile from Telegram:', err.message);
    } finally {
      setBotProfileLoading(false);
    }
  };

  const handleSaveBotProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBotProfileSaving(true);
    try {
      const res = await axios.put('/api/merchant/bot/profile', botProfileData, authHeaders);
      showNotice('Telegram Updated', res.data.message || 'Bot profile updated successfully on Telegram!', 'success');
      loadBotProfile();
    } catch (err: any) {
      showNotice('Update Failed', err.response?.data?.error || 'Failed to update bot profile on Telegram.', 'danger');
    } finally {
      setBotProfileSaving(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'wholesale') loadWholesaleCatalog();
    if (activeTab === 'groups') loadGroups();
    if (activeTab === 'settings' || activeTab === 'payments') loadSettings();
    if (activeTab === 'customers') loadCustomers();
    if (activeTab === 'bot_editor') loadBotProfile();
    if (activeTab === 'subscription' || activeTab === 'overview') loadSubscriptionData();
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

  // Subscription Checkout Handlers
  const handleOpenUpgradeModal = (plan: any, cycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY') => {
    setSubSelectedPlan(plan);
    setSubSelectedCycle(cycle);
    setSubCouponCode('');
    setAppliedCoupon(null);
    setCouponFeedback(null);
    setSubTrxId('');
    setSubFeedback(null);
    setShowSubModal(true);
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCouponCode.trim() || !subSelectedPlan) return;
    setCouponLoading(true);
    setCouponFeedback(null);
    try {
      const res = await axios.post(
        '/api/merchant/subscription/validate-coupon',
        {
          code: subCouponCode.trim(),
          planId: subSelectedPlan.id,
          cycle: subSelectedCycle,
        },
        authHeaders
      );
      setAppliedCoupon(res.data);
      setCouponFeedback({
        type: 'success',
        message: `Coupon "${res.data.code}" applied! You save $${res.data.discountAmountUsd} USD.`,
      });
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Invalid or ineligible coupon code',
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleVerifySubPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTrxId.trim() || !subSelectedPlan) return;
    setSubVerifying(true);
    setSubFeedback(null);
    try {
      const res = await axios.post(
        '/api/merchant/subscription/verify-binance',
        {
          planId: subSelectedPlan.id,
          cycle: subSelectedCycle,
          couponCode: appliedCoupon?.code || undefined,
          trxId: subTrxId.trim(),
        },
        authHeaders
      );
      setSubFeedback({
        type: 'success',
        message: res.data.message || 'Subscription successfully activated!',
      });
      setSubTrxId('');
      loadSubscriptionData();
      loadDashboardData();
      refreshSession();
    } catch (err: any) {
      setSubFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Verification failed. Please ensure the TrxID and sent amount match.',
      });
    } finally {
      setSubVerifying(false);
    }
  };

  // Check active subscription helper
  const requireActiveSubscription = (): boolean => {
    if (subData?.subscription?.status === 'EXPIRED') {
      showConfirm(
        'Subscription Required',
        'Your merchant subscription is currently inactive. Please choose a subscription tier and activate with Binance Pay to use full catalog and bot features.',
        () => {
          navigate('/onboarding/plan');
        },
        'warning',
        'Choose Plan & Activate ⚡'
      );
      return false;
    }
    return true;
  };

  // 1-Click Product ON/OFF Toggle
  const handleToggleProduct = async (productId: string, currentActive: number) => {
    try {
      const res = await axios.patch(`/api/merchant/products/${productId}/toggle`, {}, authHeaders);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, is_active: res.data.is_active } : p))
      );
    } catch (err: any) {
      showNotice('Product Status', err.response?.data?.error || 'Failed to toggle product status', 'danger');
    }
  };

  // Group Management Handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireActiveSubscription()) return;
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
      showNotice('Category Creation', err.response?.data?.error || 'Failed to create category', 'danger');
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    showConfirm(
      'Delete Category',
      `Delete category "${groupName}"? Products in this folder will be safely unassigned.`,
      async () => {
        try {
          await axios.delete(`/api/merchant/groups/${groupId}`, authHeaders);
          loadGroups();
          loadDashboardData();
          showNotice('Category Deleted', `Category "${groupName}" deleted safely.`, 'success');
        } catch (err: any) {
          showNotice('Delete Failed', err.response?.data?.error || 'Failed to delete category', 'danger');
        }
      },
      'danger',
      'Delete Category'
    );
  };

  // Create Custom Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireActiveSubscription()) return;
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
      showNotice('Product Creation', err.response?.data?.error || 'Failed to create product', 'danger');
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
      showNotice('Inventory Stock', err.response?.data?.error || 'Failed to add stock', 'danger');
    }
  };

  // Delete product
  const handleDeleteProduct = async (productId: string, productName: string) => {
    showConfirm(
      'Delete Product',
      `Delete "${productName}" from your store? This action cannot be undone.`,
      async () => {
        try {
          await axios.delete(`/api/merchant/products/${productId}`, authHeaders);
          loadDashboardData();
          showNotice('Product Deleted', `"${productName}" has been removed from your store.`, 'success');
        } catch (err: any) {
          showNotice('Delete Failed', err.response?.data?.error || 'Failed to delete product', 'danger');
        }
      },
      'danger',
      'Delete Product'
    );
  };

  // Open Wholesale Import Modal
  const handleOpenImportModal = (item: any) => {
    if (!requireActiveSubscription()) return;
    setImportModalItem(item);
    const defaultMargin = parseFloat(marginFixedUsd) || 0.20;
    const calculatedPrice = (item.cost_with_platform_fee_usd + defaultMargin).toFixed(2);
    setImportRetailPrice(calculatedPrice);
    setImportGroupId(groups.length > 0 ? groups[0].id : '');
    setShowNewCatInputInImport(false);
    setImportNewCategoryName('');
  };

  // Confirm Wholesale Import
  const handleConfirmImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importModalItem) return;
    if (!requireActiveSubscription()) return;
    setImportLoading(true);
    try {
      let finalGroupId = importGroupId || null;

      if (showNewCatInputInImport && importNewCategoryName.trim()) {
        const catRes = await axios.post(
          '/api/merchant/groups',
          { name: importNewCategoryName.trim(), icon: '📁', sortOrder: 0 },
          authHeaders
        );
        finalGroupId = catRes.data?.id || null;
        loadGroups();
      }

      await axios.post(
        '/api/merchant/wholesale/import',
        {
          wholesaleProductId: importModalItem.id,
          name: importModalItem.name,
          category: importModalItem.category,
          wholesaleCostUsd: importModalItem.cost_with_platform_fee_usd,
          retailPriceUsd: parseFloat(importRetailPrice),
          provider: importModalItem.provider,
          groupId: finalGroupId,
          description: importModalItem.description || '',
          stock: importModalItem.stock ?? 999,
        },
        authHeaders
      );
      setImportModalItem(null);
      loadDashboardData();
      showNotice('Wholesale Import', 'Product imported successfully to your store catalog!', 'success');
    } catch (err: any) {
      showNotice('Import Failed', err.response?.data?.error || 'Failed to import product', 'danger');
    } finally {
      setImportLoading(false);
    }
  };

  // 1-Click Clear All / Partial Store Products
  const handleClearProducts = async (scope: 'all' | 'wholesale' | 'custom') => {
    const label =
      scope === 'all'
        ? 'ALL products (Wholesale & Custom)'
        : scope === 'wholesale'
        ? 'all WHOLESALE products'
        : 'all CUSTOM accounts';

    showConfirm(
      'Clear Store Products',
      `Are you sure you want to completely remove ${label} from your bot and store? This action will immediately delete them from your bot catalog.`,
      async () => {
        setClearLoading(true);
        try {
          const res = await axios.delete(`/api/merchant/products/clear-all?type=${scope}`, authHeaders);
          showNotice('Products Cleared', res.data?.message || 'Products cleared successfully.', 'success');
          setShowClearModal(false);
          loadDashboardData();
        } catch (err: any) {
          showNotice('Clear Failed', err.response?.data?.error || 'Failed to clear products', 'danger');
        } finally {
          setClearLoading(false);
        }
      },
      'danger',
      'Confirm & Clear Products'
    );
  };

  // Apply Global Profit Margin across all wholesale items
  const handleApplyGlobalMargin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireActiveSubscription()) return;
    setMarginLoading(true);
    try {
      const res = await axios.post(
        '/api/merchant/products/apply-margin',
        {
          mode: marginMode,
          marginFixedUsd: parseFloat(marginFixedUsd) || 0.20,
          marginPct: parseFloat(marginPct) || 20,
        },
        authHeaders
      );
      showNotice('Margin Applied', `Applied profit margin to ${res.data.updatedCount} wholesale products in your store!`, 'success');
      setShowMarginModal(false);
      loadDashboardData();
    } catch (err: any) {
      showNotice('Margin Error', err.response?.data?.error || 'Failed to apply profit margin', 'danger');
    } finally {
      setMarginLoading(false);
    }
  };

  // Sync Live Upstream Prices with Auto Margin Preservation
  const handleSyncLivePrices = async () => {
    setSyncingPrices(true);
    try {
      const res = await axios.post('/api/merchant/products/sync-prices', {}, authHeaders);
      showNotice(
        'Price Sync Complete',
        `Upstream prices checked. Updated ${res.data.updatedCount} out of ${res.data.totalWholesale} products while keeping your configured profit margins.`,
        'success'
      );
      loadDashboardData();
    } catch (err: any) {
      showNotice('Price Sync Failed', err.response?.data?.error || 'Failed to sync upstream prices', 'danger');
    } finally {
      setSyncingPrices(false);
    }
  };

  // Quick Edit Individual Product Price
  const handleOpenEditPrice = (product: any) => {
    setEditingProduct(product);
    setNewEditPrice(Number(product.retail_price_usd).toFixed(2));
  };

  const handleSaveProductPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const priceNum = parseFloat(newEditPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      showNotice('Invalid Price', 'Please enter a valid retail price greater than 0.', 'warning');
      return;
    }
    try {
      await axios.put(
        `/api/merchant/products/${editingProduct.id}`,
        { retailPriceUsd: priceNum },
        authHeaders
      );
      setEditingProduct(null);
      loadDashboardData();
    } catch (err: any) {
      showNotice('Price Update Failed', err.response?.data?.error || 'Failed to update price', 'danger');
    }
  };

  // Bulk Import
  const handleBulkImport = async () => {
    if (!requireActiveSubscription()) return;
    showConfirm(
      'Bulk Wholesale Import',
      'Auto-import all available wholesale items with a default +20% and +$0.50 profit margin?',
      async () => {
        try {
          const res = await axios.post('/api/merchant/wholesale/bulk-enable', { markupPct: 20, markupFixedUsd: 0.50 }, authHeaders);
          showNotice('Bulk Import Complete', `Successfully synchronized ${res.data.count} wholesale products!`, 'success');
          loadDashboardData();
        } catch (err: any) {
          showNotice('Bulk Import Failed', err.response?.data?.error || 'Bulk import failed', 'danger');
        }
      },
      'info',
      'Import Wholesale Items'
    );
  };

  // Approve Deposit
  const handleApproveDeposit = async (id: number) => {
    showConfirm(
      'Approve Deposit',
      'Are you sure you want to approve this customer deposit? Their balance will be immediately credited.',
      async () => {
        try {
          await axios.post(`/api/merchant/deposits/${id}/approve`, {}, authHeaders);
          showNotice('Deposit Approved', 'Customer deposit approved and balance credited.', 'success');
          loadDashboardData();
        } catch (err: any) {
          showNotice('Approval Failed', err.response?.data?.error || 'Approval failed', 'danger');
        }
      },
      'warning',
      'Approve & Credit Balance'
    );
  };

  // Reject Deposit
  const handleRejectDeposit = async (id: number) => {
    showPrompt(
      'Reject Deposit',
      'Enter rejection reason that will be sent to the customer on Telegram:',
      'Rejection Reason',
      'Incorrect TrxID or amount mismatch',
      async (reason) => {
        if (!reason) return;
        try {
          await axios.post(`/api/merchant/deposits/${id}/reject`, { reason }, authHeaders);
          showNotice('Deposit Rejected', 'Customer deposit has been rejected.', 'info');
          loadDashboardData();
        } catch (err: any) {
          showNotice('Rejection Failed', err.response?.data?.error || 'Rejection failed', 'danger');
        }
      }
    );
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        '/api/merchant/settings',
        {
          storeName: settingsData.name,
          botToken: settingsData.botToken,
          usdToBdtRate: settingsData.usdToBdtRate,
          paymentNumbers: settingsData.paymentNumbers,
          binanceConfig: settingsData.binanceConfig,
          autoMarkup: settingsData.autoMarkup,
          welcomeText: settingsData.welcomeText,
          aboutText: settingsData.aboutText,
          supportText: settingsData.supportText,
          categoriesEnabled: settingsData.categoriesEnabled,
          adminTelegramId: settingsData.adminTelegramId,
          zinipayEnabled: settingsData.zinipayEnabled,
          zinipayApiKey: settingsData.zinipayApiKey,
        },
        authHeaders
      );
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      if (res.data?.botStatus) {
        if (res.data.botStatus.success) {
          setBotRestartFeedback({ type: 'success', message: `Bot @${res.data.botStatus.username} connected and active!` });
        } else {
          setBotRestartFeedback({ type: 'error', message: res.data.botStatus.error || 'Bot failed to launch' });
        }
      }
      loadDashboardData();
      refreshSession();
    } catch (err: any) {
      showNotice('Settings Error', err.response?.data?.error || 'Failed to save settings', 'danger');
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

  // Filtered Wholesale Catalog with Upstream Category Folders (White-Labeled)
  const filteredWholesale = wholesaleCatalog.filter((item) => {
    const matchSearch =
      wholesaleSearch === '' ||
      item.name.toLowerCase().includes(wholesaleSearch.toLowerCase()) ||
      item.category.toLowerCase().includes(wholesaleSearch.toLowerCase()) ||
      item.id.toLowerCase().includes(wholesaleSearch.toLowerCase());

    const matchCategory =
      wholesaleCategoryFilter === 'all' ||
      item.category.toLowerCase() === wholesaleCategoryFilter.toLowerCase();

    return matchSearch && matchCategory;
  });

  // Unique wholesale categories for filter chips
  const wholesaleCategories = Array.from(
    new Set(wholesaleCatalog.map((i) => i.category))
  ).filter(Boolean);

  return (
    <div className="min-h-screen bg-carbon-900 text-zinc-100 flex flex-col">
      {/* ==========================================
          TOP NAVIGATION BAR
         ========================================== */}
      <header className="bg-carbon-900/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="md:hidden p-2 rounded-xl bg-carbon-800 border border-white/10 text-zinc-300 hover:text-white"
            aria-label="Toggle Navigation Menu"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5 text-crimson-400" /> : <Menu className="w-5 h-5 text-white" />}
          </button>

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
          MAIN DASHBOARD BODY WITH SIDEBAR
         ========================================== */}
      <div className="flex-1 flex flex-col md:flex-row w-full min-h-[calc(100vh-65px)] relative">
        {/* Mobile Backdrop overlay */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden"
          />
        )}

        {/* Left Sidebar Navigation (Desktop persistent, Mobile slide-in drawer) */}
        <aside className={`
          w-72 md:w-64 bg-carbon-900 border-r border-white/10 p-3 sm:p-4 flex-shrink-0 flex flex-col justify-between
          fixed md:static inset-y-0 left-0 z-40 md:z-0 transform transition-transform duration-200 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          overflow-y-auto max-h-screen md:max-h-none
        `}>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <span>Navigation Menu</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => { setActiveTab('overview'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'overview'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('groups'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'groups'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Folder className="w-4 h-4" />
                <span>Categories & Folders</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-400">{groups.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('custom_products'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'custom_products'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4" />
                <span>Custom Accounts</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-400">{products.filter((p) => p.provider === 'custom').length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('wholesale'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'wholesale'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Wholesale Sourcing</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('store_products'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'store_products'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-4 h-4" />
                <span>My Active Store</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-400">{products.length}</span>
            </button>

            <button
              onClick={() => { setActiveTab('deposits'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'deposits'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4" />
                <span>Deposits</span>
              </div>
              {overview?.pendingDepositsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-crimson-500 text-white text-[10px] flex items-center justify-center font-bold">
                  {overview.pendingDepositsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('customers'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'customers'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>Customers</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-zinc-400">{overview?.totalCustomers ?? customers.length}</span>
            </button>

            <div className="pt-3 pb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              Bot & System
            </div>

            <button
              onClick={() => { setActiveTab('bot_editor'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'bot_editor'
                  ? 'bg-gradient-to-r from-laser-600/30 to-purple-600/30 text-laser-300 border border-laser-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bot className="w-4 h-4 text-laser-400" />
                <span>Bot Profile Editor</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('payments'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'payments'
                  ? 'bg-gradient-to-r from-emerald-600/30 to-laser-600/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>Payment Gateways</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">Auto</span>
            </button>

            <button
              onClick={() => { setActiveTab('settings'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'settings'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4" />
                <span>Store Settings</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab('subscription'); setMobileSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'subscription'
                  ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Shield className="w-4 h-4" />
                <span>Subscription & Plan</span>
              </div>
              {subData?.subscription?.status === 'TRIAL' && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                  Trial
                </span>
              )}
              {subData?.subscription?.status === 'EXPIRED' && (
                <span className="px-1.5 py-0.5 rounded bg-crimson-500/20 text-crimson-400 text-[10px] font-bold animate-pulse">
                  Expired
                </span>
              )}
            </button>
          </div>

          {/* Quick Rate & Bot Status in Sidebar footer */}
          <div className="hidden md:block pt-4 border-t border-white/5 space-y-2">
            <div className="p-2.5 rounded-xl bg-carbon-800/60 border border-white/5 text-[11px] text-zinc-400">
              <div className="flex items-center justify-between mb-1">
                <span>Exchange Rate:</span>
                <span className="text-white font-bold">$1 = {overview?.usdToBdtRate || 125} ৳</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span>Status:</span>
                <span className={botOnline ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                  {botOnline ? 'Bot Online' : 'Bot Offline'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto">

        {/* Subscription Expiry / Warning Banner */}
        {subData?.subscription && (subData.subscription.status === 'EXPIRED' || (subData.subscription.daysRemaining !== undefined && subData.subscription.daysRemaining <= 3)) && (
          <div className={`p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border ${
            subData.subscription.status === 'EXPIRED'
              ? 'bg-crimson-950/40 border-crimson-500/40 text-crimson-200 shadow-lg shadow-crimson-900/20'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${subData.subscription.status === 'EXPIRED' ? 'bg-crimson-500/20 text-crimson-400' : 'bg-amber-500/20 text-amber-400'}`}>
                <Zap className="w-5 h-5 flex-shrink-0" />
              </div>
              <div>
                <span className="font-bold text-xs sm:text-sm block">
                  {subData.subscription.status === 'EXPIRED'
                    ? 'Subscription Required — Activate Store & Bot'
                    : `Subscription Expiring in ${subData.subscription.daysRemaining} days!`}
                </span>
                <span className="text-xs opacity-80">
                  {subData.subscription.status === 'EXPIRED'
                    ? 'New stores require an active subscription to launch your Telegram bot and add products. Activate with Binance Pay for instant automated access.'
                    : 'Renew your subscription before it expires to prevent service interruption.'}
                </span>
              </div>
            </div>
            <button
              onClick={() => navigate('/onboarding/plan')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs whitespace-nowrap shadow-md shadow-crimson-600/30 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {subData.subscription.status === 'EXPIRED' ? 'Activate Subscription Now ⚡' : 'Renew / Upgrade Now ⚡'}
            </button>
          </div>
        )}

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
                  When enabled, your bot organizes products into folders. When disabled, customers see all products directly in a flat list with no categories.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const newStatus = !settingsData.categoriesEnabled;
                    setSettingsData({ ...settingsData, categoriesEnabled: newStatus });
                    try {
                      await axios.put(
                        '/api/merchant/settings',
                        {
                          storeName: settingsData.name,
                          categoriesEnabled: newStatus,
                        },
                        authHeaders
                      );
                    } catch (e) {
                      console.error('Failed to toggle categories:', e);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                    settingsData.categoriesEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-carbon-800 text-zinc-400 border-white/10 hover:text-white'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${settingsData.categoriesEnabled ? 'bg-emerald-400' : 'bg-zinc-500'}`}></span>
                  Categories: {settingsData.categoriesEnabled ? 'ON' : 'OFF'}
                </button>
                <button
                  onClick={() => setShowAddGroupModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-laser-600 hover:bg-laser-500 text-white font-bold text-xs flex items-center gap-2 shadow-md self-start sm:self-auto"
                >
                  <FolderPlus className="w-4 h-4" /> Add Category / Group
                </button>
              </div>
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
                  <Zap className="w-5 h-5 text-crimson-400" /> Cloud Wholesale Sourcing Catalog
                </h3>
                <p className="text-xs text-zinc-400">
                  Search live digital products across global cloud providers. Filter by brand folders, set profit margins, and import to your bot with 1 click!
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowMarginModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-laser-600/20 hover:bg-laser-600/30 border border-laser-500/40 text-laser-300 text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                  title="Configure global profit margin"
                >
                  <Sliders className="w-3.5 h-3.5" /> Set Profit Margin
                </button>
                <button
                  onClick={handleBulkImport}
                  className="px-3.5 py-2 rounded-xl bg-laser-600 hover:bg-laser-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Auto-Import All (+Margin)
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

            {/* Search Input & Category Folders */}
            <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Instant search by product name, category folder, or ID..."
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

              {/* Category Filter Chips (Brand & Service Folders) */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-laser-400" /> Product Folders:
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pt-0.5 pb-1">
                  <button
                    onClick={() => setWholesaleCategoryFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      wholesaleCategoryFilter === 'all'
                        ? 'bg-crimson-500 text-white shadow'
                        : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
                    }`}
                  >
                    <span>📁 All Folders</span>
                    <span className="text-[10px] opacity-80">
                      ({wholesaleCatalog.length})
                    </span>
                  </button>
                  {wholesaleCategories.map((cat) => {
                    const catCount = wholesaleCatalog.filter(
                      (i) => i.category?.toLowerCase() === cat.toLowerCase()
                    ).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setWholesaleCategoryFilter(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          wholesaleCategoryFilter.toLowerCase() === cat.toLowerCase()
                            ? 'bg-crimson-500 text-white shadow'
                            : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
                        }`}
                      >
                        <Folder className="w-3 h-3 opacity-60" />
                        <span>{cat}</span>
                        <span className="text-[10px] opacity-75 font-mono">({catCount})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Wholesale Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredWholesale.length === 0 ? (
                <div className="col-span-full glass-card rounded-2xl p-12 text-center text-zinc-500 space-y-3">
                  <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-white font-semibold">No matching wholesale products found.</p>
                  <p className="text-xs text-zinc-400">
                    Try adjusting your search query or check if upstream catalog is active.
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
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-carbon-800 text-laser-400 border border-laser-500/20 uppercase flex items-center gap-1">
                          <span>{item.icon || '⚡'}</span> Cloud Sourcing
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">
                          In Stock ({item.stock})
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-white">{item.name}</h4>
                      <div className="text-xs text-zinc-400">Folder: {item.category}</div>
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
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" /> My Active Store & Bot Items
                </h3>
                <p className="text-xs text-zinc-400">
                  Every product currently available in your Telegram bot. Use 1-Click Toggle to turn items ON or OFF instantly, adjust selling prices, or sync live upstream wholesale costs.
                </p>
              </div>

              {/* Action Buttons & Sub-Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleSyncLivePrices}
                  disabled={syncingPrices}
                  className="px-3.5 py-1.5 rounded-xl bg-carbon-800 hover:bg-carbon-700 border border-white/10 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  title="Auto-update wholesale costs and adjust selling prices preserving your margin"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-laser-400 ${syncingPrices ? 'animate-spin' : ''}`} />
                  <span>{syncingPrices ? 'Syncing...' : 'Sync Live Prices'}</span>
                </button>

                <button
                  onClick={() => setShowMarginModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-laser-600/20 hover:bg-laser-600/30 border border-laser-500/40 text-laser-300 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  title="Configure global profit margin across wholesale items"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Set Margin</span>
                </button>

                <button
                  onClick={() => setShowClearModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-crimson-600/20 hover:bg-crimson-600/40 border border-crimson-500/40 text-crimson-400 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  title="Bulk clear products from bot and store"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Products</span>
                </button>

                {/* Sub-Filter Pills */}
                <div className="flex items-center gap-1 bg-carbon-800 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setStoreFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      storeFilter === 'all' ? 'bg-crimson-500 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    All ({products.length})
                  </button>
                  <button
                    onClick={() => setStoreFilter('custom')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      storeFilter === 'custom' ? 'bg-crimson-500 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Custom ({products.filter((p) => p.provider === 'custom').length})
                  </button>
                  <button
                    onClick={() => setStoreFilter('wholesale')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      storeFilter === 'wholesale' ? 'bg-crimson-500 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Wholesale ({products.filter((p) => p.provider !== 'custom').length})
                  </button>
                </div>
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
                      <th className="p-4">Selling Price & Margin</th>
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
                              {p.provider === 'custom' ? 'Custom Stock' : 'Cloud Sourcing (Auto)'}
                            </span>
                          </td>
                          <td className="p-4 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-emerald-400 text-sm">
                                ${Number(p.retail_price_usd).toFixed(2)} USD
                              </span>
                              <button
                                onClick={() => handleOpenEditPrice(p)}
                                className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                title="Edit selling price"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {p.provider !== 'custom' && (
                              <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                                <span>Cost: ${Number(p.wholesale_price_usd || 0).toFixed(2)}</span>
                                <span className="text-zinc-600">·</span>
                                <span className="text-emerald-400 font-semibold">
                                  Margin: +${(Number(p.retail_price_usd) - Number(p.wholesale_price_usd || 0)).toFixed(2)}
                                </span>
                              </div>
                            )}
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
                            <button
                              onClick={() => handleOpenEditPrice(p)}
                              className="px-2.5 py-1 rounded-lg bg-carbon-700 hover:bg-carbon-600 text-white font-semibold text-[11px]"
                            >
                              Edit Price
                            </button>
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
            TAB: CUSTOMERS & BOT USERS DIRECTORY
           ========================================== */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-crimson-400" />
                  Bot Customers Directory
                </h3>
                <p className="text-xs text-zinc-400">
                  Real-time list of all users and buyers interacting with your Telegram bot.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search by username, name, ID..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-crimson-500"
                />
              </div>
            </div>

            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-carbon-800/60 text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="p-4">Customer</th>
                      <th className="p-4">Telegram ID</th>
                      <th className="p-4">Wallet Balance</th>
                      <th className="p-4">Total Spent</th>
                      <th className="p-4">Orders</th>
                      <th className="p-4">Language</th>
                      <th className="p-4">Registered Date</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {customers.filter((c) => {
                      if (!customerSearch.trim()) return true;
                      const q = customerSearch.toLowerCase();
                      const name = (c.first_name || '').toLowerCase();
                      const username = (c.username || '').toLowerCase();
                      const tgId = String(c.telegram_id);
                      return name.includes(q) || username.includes(q) || tgId.includes(q);
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-500 font-sans text-xs">
                          {customerSearch ? 'No customers matching search criteria.' : 'No customers have started your Telegram bot yet.'}
                        </td>
                      </tr>
                    ) : (
                      customers
                        .filter((c) => {
                          if (!customerSearch.trim()) return true;
                          const q = customerSearch.toLowerCase();
                          const name = (c.first_name || '').toLowerCase();
                          const username = (c.username || '').toLowerCase();
                          const tgId = String(c.telegram_id);
                          return name.includes(q) || username.includes(q) || tgId.includes(q);
                        })
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-4 font-sans">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-crimson-600 to-laser-600 flex items-center justify-center font-bold text-white text-xs">
                                  {(c.first_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-white block text-xs">{c.first_name || 'Anonymous User'}</span>
                                  {c.username ? (
                                    <span className="text-[11px] text-laser-400 font-mono">@{c.username}</span>
                                  ) : (
                                    <span className="text-[11px] text-zinc-500 font-mono">No @username</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-zinc-300">
                              <code>{c.telegram_id}</code>
                            </td>
                            <td className="p-4 font-bold text-emerald-400">
                              ${Number(c.balance_usd || 0).toFixed(2)} USD
                            </td>
                            <td className="p-4 font-bold text-zinc-200">
                              ${Number(c.total_spent_usd || 0).toFixed(2)} USD
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-carbon-800 border border-white/10 text-zinc-300">
                                {c.orders_count || 0} orders
                              </span>
                            </td>
                            <td className="p-4 uppercase text-zinc-400">
                              {c.language || 'en'}
                            </td>
                            <td className="p-4 text-zinc-400 text-[11px]">
                              {new Date(c.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setBalanceModalCustomer(c);
                                  setBalanceAdjustAction('ADD');
                                  setBalanceAdjustAmount('');
                                  setBalanceAdjustReason('');
                                }}
                                className="px-3 py-1.5 rounded-xl bg-laser-600/10 hover:bg-laser-600/20 text-laser-400 border border-laser-500/20 text-[11px] font-semibold transition-all inline-flex items-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                Adjust Balance
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Customer Wallet Adjustment Modal */}
            {balanceModalCustomer && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="relative w-full max-w-md bg-carbon-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-laser-600/20 text-laser-400 flex items-center justify-center font-bold">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Adjust Customer Balance</h4>
                        <p className="text-xs text-zinc-400 font-mono">
                          {balanceModalCustomer.first_name || 'User'} ({balanceModalCustomer.telegram_id})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBalanceModalCustomer(null)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Current Balance Display */}
                  <div className="p-3.5 rounded-xl bg-carbon-800/80 border border-white/5 flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Current Wallet Balance:</span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      ${Number(balanceModalCustomer.balance_usd || 0).toFixed(2)} USD
                    </span>
                  </div>

                  <form onSubmit={handleAdjustCustomerBalance} className="space-y-4">
                    {/* Action Selector: Add or Deduct */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-carbon-800 rounded-xl border border-white/5">
                      <button
                        type="button"
                        onClick={() => setBalanceAdjustAction('ADD')}
                        className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                          balanceAdjustAction === 'ADD'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Balance (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceAdjustAction('DEDUCT')}
                        className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                          balanceAdjustAction === 'DEDUCT'
                            ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Deduct / Reduce (-)
                      </button>
                    </div>

                    {/* Amount Input */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Amount to {balanceAdjustAction === 'ADD' ? 'Credit' : 'Debit'} (USD $)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-zinc-400 font-mono text-xs">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="0.00"
                          value={balanceAdjustAmount}
                          onChange={(e) => setBalanceAdjustAmount(e.target.value)}
                          className="w-full pl-7 pr-14 py-2 bg-carbon-800 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-laser-500"
                        />
                        <span className="absolute right-3 top-2.5 text-zinc-500 font-mono text-xs">USD</span>
                      </div>
                      {balanceAdjustAmount && !isNaN(parseFloat(balanceAdjustAmount)) && (
                        <p className="text-[11px] font-mono text-zinc-400 mt-1">
                          Resulting Balance:{' '}
                          <span className="font-bold text-white">
                            $
                            {Math.max(
                              0,
                              balanceAdjustAction === 'ADD'
                                ? Number(balanceModalCustomer.balance_usd || 0) + parseFloat(balanceAdjustAmount)
                                : Number(balanceModalCustomer.balance_usd || 0) - parseFloat(balanceAdjustAmount)
                            ).toFixed(2)}{' '}
                            USD
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Reason Input */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                        Reason / Note (Optional, sent to customer)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Compensation, Order Refund, Manual Correction..."
                        value={balanceAdjustReason}
                        onChange={(e) => setBalanceAdjustReason(e.target.value)}
                        className="w-full px-3 py-2 bg-carbon-800 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-laser-500 placeholder:text-zinc-500"
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setBalanceModalCustomer(null)}
                        className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={balanceAdjustLoading || !balanceAdjustAmount || parseFloat(balanceAdjustAmount) <= 0}
                        className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                          balanceAdjustAction === 'ADD'
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                            : 'bg-crimson-600 hover:bg-crimson-500 shadow-crimson-600/30'
                        }`}
                      >
                        {balanceAdjustLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        {balanceAdjustAction === 'ADD' ? 'Confirm Add Balance' : 'Confirm Deduct Balance'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==========================================
            TAB: BOT PROFILE & COMMANDS EDITOR (Direct Telegram API Sync)
           ========================================== */}
        {activeTab === 'bot_editor' && (
          <div className="space-y-6 max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bot className="w-5 h-5 text-laser-400" /> Telegram Bot Profile & Identity Editor
                </h3>
                <p className="text-xs text-zinc-400">
                  Edit your bot's live display name, about bio, description, and slash commands directly on Telegram without using @BotFather. No image files are saved on website servers.
                </p>
              </div>
              <button
                type="button"
                onClick={loadBotProfile}
                disabled={botProfileLoading}
                className="px-3.5 py-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-2 self-start sm:self-auto transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${botProfileLoading ? 'animate-spin' : ''}`} />
                <span>Fetch from Telegram</span>
              </button>
            </div>

            {/* Telegram Live Bot Badge */}
            <div className="glass-card rounded-2xl p-5 border border-laser-500/30 bg-gradient-to-r from-laser-950/20 to-purple-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-laser-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-laser-500/20">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {botProfileData.name || tenant?.name || 'My Store Bot'}
                    </span>
                    {botProfileData.username && (
                      <span className="text-xs font-mono text-laser-400 bg-laser-500/10 px-2 py-0.5 rounded-full border border-laser-500/20">
                        @{botProfileData.username}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Live changes sync directly to Telegram Official API in real time.
                  </span>
                </div>
              </div>

              {botProfileData.username && (
                <a
                  href={`https://t.me/${botProfileData.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-laser-600/20 hover:bg-laser-600/30 text-laser-300 border border-laser-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Telegram</span>
                </a>
              )}
            </div>

            <form onSubmit={handleSaveBotProfile} className="space-y-6">
              {/* 1. Bot Name (Display Name) */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider font-mono">
                    <Tag className="w-4 h-4 text-laser-400" /> 1. Edit Name (Display Name)
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">Max 64 characters</span>
                </div>
                <input
                  type="text"
                  maxLength={64}
                  placeholder="e.g. MT Online Shop"
                  value={botProfileData.name}
                  onChange={(e) => setBotProfileData({ ...botProfileData, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-laser-500 transition-colors"
                />
                <p className="text-[11px] text-zinc-500">
                  This is the bold name people see when they open your bot or view it in chat lists.
                </p>
              </div>

              {/* 2. Bot About (Bio Card) */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider font-mono">
                    <AlertCircle className="w-4 h-4 text-purple-400" /> 2. Edit About (Bio & Profile Card)
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">Max 120 characters</span>
                </div>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g. 24/7 Automated Digital Store • Instant Delivery • 100% Genuine Licenses"
                  value={botProfileData.about}
                  onChange={(e) => setBotProfileData({ ...botProfileData, about: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 transition-colors"
                />
                <p className="text-[11px] text-zinc-500">
                  People will see this on the bot's profile page and when someone shares the link to your bot.
                </p>
              </div>

              {/* 3. Bot Description ("What can this bot do?") */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider font-mono">
                    <Sliders className="w-4 h-4 text-emerald-400" /> 3. Edit Description ("What can this bot do?")
                  </label>
                  <span className="text-[10px] text-zinc-400 font-mono">Max 512 characters</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={512}
                  placeholder="e.g. Welcome to MT Online Shop! We provide premium AI subscriptions, VPNs, and software keys with instant automated delivery. Tap /start to view our catalog."
                  value={botProfileData.description}
                  onChange={(e) => setBotProfileData({ ...botProfileData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500 resize-none transition-colors"
                />
                <p className="text-[11px] text-zinc-500">
                  Displayed on the empty chat screen before a customer taps the "Start" button for the first time.
                </p>
              </div>

              {/* 4. Bot Slash Commands */}
              <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider font-mono">
                      <Key className="w-4 h-4 text-amber-400" /> 4. Edit Commands Menu (/start, /help, etc.)
                    </label>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      These appear in the bottom-left Menu button inside Telegram for quick customer actions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setBotProfileData({
                        ...botProfileData,
                        commands: [...botProfileData.commands, { command: '', description: '' }],
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-xs font-bold text-laser-400 border border-white/10 flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Command
                  </button>
                </div>

                <div className="space-y-3">
                  {botProfileData.commands.map((cmd, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="relative w-1/3">
                        <span className="absolute left-3 top-2.5 text-zinc-500 font-mono text-xs">/</span>
                        <input
                          type="text"
                          placeholder="start"
                          value={cmd.command}
                          onChange={(e) => {
                            const newCmds = [...botProfileData.commands];
                            newCmds[idx].command = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                            setBotProfileData({ ...botProfileData, commands: newCmds });
                          }}
                          className="w-full pl-6 pr-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Short description (e.g. Open Store Menu)"
                          value={cmd.description}
                          onChange={(e) => {
                            const newCmds = [...botProfileData.commands];
                            newCmds[idx].description = e.target.value;
                            setBotProfileData({ ...botProfileData, commands: newCmds });
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newCmds = botProfileData.commands.filter((_, i) => i !== idx);
                          setBotProfileData({ ...botProfileData, commands: newCmds });
                        }}
                        className="p-2 rounded-xl bg-carbon-800 hover:bg-crimson-500/20 text-zinc-400 hover:text-crimson-400 border border-white/5 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botpic & Description Picture Guide Note */}
              <div className="p-4 rounded-2xl bg-carbon-900/60 border border-white/5 space-y-1.5 text-zinc-400 text-xs">
                <div className="flex items-center gap-2 font-bold text-zinc-200">
                  <Shield className="w-4 h-4 text-laser-400" /> Privacy & Zero-Server-Storage Policy
                </div>
                <p>
                  To keep the SaaS light, fast, and 100% private with <b>no image storage overhead on website servers</b>, profile images (Botpic & Description Picture) are hosted exclusively on Telegram servers. You can set or change your avatar directly via <code>@BotFather &rarr; /setuserpic</code> at any time.
                </p>
              </div>

              {/* Save All to Telegram Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={botProfileSaving}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-laser-600 to-purple-600 hover:from-laser-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-laser-600/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{botProfileSaving ? 'Updating Telegram...' : 'Save & Sync to Telegram 🚀'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==========================================
            TAB: PAYMENT GATEWAYS & METHODS (Dedicated Clean Hub)
           ========================================== */}
        {activeTab === 'payments' && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-400" /> Payment Gateways & Receiving Methods
                </h3>
                <p className="text-xs text-zinc-400">
                  Manage automated payment gateways (ZiniPay, Binance Pay) and manual mobile banking numbers for customer wallet recharges.
                </p>
              </div>
              {settingsSaved && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Changes Saved!
                </span>
              )}
            </div>

            {/* 1. ZINIPAY AUTOMATED PAYMENT GATEWAY CARD */}
            <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-carbon-900 space-y-5 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 text-lg">
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white tracking-wide">ZiniPay Hosted Gateway (Auto-Recharge)</h4>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                        settingsData.zinipayEnabled && settingsData.hasZinipayKey
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-white/10'
                      }`}>
                        {settingsData.zinipayEnabled && settingsData.hasZinipayKey ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Accept automated bKash, Nagad, Rocket, Upay & Card payments with instant 24/7 wallet credit.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <label className="text-xs font-semibold text-zinc-300">Enable ZiniPay:</label>
                  <button
                    type="button"
                    onClick={() => setSettingsData({ ...settingsData, zinipayEnabled: !settingsData.zinipayEnabled })}
                    className={`p-1.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
                      settingsData.zinipayEnabled
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-carbon-800 border-white/10 text-zinc-400'
                    }`}
                  >
                    {settingsData.zinipayEnabled ? <ToggleRight className="w-5 h-5 text-emerald-400" /> : <ToggleLeft className="w-5 h-5 text-zinc-500" />}
                    <span>{settingsData.zinipayEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-white/5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-emerald-400" /> ZiniPay API Key (<code>zini-api-key</code>)
                    </label>
                    <a
                      href="https://zinipay.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Get API Key from ZiniPay Dashboard</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="text"
                    placeholder={settingsData.hasZinipayKey ? '•••••••• (Configured - enter new key to update)' : 'Paste your ZiniPay API Key here'}
                    value={settingsData.zinipayApiKey?.includes('••••') ? '' : settingsData.zinipayApiKey || ''}
                    onChange={(e) => setSettingsData({ ...settingsData, zinipayApiKey: e.target.value.trim() })}
                    className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Your API key is securely encrypted using AES-256-GCM.
                  </span>
                </div>

                {/* Webhook & IPN Information Box */}
                <div className="p-3.5 rounded-xl bg-carbon-900 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" /> Webhook Callback URL
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const webhookUrl = `${window.location.origin}/api/zinipay/webhook`;
                        navigator.clipboard.writeText(webhookUrl);
                        showNotice('Copied', 'Webhook URL copied to clipboard!', 'success');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-[11px] font-mono text-zinc-300"
                    >
                      Copy URL
                    </button>
                  </div>
                  <div className="font-mono text-xs text-emerald-400/90 bg-carbon-950 p-2 rounded-lg border border-white/5 break-all">
                    {window.location.origin}/api/zinipay/webhook
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Set this as your Webhook URL in your ZiniPay Merchant portal (Settings &rarr; API & Webhooks) so customer deposits auto-credit instantly even if they close their browser.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. BINANCE PAY AUTOMATED GATEWAY CARD */}
            <div className="glass-card rounded-2xl p-6 border border-yellow-500/30 bg-gradient-to-br from-yellow-950/10 to-carbon-900 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center font-bold text-yellow-400 text-lg">
                    🟡
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">Binance Pay (Automated USDT Recharges)</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Instant zero-fee USDT deposits verified directly via Binance SAPI.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  {settingsData.binanceConfig?.uid ? 'CONFIGURED' : 'OPTIONAL'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Your Binance Pay UID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 123456789"
                    value={settingsData.binanceConfig?.uid || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        binanceConfig: { ...settingsData.binanceConfig, uid: e.target.value.trim() },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-yellow-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">Binance App &rarr; Pay &rarr; My Pay ID</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Binance API Key
                  </label>
                  <input
                    type="text"
                    placeholder={settingsData.binanceConfig?.apiKey || 'Paste API Key'}
                    value={settingsData.binanceConfig?.apiKey?.includes('••••') ? '' : settingsData.binanceConfig?.apiKey || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        binanceConfig: { ...settingsData.binanceConfig, apiKey: e.target.value.trim() },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-yellow-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">API Key with Pay Query permission</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Binance API Secret
                  </label>
                  <input
                    type="password"
                    placeholder={settingsData.binanceConfig?.hasSecret ? '•••••••• (Secret Configured)' : 'Paste API Secret'}
                    value={settingsData.binanceConfig?.apiSecret || ''}
                    onChange={(e) =>
                      setSettingsData({
                        ...settingsData,
                        binanceConfig: { ...settingsData.binanceConfig, apiSecret: e.target.value.trim() },
                      })
                    }
                    className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-yellow-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">Encrypted with AES-256 in database</span>
                </div>
              </div>
            </div>

            {/* 3. MANUAL MOBILE BANKING NUMBERS (bKash/Nagad/Rocket) */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <div>
                <h4 className="text-xs font-mono font-bold text-crimson-400 uppercase">3. Manual Payment Numbers (Personal Send Money)</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Customers who prefer manual offline payment will send money to these numbers and enter their Transaction ID for your approval.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">bKash Personal Number</label>
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
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nagad Personal Number</label>
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
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Rocket Personal Number</label>
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
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Save Payment Settings</span>
            </button>
          </form>
        )}

        {/* ==========================================
            TAB 7: STORE SETTINGS & BOT TOKEN (Cleaned Up)
           ========================================== */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Store & Bot Token Settings</h3>
                <p className="text-xs text-zinc-400">Configure your Telegram bot token, exchange rate, and store text information.</p>
              </div>
              {settingsSaved && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Settings Saved!
                </span>
              )}
            </div>

            {/* Telegram Bot Token & Status Card */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-mono font-bold text-laser-400 uppercase">1. Telegram Bot Token Setup</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Create a bot using @BotFather in Telegram and paste your HTTP API token below.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                    botOnline
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${botOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                    {botOnline ? `@${botUsername || 'StoreBot'} (Live)` : 'Bot Offline'}
                  </span>
                  <button
                    type="button"
                    disabled={botRestartLoading}
                    onClick={handleRestartBot}
                    className="px-3 py-1 rounded-xl bg-laser-600 hover:bg-laser-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${botRestartLoading ? 'animate-spin' : ''}`} />
                    <span>{botRestartLoading ? 'Connecting...' : 'Test & Connect Bot'}</span>
                  </button>
                </div>
              </div>

              {botRestartFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  botRestartFeedback.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                }`}>
                  {botRestartFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{botRestartFeedback.message}</span>
                </div>
              )}

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

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Your Personal Telegram User ID (For 1-Click Deposit Alerts & Approvals)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234567890 (Get your ID from @userinfobot)"
                  value={settingsData.adminTelegramId || ''}
                  onChange={(e) => setSettingsData({ ...settingsData, adminTelegramId: e.target.value.trim() })}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  When a customer submits a manual deposit (bKash/Nagad/Rocket), your bot will send an alert directly to this Telegram ID with [✅ Approve] & [❌ Reject] buttons!
                </span>
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

            {/* Bot Content & Branding Customization Card */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
              <div>
                <h4 className="text-xs font-mono font-bold text-purple-400 uppercase">3. Bot Content & Branding Customization</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Customize the messages and information your customers see inside your Telegram bot.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Welcome Banner Note (Shown on /start)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 🔥 Welcome to our store! Enjoy 24/7 instant deliveries and best prices."
                    value={settingsData.welcomeText || ''}
                    onChange={(e) => setSettingsData({ ...settingsData, welcomeText: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">Displayed directly beneath customer wallet balance on the /start menu card.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    About Us Information (Shown on [ 🌐 About ])
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. We provide 100% verified digital subscriptions, software keys, and developer accounts with instant automated delivery and replacement guarantee."
                    value={settingsData.aboutText || ''}
                    onChange={(e) => setSettingsData({ ...settingsData, aboutText: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 resize-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Custom message displayed when customer taps the "🌐 About" button in your bot.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Customer Support Channels & Instructions (Shown on [ 🗣️ Support ])
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. For instant 24/7 order assistance, contact our official support on Telegram: @MyStoreAdmin or WhatsApp: +8801XXXXXXXXX"
                    value={settingsData.supportText || ''}
                    onChange={(e) => setSettingsData({ ...settingsData, supportText: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500 resize-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Custom contact information displayed when customer taps the "🗣️ Support" button in your bot.</span>
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

        {/* ==========================================
            TAB 9: SUBSCRIPTION & PLAN MANAGEMENT
           ========================================== */}
        {activeTab === 'subscription' && (
          <div className="space-y-10">
            {/* 1. Current Plan Status Hero */}
            <div className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 relative overflow-hidden space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl sm:text-2xl font-black text-white">
                      {subData?.subscription?.planName || 'Starter Cloud'}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        subData?.subscription?.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : subData?.subscription?.status === 'TRIAL'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30 animate-pulse'
                      }`}
                    >
                      {subData?.subscription?.status || 'TRIAL'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-carbon-800 text-zinc-400 text-xs font-mono">
                      {subData?.subscription?.cycle || 'MONTHLY'} BILLING
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Manage your merchant subscription tier, billing period, and quotas
                  </p>
                </div>

                <button
                  onClick={() => {
                    const plan = subData?.plans?.find((p: any) => p.id === subData?.subscription?.planId) || subData?.plans?.[0];
                    if (plan) handleOpenUpgradeModal(plan, subData?.subscription?.cycle || 'MONTHLY');
                  }}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-crimson-600/30 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Renew / Upgrade Subscription</span>
                </button>
              </div>

              {/* 4 Metric Mini-Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-white/10 pt-6">
                <div className="p-4 rounded-2xl bg-carbon-900/60 border border-white/5 space-y-1">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Access Expiration
                  </span>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    <span>
                      {subData?.subscription?.status === 'EXPIRED'
                        ? 'Expired / Inactive'
                        : `⏳ ${subData?.subscription?.daysRemaining ?? 0} Days Remaining`}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono block">
                    {subData?.subscription?.expiresAt
                      ? `Valid until ${new Date(subData.subscription.expiresAt).toLocaleDateString()}`
                      : 'Subscription Required'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-carbon-900/60 border border-white/5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono text-laser-400 uppercase tracking-wider block font-bold">
                      Wholesale Quota
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">Resale Items</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {subData?.subscription?.resaleProductCount ?? 0} /{' '}
                    {subData?.subscription?.maxResaleProducts === -1 ? 'Unlimited' : (subData?.subscription?.maxResaleProducts ?? 1)}
                  </div>
                  <div className="w-full bg-carbon-800 rounded-full h-1.5 overflow-hidden mt-1">
                    <div
                      className="bg-laser-500 h-full rounded-full transition-all"
                      style={{
                        width: `${
                          subData?.subscription?.maxResaleProducts === -1
                            ? 20
                            : Math.min(100, (((subData?.subscription?.resaleProductCount ?? 0) / (subData?.subscription?.maxResaleProducts || 1)) * 100))
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-carbon-900/60 border border-white/5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider block font-bold">
                      Custom Quota
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">Direct Accounts</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {subData?.subscription?.customProductCount ?? 0} /{' '}
                    {subData?.subscription?.maxCustomProducts === -1 ? 'Unlimited' : (subData?.subscription?.maxCustomProducts ?? 50)}
                  </div>
                  <div className="w-full bg-carbon-800 rounded-full h-1.5 overflow-hidden mt-1">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{
                        width: `${
                          subData?.subscription?.maxCustomProducts === -1
                            ? 20
                            : Math.min(100, (((subData?.subscription?.customProductCount ?? 0) / (subData?.subscription?.maxCustomProducts || 50)) * 100))
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-carbon-900/60 border border-white/5 space-y-1">
                  <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block">
                    Telegram Bot Engine
                  </span>
                  <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${subData?.subscription?.status === 'EXPIRED' ? 'bg-crimson-500' : 'bg-emerald-400 animate-pulse'}`}></span>
                    <span className={subData?.subscription?.status === 'EXPIRED' ? 'text-crimson-400' : 'text-emerald-400'}>
                      {subData?.subscription?.status === 'EXPIRED' ? 'Paused (Renew Needed)' : 'Active & Running'}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono block">
                    @{tenant?.bot_username || 'Telegram Bot'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Choose or Upgrade Plan Grid */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Available Subscription Tiers</h3>
                  <p className="text-xs text-zinc-400">
                    Switch between monthly or annual billing. Upgrades take effect instantly.
                  </p>
                </div>

                {/* Monthly / Yearly Toggle */}
                <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-carbon-800 border border-white/10">
                  <button
                    onClick={() => setSubCycleView('MONTHLY')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      subCycleView === 'MONTHLY'
                        ? 'bg-crimson-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Monthly Billing
                  </button>
                  <button
                    onClick={() => setSubCycleView('YEARLY')}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      subCycleView === 'YEARLY'
                        ? 'bg-gradient-to-r from-crimson-600 to-laser-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Yearly Billing</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase">
                      Save 20% 🎉
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(subData?.plans || []).map((p: any) => {
                  const isCurrent = subData?.subscription?.planId === p.id;
                  const priceUsd = subCycleView === 'YEARLY' ? p.price_yearly_usd : p.price_monthly_usd;
                  const features = Array.isArray(p.features_json) ? p.features_json : [];

                  return (
                    <div
                      key={p.id}
                      className={`glass-card rounded-3xl p-6 border transition-all flex flex-col justify-between ${
                        p.is_popular
                          ? 'border-crimson-500/50 bg-gradient-to-b from-carbon-800 to-carbon-850 shadow-xl'
                          : 'border-white/10'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-white">{p.name}</h4>
                              {p.is_popular === 1 && (
                                <span className="px-2 py-0.5 rounded-full bg-crimson-500/20 text-crimson-400 text-[10px] font-bold uppercase">
                                  Popular
                                </span>
                              )}
                            </div>
                            {p.description && <p className="text-xs text-zinc-400 mt-1">{p.description}</p>}
                          </div>
                        </div>

                        <div className="pt-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-extrabold text-white font-mono">
                              ${priceUsd.toFixed(2)}
                            </span>
                            <span className="text-xs text-zinc-400">
                              / {subCycleView === 'YEARLY' ? 'year' : 'month'}
                            </span>
                          </div>
                          <span className="text-[11px] text-zinc-500 font-mono block">
                            ~ ৳{Math.round(priceUsd * (tenant?.usd_to_bdt_rate || 125)).toLocaleString()} BDT
                          </span>
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-2">
                          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                            Included Quotas & Capabilities:
                          </span>
                          <div className="flex items-center gap-2 text-xs text-laser-300 font-semibold bg-laser-950/40 p-2 rounded-xl border border-laser-500/20">
                            <Tag className="w-3.5 h-3.5 text-laser-400 flex-shrink-0" />
                            <span>
                              Resale / Wholesale: <strong>{p.max_resale_products === -1 ? 'Unlimited' : `${p.max_resale_products} products`}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/20">
                            <Package className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span>
                              Custom Accounts: <strong>{p.max_custom_products === -1 ? 'Unlimited' : `${p.max_custom_products} products`}</strong>
                            </span>
                          </div>
                          {features.map((feat: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/10 mt-6">
                        <button
                          onClick={() => handleOpenUpgradeModal(p, subCycleView)}
                          className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-md ${
                            isCurrent
                              ? 'bg-carbon-700 hover:bg-carbon-600 text-white border border-white/10'
                              : 'bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white shadow-crimson-500/30'
                          }`}
                        >
                          {isCurrent ? 'Renew Current Plan' : `Upgrade to ${p.name}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Subscription History & Invoices */}
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white">Subscription Payment History</h3>
                <p className="text-xs text-zinc-400">Receipts and verified Binance Pay transactions</p>
              </div>

              <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-carbon-900 border-b border-white/10 font-mono text-zinc-400 uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Plan</th>
                        <th className="p-3.5">Billing Cycle</th>
                        <th className="p-3.5">Amount Paid</th>
                        <th className="p-3.5">Coupon</th>
                        <th className="p-3.5">Binance Trx ID</th>
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {subHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-zinc-500 text-xs font-sans">
                            No subscription payment history found yet.
                          </td>
                        </tr>
                      ) : (
                        subHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-white/[0.02]">
                            <td className="p-3.5 font-bold text-white">{h.plan_name}</td>
                            <td className="p-3.5 text-zinc-300">{h.billing_cycle}</td>
                            <td className="p-3.5 text-emerald-400 font-bold">${Number(h.final_amount_paid_usd).toFixed(2)} USDT</td>
                            <td className="p-3.5 text-zinc-400">{h.coupon_code || '-'}</td>
                            <td className="p-3.5 text-zinc-300">{h.trx_id}</td>
                            <td className="p-3.5 text-zinc-400">{new Date(h.created_at).toLocaleDateString()}</td>
                            <td className="p-3.5 text-right">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                                Verified
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>

      {/* ==========================================
          MODAL: BINANCE PAY SUBSCRIPTION CHECKOUT
         ========================================== */}
      {showSubModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 border border-white/10 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSubModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-crimson-400 font-bold text-base">
              <Shield className="w-5 h-5" />
              <span>Purchase Subscription with Binance Pay</span>
            </div>

            {/* Billing Cycle Switcher */}
            <div className="flex rounded-xl bg-carbon-900 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSubSelectedCycle('MONTHLY');
                  setAppliedCoupon(null);
                  setCouponFeedback(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  subSelectedCycle === 'MONTHLY'
                    ? 'bg-crimson-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubSelectedCycle('YEARLY');
                  setAppliedCoupon(null);
                  setCouponFeedback(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  subSelectedCycle === 'YEARLY'
                    ? 'bg-gradient-to-r from-laser-600 to-crimson-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                  2 Mo Free
                </span>
              </button>
            </div>

            {/* Plan Switcher Pills */}
            {subData?.plans && subData.plans.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-zinc-400 uppercase">Select Plan Tier:</label>
                <div className="grid grid-cols-3 gap-2">
                  {subData.plans.map((p: any) => {
                    const isSelected = subSelectedPlan?.id === p.id;
                    const price = subSelectedCycle === 'YEARLY' ? p.price_yearly_usd : p.price_monthly_usd;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSubSelectedPlan(p);
                          setAppliedCoupon(null);
                          setCouponFeedback(null);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-crimson-500/20 border-crimson-500 text-white ring-1 ring-crimson-500'
                            : 'bg-carbon-900 border-white/10 hover:border-white/20 text-zinc-400'
                        }`}
                      >
                        <span className="font-bold text-xs block text-white truncate">{p.name}</span>
                        <span className="text-[11px] font-mono font-extrabold text-laser-400 block">${price?.toFixed(0)} USD</span>
                        <span className="text-[9px] text-zinc-500 block truncate">
                          {p.max_resale_products === -1 ? 'Unlimited' : `${p.max_resale_products} Resale`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected Plan Summary Banner */}
            <div className="p-4 rounded-2xl bg-carbon-900 border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-white text-sm">{subSelectedPlan?.name}</h4>
                  <span className="text-xs text-zinc-400">{subSelectedCycle} Billing</span>
                </div>
                <div className="text-right">
                  <span className="text-base font-extrabold text-white font-mono">
                    ${subSelectedCycle === 'YEARLY' ? subSelectedPlan?.price_yearly_usd?.toFixed(2) : subSelectedPlan?.price_monthly_usd?.toFixed(2)} USD
                  </span>
                </div>
              </div>

              {/* Coupon Applied Details */}
              {appliedCoupon && (
                <div className="pt-2 border-t border-white/5 flex justify-between items-center text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Coupon "{appliedCoupon.code}" (-${appliedCoupon.discountAmountUsd} USD)
                  </span>
                  <span className="text-emerald-400 font-mono font-black text-sm">
                    ${appliedCoupon.finalPriceUsd.toFixed(2)} USDT Payable
                  </span>
                </div>
              )}
            </div>

            {/* Step 1: Coupon Code Application */}
            <form onSubmit={handleApplyCoupon} className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">Have a Promo Coupon?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. LAUNCH50, EID2026"
                  value={subCouponCode}
                  onChange={(e) => setSubCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !subCouponCode.trim()}
                  className="px-4 py-2.5 rounded-xl bg-carbon-700 hover:bg-carbon-600 disabled:opacity-50 text-white font-bold text-xs"
                >
                  {couponLoading ? 'Checking...' : 'Apply Coupon'}
                </button>
              </div>
              {couponFeedback && (
                <p className={`text-xs ${couponFeedback.type === 'success' ? 'text-emerald-400' : 'text-crimson-400'}`}>
                  {couponFeedback.message}
                </p>
              )}
            </form>

            {/* Step 2: Binance Transfer Instructions */}
            <div className="p-4 rounded-2xl bg-carbon-900 border border-laser-500/20 space-y-3">
              <span className="text-xs font-mono font-bold text-laser-400 uppercase tracking-wider block">
                Transfer Instructions (Binance Pay)
              </span>

              <div className="space-y-1 text-xs text-zinc-300">
                <p>1. Open your <b>Binance App</b> → Tap <b>Pay</b> → Tap <b>Send</b>.</p>
                <p>2. Select <b>Binance ID (UID)</b> and enter the Platform Owner UID below:</p>
              </div>

              <div className="p-3 rounded-xl bg-carbon-950 border border-white/10 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Platform Owner UID</span>
                  <span className="font-mono font-bold text-base text-white tracking-widest">
                    {subData?.ownerBinanceUid || '1147094108'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(subData?.ownerBinanceUid || '1147094108');
                    showNotice('UID Copied', 'Platform Owner Binance UID copied to clipboard!', 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-xs font-mono text-zinc-300"
                >
                  Copy UID
                </button>
              </div>

              <div className="text-xs text-zinc-300">
                <span>Amount to send: </span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  ${appliedCoupon
                    ? appliedCoupon.finalPriceUsd.toFixed(2)
                    : (subSelectedCycle === 'YEARLY' ? subSelectedPlan?.price_yearly_usd?.toFixed(2) : subSelectedPlan?.price_monthly_usd?.toFixed(2))} USDT
                </span>
              </div>
            </div>

            {/* Step 3: Transaction ID Verification Form */}
            <form onSubmit={handleVerifySubPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Binance Pay Transaction ID / Order ID (17+ digits)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 459917465708191744"
                  value={subTrxId}
                  onChange={(e) => setSubTrxId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
              </div>

              {subFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs ${
                    subFeedback.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-crimson-500/10 text-crimson-400 border border-crimson-500/30'
                  }`}
                >
                  {subFeedback.message}
                </div>
              )}

              <button
                type="submit"
                disabled={subVerifying || !subTrxId.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
              >
                {subVerifying ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    <span>Verifying with Binance SAPI...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Verify & Activate Subscription Instant ⚡</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-zinc-300">
                    Assign to Category / Folder
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInputInImport(!showNewCatInputInImport)}
                    className="text-[11px] text-laser-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {showNewCatInputInImport ? 'Select Existing' : '+ New Category'}
                  </button>
                </div>

                {showNewCatInputInImport ? (
                  <div className="space-y-1">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 🎬 OTT & Streaming, 🛡️ VPNs..."
                      value={importNewCategoryName}
                      onChange={(e) => setImportNewCategoryName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-laser-500/50 text-white text-xs focus:outline-none focus:border-laser-400"
                    />
                    <span className="text-[10px] text-laser-400 block">
                      This folder will be automatically created and assigned to this product!
                    </span>
                  </div>
                ) : (
                  <div>
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
                )}
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

      {/* ==========================================
          MODAL 6: CLEAR STORE CATALOG (1-CLICK CLEAR)
         ========================================== */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 border border-crimson-500/30 relative">
            <button
              onClick={() => setShowClearModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-crimson-400 font-bold text-base">
              <Trash2 className="w-5 h-5" /> Bulk Delete / Clear Store Catalog
            </div>

            <p className="text-xs text-zinc-400">
              Select which products you would like to purge from your Telegram bot and active store.
            </p>

            <div className="space-y-2 pt-2">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  clearScope === 'all'
                    ? 'bg-crimson-500/10 border-crimson-500 text-white'
                    : 'bg-carbon-800/60 border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="clearScope"
                  checked={clearScope === 'all'}
                  onChange={() => setClearScope('all')}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold text-xs block text-white">Clear ALL Store Products</span>
                  <span className="text-[11px] text-zinc-400">
                    Deletes all wholesale synced items and custom key inventory ({products.length} products).
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  clearScope === 'wholesale'
                    ? 'bg-crimson-500/10 border-crimson-500 text-white'
                    : 'bg-carbon-800/60 border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="clearScope"
                  checked={clearScope === 'wholesale'}
                  onChange={() => setClearScope('wholesale')}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold text-xs block text-white">Clear Wholesale Items Only</span>
                  <span className="text-[11px] text-zinc-400">
                    Purges cloud wholesale catalog items ({products.filter((p) => p.provider !== 'custom').length} products), preserving your custom accounts.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  clearScope === 'custom'
                    ? 'bg-crimson-500/10 border-crimson-500 text-white'
                    : 'bg-carbon-800/60 border-white/10 text-zinc-400 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="clearScope"
                  checked={clearScope === 'custom'}
                  onChange={() => setClearScope('custom')}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold text-xs block text-white">Clear Custom Accounts Only</span>
                  <span className="text-[11px] text-zinc-400">
                    Purges manually created accounts and keys ({products.filter((p) => p.provider === 'custom').length} products).
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={clearLoading}
                onClick={() => handleClearProducts(clearScope)}
                className="w-full py-3 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold text-xs shadow-lg shadow-crimson-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearLoading ? 'Deleting...' : 'Confirm & Delete Selected Products'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 7: SET GLOBAL PROFIT MARGIN & AUTO-SYNC
         ========================================== */}
      {showMarginModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 border border-laser-500/30 relative">
            <button
              onClick={() => setShowMarginModal(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-laser-400 font-bold text-base">
              <Sliders className="w-5 h-5" /> Dynamic Profit Margin Engine
            </div>

            <p className="text-xs text-zinc-400">
              Set a unified profit margin for all wholesale products. When upstream cloud providers change prices, your retail selling prices automatically update to preserve your profit!
            </p>

            <form onSubmit={handleApplyGlobalMargin} className="space-y-4 pt-2">
              {/* Margin Mode Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-carbon-800 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setMarginMode('fixed')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    marginMode === 'fixed'
                      ? 'bg-laser-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" /> Fixed Margin ($ USD)
                </button>
                <button
                  type="button"
                  onClick={() => setMarginMode('pct')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    marginMode === 'pct'
                      ? 'bg-laser-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span>% Percentage Markup</span>
                </button>
              </div>

              {marginMode === 'fixed' ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Fixed Profit Margin ($ USD per item)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-zinc-400 text-xs">
                      +$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.20"
                      value={marginFixedUsd}
                      onChange={(e) => setMarginFixedUsd(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                    />
                  </div>
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Example: If upstream cost is $1.00 and you set +$0.20, selling price is $1.20. If upstream becomes $1.50, selling price automatically becomes $1.70.
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Percentage Markup (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      required
                      placeholder="20"
                      value={marginPct}
                      onChange={(e) => setMarginPct(e.target.value)}
                      className="w-full pl-4 pr-9 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-zinc-400 text-xs">
                      %
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 mt-1 block">
                    Example: +20% markup on a $1.00 product sets retail to $1.20.
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={marginLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-laser-600 to-laser-500 hover:from-laser-500 text-white font-bold text-xs shadow-lg shadow-laser-500/25 transition-all flex items-center justify-center gap-2"
              >
                {marginLoading ? 'Applying...' : 'Apply Margin Across All Wholesale Products 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 8: QUICK EDIT INDIVIDUAL PRODUCT PRICE
         ========================================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-4 border border-white/10 relative">
            <button
              onClick={() => setEditingProduct(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <Edit3 className="w-5 h-5" /> Adjust Retail Selling Price
            </div>

            <div className="bg-carbon-800/80 p-4 rounded-2xl border border-white/5 space-y-2">
              <h4 className="font-bold text-sm text-white">{editingProduct.name}</h4>
              {editingProduct.provider !== 'custom' ? (
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Upstream Wholesale Cost:</span>
                  <span className="font-mono font-bold text-white">
                    ${Number(editingProduct.wholesale_price_usd || 0).toFixed(2)} USD
                  </span>
                </div>
              ) : (
                <div className="text-xs text-purple-400 font-semibold">Custom Account Product</div>
              )}
            </div>

            <form onSubmit={handleSaveProductPrice} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Retail Selling Price ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1.50"
                  value={newEditPrice}
                  onChange={(e) => setNewEditPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />

                {editingProduct.provider !== 'custom' && parseFloat(newEditPrice) > 0 && (
                  <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 mt-2">
                    <span>
                      Preserved Margin:{' '}
                      <strong className="text-emerald-400 font-bold">
                        +${(parseFloat(newEditPrice) - Number(editingProduct.wholesale_price_usd || 0)).toFixed(2)} USD
                      </strong>
                    </span>
                    <span>
                      ~ ৳ {(parseFloat(newEditPrice) * (overview?.usdToBdtRate || 125)).toFixed(0)} BDT
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Updated Price
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modern Cyber Dialog Modal System */}
      <CyberDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
};
