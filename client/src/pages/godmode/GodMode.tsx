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
  Tag,
  Plus,
  Percent,
  Calendar,
  Sparkles,
  Ticket,
  Copy,
  Check,
  Wallet,
  X,
} from 'lucide-react';
import { CyberDialog, CyberDialogOptions } from '../../components/CyberDialog';

export const GodMode: React.FC = () => {
  const [tokenInput, setTokenInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modern Popup Dialog System
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

  // Navigation tab inside GodMode (Dedicated tabs for Plans, Coupons, and Ledger)
  const [godTab, setGodTab] = useState<'merchants' | 'wholesale' | 'plans' | 'coupons' | 'subscriptions' | 'config'>('merchants');

  const [overview, setOverview] = useState<any>(null);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [wholesaleCatalog, setWholesaleCatalog] = useState<any[]>([]);
  const [wholesaleSearch, setWholesaleSearch] = useState('');
  const [wholesaleProviderFilter, setWholesaleProviderFilter] = useState<'all' | 'digitalcore' | 'vexorix' | 'canboso' | 'prodseller' | 'ssondigital'>('all');
  const [wholesaleCategoryFilter, setWholesaleCategoryFilter] = useState('all');
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState<string>('');

  // Subscription Plans & Coupons State
  const [plans, setPlans] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [subscriptionsHistory, setSubscriptionsHistory] = useState<any[]>([]);
  const [subTotalRevenue, setSubTotalRevenue] = useState(0);

  // Plan Modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState({
    id: '',
    name: '',
    description: '',
    priceMonthlyUsd: '',
    priceYearlyUsd: '',
    maxProducts: '50',
    maxResaleProducts: '5',
    maxCustomProducts: '50',
    allowWholesale: true,
    allowBinancePay: true,
    allowCustomBranding: false,
    featuresText: '',
    isPopular: false,
    isActive: true,
    sortOrder: '1',
  });

  // Coupon Modal
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [copiedCouponId, setCopiedCouponId] = useState<number | null>(null);
  const [couponForm, setCouponForm] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    applicablePlanId: 'ALL',
    applicableCycle: 'ALL',
    maxUses: '-1',
    expiresAt: '',
  });

  // Merchant Wallet Adjustment Modal State
  const [adjustingMerchant, setAdjustingMerchant] = useState<any | null>(null);
  const [walletAdjustAction, setWalletAdjustAction] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [walletAdjustProvider, setWalletAdjustProvider] = useState<string>('digitalcore');
  const [walletAdjustAmount, setWalletAdjustAmount] = useState('');
  const [walletAdjustNote, setWalletAdjustNote] = useState('');
  const [walletAdjustLoading, setWalletAdjustLoading] = useState(false);

  const [config, setConfig] = useState<any>({
    digitalcoreKey: '',
    vexorixKey: '',
    canbosoKey: '',
    prodsellerKey: '',
    ssondigitalKey: '',
    platformFeeFixedUsd: 0.01,
    platformFeePct: 0.0,
    ownerBinanceUid: '',
    ownerBinanceApiKey: '',
    ownerBinanceApiSecret: '',
    godmodeTelegramId: '',
    godmodeBotToken: '',
  });

  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
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
      const [overviewRes, merchantsRes, configRes, wholesaleRes, plansRes, couponsRes, subsRes] = await Promise.all([
        axios.get('/api/godmode/overview', headers),
        axios.get('/api/godmode/merchants', headers),
        axios.get('/api/godmode/config', headers),
        axios.get('/api/godmode/wholesale-catalog?refresh=true', headers),
        axios.get('/api/godmode/plans', headers),
        axios.get('/api/godmode/coupons', headers),
        axios.get('/api/godmode/subscriptions', headers),
      ]);
      setOverview(overviewRes.data);
      setMerchants(merchantsRes.data);
      setConfig(configRes.data);
      setWholesaleCatalog(wholesaleRes.data);
      setPlans(plansRes.data);
      setCoupons(couponsRes.data);
      setSubscriptionsHistory(subsRes.data.history || []);
      setSubTotalRevenue(subsRes.data.totalRevenueUsd || 0);
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

  // Trigger Live Price & Stock Synchronization (Cross-store)
  const handleTriggerLiveSync = async () => {
    setSyncLoading(true);
    try {
      const res = await axios.post('/api/godmode/sync-now', {}, getHeaders());
      showNotice('Sync Successful', res.data.message || 'Live price & stock synchronization completed.', 'success');
      loadGodModeData();
    } catch (err: any) {
      showNotice('Sync Failed', err.response?.data?.error || err.message, 'danger');
    } finally {
      setSyncLoading(false);
    }
  };

  // Toggle Merchant Killswitch
  const handleToggleKillswitch = async (merchantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const action = newStatus === 'SUSPENDED' ? 'SUSPEND (Kill Bot & Lock Store)' : 'ACTIVATE';

    showConfirm(
      `${action} Merchant Store?`,
      `Are you sure you want to ${action} this merchant store? All associated bot instances and store operations will be affected immediately.`,
      async () => {
        try {
          await axios.post(
            `/api/godmode/merchants/${merchantId}/status`,
            { status: newStatus },
            getHeaders()
          );
          loadGodModeData();
          showNotice('Status Updated', `Merchant store status changed to ${newStatus}.`, 'success');
        } catch (err: any) {
          showNotice('Action Failed', err.response?.data?.error || 'Failed to update merchant status', 'danger');
        }
      },
      newStatus === 'SUSPENDED' ? 'danger' : 'warning',
      action
    );
  };

  // Adjust Merchant Wallet (Open Dedicated Modal)
  const handleOpenAdjustWalletModal = (merchant: any) => {
    setAdjustingMerchant(merchant);
    setWalletAdjustAction('ADD');
    setWalletAdjustProvider('digitalcore');
    setWalletAdjustAmount('');
    setWalletAdjustNote('');
  };

  const handleConfirmWalletAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingMerchant) return;

    const numAmount = parseFloat(walletAdjustAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showNotice('Invalid Amount', 'Please enter a valid positive numeric amount greater than $0.00 USD.', 'warning');
      return;
    }

    const currentBal = Number(
      adjustingMerchant.walletsByProvider?.[walletAdjustProvider] ??
      (walletAdjustProvider === 'digitalcore' ? adjustingMerchant.wallet_usd || 0 : 0)
    );
    if (walletAdjustAction === 'DEDUCT' && currentBal < numAmount) {
      showNotice(
        'Insufficient Balance',
        `Cannot deduct $${numAmount.toFixed(2)} USD. Merchant currently has $${currentBal.toFixed(2)} USD in ${walletAdjustProvider.toUpperCase()} wallet.`,
        'danger'
      );
      return;
    }

    const delta = walletAdjustAction === 'ADD' ? numAmount : -numAmount;
    const finalNote = walletAdjustNote.trim() || (walletAdjustAction === 'ADD' ? `Manual GodMode credit (${walletAdjustProvider.toUpperCase()})` : `Manual GodMode debit (${walletAdjustProvider.toUpperCase()})`);

    setWalletAdjustLoading(true);
    try {
      await axios.post(
        `/api/godmode/merchants/${adjustingMerchant.id}/adjust-wallet`,
        { amountDeltaUsd: delta, note: finalNote, provider: walletAdjustProvider },
        getHeaders()
      );
      setAdjustingMerchant(null);
      setWalletAdjustAmount('');
      setWalletAdjustNote('');
      loadGodModeData();
      showNotice(
        'Balance Updated',
        `Successfully ${walletAdjustAction === 'ADD' ? 'credited' : 'deducted'} $${numAmount.toFixed(2)} USD (${walletAdjustProvider.toUpperCase()}) for ${adjustingMerchant.name}.`,
        'success'
      );
    } catch (err: any) {
      showNotice('Adjustment Failed', err.response?.data?.error || 'Wallet adjustment failed', 'danger');
    } finally {
      setWalletAdjustLoading(false);
    }
  };

  // Delete Single Merchant Store
  const handleDeleteMerchant = (merchantId: string, storeName: string, slug: string) => {
    showConfirm(
      `DELETE MERCHANT STORE?`,
      `⚠️ PERMANENT ACTION: Are you sure you want to permanently delete store "${storeName}" (bot.mogent.tech/${slug})?\n\nThis will stop any active Telegram bot and erase all custom products, inventory, orders, customer balances, and merchant records for this store. This cannot be undone.`,
      async () => {
        try {
          const res = await axios.delete(`/api/godmode/merchants/${merchantId}`, getHeaders());
          loadGodModeData();
          showNotice('Store Deleted', res.data?.message || `Merchant store "${storeName}" has been permanently removed.`, 'success');
        } catch (err: any) {
          showNotice('Deletion Failed', err.response?.data?.error || 'Failed to delete merchant store', 'danger');
        }
      },
      'danger',
      'Yes, Permanently Delete Store'
    );
  };

  // Purge ALL Test Merchants (Clean Slate)
  const handlePurgeAllMerchants = () => {
    showConfirm(
      'PURGE ALL TEST MERCHANTS?',
      `🚨 HIGH RISK DANGER: This will completely wipe all ${merchants.length} merchant stores, their bots, products, orders, customers, and subscription histories from the platform!\n\nPlatform configuration, subscription plans, and coupons will be preserved.\n\nAre you 100% sure you want to clean slate the database?`,
      async () => {
        try {
          const res = await axios.post('/api/godmode/merchants/purge-all', {}, getHeaders());
          loadGodModeData();
          showNotice('Database Cleaned', res.data?.message || 'All test merchants have been completely purged.', 'success');
        } catch (err: any) {
          showNotice('Purge Failed', err.response?.data?.error || 'Failed to purge merchants', 'danger');
        }
      },
      'danger',
      'Wipe All Test Stores Now ⚡'
    );
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
      showNotice('Product Updated', `Product status set to ${newActive ? 'Enabled' : 'Disabled'}.`, 'success');
    } catch (err: any) {
      showNotice('Action Failed', err.response?.data?.error || 'Failed to toggle product status', 'danger');
    }
  };

  // Custom Product Wholesale Price Override
  const handleSaveCustomPrice = async (productId: string) => {
    try {
      const parsedPrice = customPriceInput.trim() !== '' ? parseFloat(customPriceInput) : null;
      await axios.put(
        `/api/godmode/wholesale-rules/${productId}`,
        { customPriceUsd: parsedPrice },
        getHeaders()
      );
      setWholesaleCatalog((prev) =>
        prev.map((p) => {
          if (p.id === productId) {
            const newCost = parsedPrice && parsedPrice > 0 ? parsedPrice : p.cost_with_platform_fee_usd;
            return { ...p, cost_with_platform_fee_usd: newCost, custom_price_usd: parsedPrice };
          }
          return p;
        })
      );
      setEditingPriceProductId(null);
      showNotice('Price Override Saved', parsedPrice ? `Wholesale price set to ${parsedPrice.toFixed(2)} for merchants.` : 'Reverted to default auto-calculated wholesale price.', 'success');
    } catch (err: any) {
      showNotice('Save Failed', err.response?.data?.error || 'Failed to update custom wholesale price', 'danger');
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
      showNotice('Tier Gating Updated', `Minimum plan tier requirement set to "${newTier}".`, 'success');
    } catch (err: any) {
      showNotice('Action Failed', err.response?.data?.error || 'Failed to change plan tier requirement', 'danger');
    }
  };

  // 1-Click Delete / Remove Product from Platform
  const handleDeleteWholesaleProduct = async (productId: string, name: string) => {
    showConfirm(
      'Globally Delete Wholesale Product?',
      `Are you sure you want to globally delete/disable "${name}"? It will immediately disappear from all merchant wholesale catalogs and Telegram bots.`,
      async () => {
        try {
          await axios.delete(`/api/godmode/wholesale-rules/${productId}`, getHeaders());
          setWholesaleCatalog((prev) =>
            prev.map((p) => (p.id === productId ? { ...p, is_active_platform: 0 } : p))
          );
          showNotice('Product Deleted', `"${name}" removed from platform catalog.`, 'success');
        } catch (err: any) {
          showNotice('Action Failed', err.response?.data?.error || 'Failed to delete product rule', 'danger');
        }
      },
      'danger',
      'Delete Product'
    );
  };

  // 1-Click Bulk Wholesale Governance Action
  const handleBulkWholesaleAction = async (action: 'disable_all' | 'enable_all' | 'set_tier', minPlanTier?: string) => {
    const providerName = wholesaleProviderFilter.toUpperCase();
    const title = action === 'disable_all' ? 'Disable All Products?' : action === 'enable_all' ? 'Enable All Products?' : 'Set Tier for All Products?';
    const confirmMsg =
      action === 'disable_all'
        ? `Disable all wholesale products currently shown (${providerName})? They will immediately be hidden from all merchant stores and Telegram bots.`
        : action === 'enable_all'
        ? `Enable all wholesale products (${providerName}) for merchants?`
        : `Set minimum plan tier for all ${providerName} products to "${minPlanTier}"?`;

    showConfirm(
      title,
      confirmMsg,
      async () => {
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
          showNotice('Bulk Action Completed', res.data.message || 'Bulk action executed successfully.', 'success');
          await loadWholesaleCatalog();
        } catch (err: any) {
          showNotice('Bulk Action Failed', err.response?.data?.error || 'Bulk action failed', 'danger');
        } finally {
          setWholesaleLoading(false);
        }
      },
      action === 'disable_all' ? 'danger' : 'info'
    );
  };

  // Save Margin & Binance Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put('/api/godmode/config', config, getHeaders());
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
      loadGodModeData();
      showNotice('Configuration Saved', 'Wholesale keys, margin settings, and owner Binance Pay UID updated.', 'success');
    } catch (err: any) {
      showNotice('Save Failed', err.response?.data?.error || 'Failed to save global configuration', 'danger');
    }
  };

  // Plan Handlers
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      id: '',
      name: '',
      description: '',
      priceMonthlyUsd: '',
      priceYearlyUsd: '',
      maxProducts: '50',
      maxResaleProducts: '5',
      maxCustomProducts: '50',
      allowWholesale: true,
      allowBinancePay: true,
      allowCustomBranding: false,
      featuresText: '1 Active Telegram Bot\n5 Wholesale Resale Products\nUp to 50 Custom Products\nInstant Binance Pay\nCommunity Support',
      isPopular: false,
      isActive: true,
      sortOrder: String(plans.length + 1),
    });
    setShowPlanModal(true);
  };

  const handleEditPlan = (plan: any) => {
    setEditingPlan(plan);
    setPlanForm({
      id: plan.id,
      name: plan.name,
      description: plan.description || '',
      priceMonthlyUsd: String(plan.price_monthly_usd),
      priceYearlyUsd: String(plan.price_yearly_usd),
      maxProducts: String(plan.max_products || 50),
      maxResaleProducts: String(plan.max_resale_products !== undefined ? plan.max_resale_products : 5),
      maxCustomProducts: String(plan.max_custom_products !== undefined ? plan.max_custom_products : (plan.max_products || 50)),
      allowWholesale: Boolean(plan.allow_wholesale),
      allowBinancePay: Boolean(plan.allow_binance_pay),
      allowCustomBranding: Boolean(plan.allow_custom_branding),
      featuresText: Array.isArray(plan.features_json) ? plan.features_json.join('\n') : '',
      isPopular: Boolean(plan.is_popular),
      isActive: Boolean(plan.is_active),
      sortOrder: String(plan.sort_order || 0),
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const features = planForm.featuresText
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);

    try {
      const payload = {
        name: planForm.name,
        description: planForm.description,
        priceMonthlyUsd: parseFloat(planForm.priceMonthlyUsd) || 0,
        priceYearlyUsd: parseFloat(planForm.priceYearlyUsd) || 0,
        maxProducts: parseInt(planForm.maxCustomProducts) || 50,
        maxResaleProducts: parseInt(planForm.maxResaleProducts) || 5,
        maxCustomProducts: parseInt(planForm.maxCustomProducts) || 50,
        allowWholesale: planForm.allowWholesale,
        allowBinancePay: planForm.allowBinancePay,
        allowCustomBranding: planForm.allowCustomBranding,
        features,
        isPopular: planForm.isPopular,
        isActive: planForm.isActive,
        sortOrder: parseInt(planForm.sortOrder) || 0,
      };

      if (editingPlan) {
        await axios.put(`/api/godmode/plans/${editingPlan.id}`, payload, getHeaders());
        showNotice('Plan Updated', `Subscription plan "${planForm.name}" updated successfully.`, 'success');
      } else {
        await axios.post('/api/godmode/plans', { ...payload, id: planForm.id }, getHeaders());
        showNotice('Plan Created', `New subscription plan "${planForm.name}" created successfully.`, 'success');
      }
      setShowPlanModal(false);
      loadGodModeData();
    } catch (err: any) {
      showNotice('Save Failed', err.response?.data?.error || 'Failed to save plan', 'danger');
    }
  };

  const handleTogglePlanActive = async (plan: any) => {
    try {
      await axios.put(
        `/api/godmode/plans/${plan.id}`,
        { isActive: !plan.is_active },
        getHeaders()
      );
      loadGodModeData();
      showNotice('Plan Status Changed', `Plan "${plan.name}" is now ${plan.is_active ? 'deactivated' : 'active'}.`, 'success');
    } catch (err: any) {
      showNotice('Toggle Failed', err.response?.data?.error || 'Failed to toggle plan status', 'danger');
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    showConfirm(
      'Delete Subscription Plan?',
      `Are you sure you want to delete or deactivate plan "${planName}"? If merchants are already using it, it will be safely deactivated.`,
      async () => {
        try {
          const res = await axios.delete(`/api/godmode/plans/${planId}`, getHeaders());
          showNotice('Plan Deleted', res.data.message || 'Plan deleted', 'success');
          loadGodModeData();
        } catch (err: any) {
          showNotice('Action Failed', err.response?.data?.error || 'Failed to delete plan', 'danger');
        }
      },
      'danger',
      'Delete Plan'
    );
  };

  // Coupon Handlers
  const handleOpenCreateCoupon = () => {
    setCouponForm({
      code: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      applicablePlanId: 'ALL',
      applicableCycle: 'ALL',
      maxUses: '-1',
      expiresAt: '',
    });
    setShowCouponModal(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(
        '/api/godmode/coupons',
        {
          code: couponForm.code,
          discountType: couponForm.discountType,
          discountValue: parseFloat(couponForm.discountValue) || 0,
          applicablePlanId: couponForm.applicablePlanId,
          applicableCycle: couponForm.applicableCycle,
          maxUses: parseInt(couponForm.maxUses) || -1,
          expiresAt: couponForm.expiresAt || null,
        },
        getHeaders()
      );
      setShowCouponModal(false);
      showNotice('Coupon Created', `Discount voucher "${couponForm.code.toUpperCase()}" is live and ready for merchants!`, 'success');
      loadGodModeData();
    } catch (err: any) {
      showNotice('Coupon Error', err.response?.data?.error || 'Failed to create coupon', 'danger');
    }
  };

  const handleToggleCoupon = async (coupon: any) => {
    try {
      await axios.put(
        `/api/godmode/coupons/${coupon.id}`,
        { isActive: !coupon.is_active },
        getHeaders()
      );
      loadGodModeData();
      showNotice('Coupon Status', `Coupon "${coupon.code}" is now ${coupon.is_active ? 'disabled' : 'active'}.`, 'success');
    } catch (err: any) {
      showNotice('Action Failed', err.response?.data?.error || 'Failed to toggle coupon', 'danger');
    }
  };

  const handleDeleteCoupon = async (couponId: number, code: string) => {
    showConfirm(
      'Delete Discount Coupon?',
      `Are you sure you want to permanently delete coupon "${code}"?`,
      async () => {
        try {
          await axios.delete(`/api/godmode/coupons/${couponId}`, getHeaders());
          showNotice('Coupon Deleted', `Coupon "${code}" deleted successfully.`, 'success');
          loadGodModeData();
        } catch (err: any) {
          showNotice('Action Failed', err.response?.data?.error || 'Failed to delete coupon', 'danger');
        }
      },
      'danger',
      'Delete Coupon'
    );
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

          {/* Card 3: Vexorix (Mogent V2) Live */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">VEXORIX LIVE</span>
              <Zap className="w-4 h-4 text-laser-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-laser-400">
              ${overview?.wholesaleBalances?.vexorix?.balance?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-500">USD</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              Username: {overview?.wholesaleBalances?.vexorix?.username || 'Active'}
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

          {/* Card 4: ProdSeller (Mogent V4) Live */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">PRODSELLER (V4) LIVE</span>
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-indigo-400">
              ${overview?.wholesaleBalances?.prodseller?.balance?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-500">USD</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              Account: {overview?.wholesaleBalances?.prodseller?.username || 'Active'}
            </span>
          </div>

          {/* Card 5: SsonDigital (Mogent V5) Live */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">SSONDIGITAL (V5) LIVE</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-amber-400">
              ${overview?.wholesaleBalances?.ssondigital?.balance?.toFixed(2) || '0.00'} <span className="text-xs text-zinc-500">USD</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              Account: {overview?.wholesaleBalances?.ssondigital?.username || 'Active'}
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

          {/* Card 5: Subscription Revenue */}
          <div className="glass-card-cyber rounded-2xl p-5 border border-white/10 space-y-2">
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span className="font-mono">SUBSCRIPTION REVENUE</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-emerald-400">
              ${subTotalRevenue.toFixed(2)} <span className="text-xs text-zinc-500">USDT</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              Total Payments: {subscriptionsHistory.length}
            </span>
          </div>
        </div>

        {/* Navigation Tabs in GodMode */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-white/10 pb-2">
          <button
            onClick={() => setGodTab('merchants')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
              godTab === 'merchants'
                ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                : 'text-zinc-400 hover:text-white bg-carbon-900 border border-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Merchant Fleet ({merchants.length})</span>
          </button>
          <button
            onClick={() => setGodTab('wholesale')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
              godTab === 'wholesale'
                ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                : 'text-zinc-400 hover:text-white bg-carbon-900 border border-white/5'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Wholesale Governance ({wholesaleCatalog.length})</span>
          </button>
          <button
            onClick={() => setGodTab('plans')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
              godTab === 'plans'
                ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                : 'text-zinc-400 hover:text-white bg-carbon-900 border border-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-laser-400" />
            <span>Subscription Plans ({plans.length})</span>
          </button>
          <button
            onClick={() => setGodTab('coupons')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
              godTab === 'coupons'
                ? 'bg-laser-600 text-white shadow-lg shadow-laser-600/30'
                : 'text-laser-400 hover:text-white bg-carbon-900 border border-laser-500/20'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>🎟️ Discount Coupons ({coupons.length})</span>
          </button>
          <button
            onClick={() => setGodTab('subscriptions')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
              godTab === 'subscriptions'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-zinc-400 hover:text-white bg-carbon-900 border border-white/5'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Payment Ledger ({subscriptionsHistory.length})</span>
          </button>
          <button
            onClick={() => setGodTab('config')}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap flex items-center gap-1.5 ${
              godTab === 'config'
                ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                : 'text-zinc-400 hover:text-white bg-carbon-900 border border-white/5'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Margin & Binance Engine</span>
          </button>
        </div>

        {/* ==========================================
            TAB 1: MERCHANT FLEET & KILLSWITCHES
           ========================================== */}
        {godTab === 'merchants' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider">
                  Merchant Fleet Table ({merchants.length})
                </h3>
                <p className="text-xs text-zinc-400">Monitor all stores, wallets, and toggle emergency killswitches</p>
              </div>

              {merchants.length > 0 && (
                <button
                  onClick={handlePurgeAllMerchants}
                  className="px-3.5 py-2 rounded-xl bg-crimson-600/20 hover:bg-crimson-600/30 text-crimson-400 border border-crimson-500/40 text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-lg shadow-crimson-600/10 active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-crimson-400" />
                  <span>Purge All Test Stores</span>
                </button>
              )}
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
                          <td className="p-4 font-mono">
                            <div className="font-bold text-laser-400">${Number(m.wallet_usd || 0).toFixed(2)}</div>
                            {m.walletsByProvider && (
                              <div className="text-[10px] text-zinc-500 font-mono flex flex-wrap gap-1 mt-0.5">
                                {['vexorix', 'canboso', 'prodseller', 'ssondigital'].map(k => {
                                  const val = Number(m.walletsByProvider[k] || 0);
                                  if (val <= 0) return null;
                                  const tag = k === 'vexorix' ? 'V2' : k === 'canboso' ? 'V3' : k === 'prodseller' ? 'V4' : 'V5';
                                  return (
                                    <span key={k} className="px-1 py-0.2 rounded bg-carbon-800 text-zinc-300 border border-white/5">
                                      {tag}: ${val.toFixed(1)}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
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
                              onClick={() => handleOpenAdjustWalletModal(m)}
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
                            <button
                              onClick={() => handleDeleteMerchant(m.id, m.name, m.slug)}
                              className="px-2.5 py-1 rounded bg-crimson-950/60 hover:bg-crimson-900 text-crimson-400 border border-crimson-800/60 font-bold text-[10px] inline-flex items-center gap-1"
                              title="Delete store permanently"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
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
                  onClick={handleTriggerLiveSync}
                  disabled={syncLoading}
                  className="px-3.5 py-2 rounded-xl bg-laser-600/20 hover:bg-laser-600/30 border border-laser-500/40 text-laser-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                  title="Force immediate synchronization of upstream prices and stock across all stores"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
                  {syncLoading ? 'Syncing...' : '⚡ Sync Live Now (15s Auto)'}
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
                  setWholesaleProviderFilter('vexorix');
                  setWholesaleCategoryFilter('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  wholesaleProviderFilter === 'vexorix'
                    ? 'bg-crimson-600 text-white shadow-md shadow-crimson-600/30'
                    : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-laser-400" />
                <span>VEXORIX API</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40">
                  {wholesaleCatalog.filter((i) => i.provider?.toLowerCase() === 'vexorix').length}
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
              <button
                onClick={() => {
                  setWholesaleProviderFilter('prodseller');
                  setWholesaleCategoryFilter('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  wholesaleProviderFilter === 'prodseller'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>PRODSELLER (V4) API</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40">
                  {wholesaleCatalog.filter((i) => i.provider?.toLowerCase() === 'prodseller').length}
                </span>
              </button>
              <button
                onClick={() => {
                  setWholesaleProviderFilter('ssondigital');
                  setWholesaleCategoryFilter('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                  wholesaleProviderFilter === 'ssondigital'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                    : 'bg-carbon-900 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>SSONDIGITAL (V5) API</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/40">
                  {wholesaleCatalog.filter((i) => i.provider?.toLowerCase() === 'ssondigital').length}
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
                              <span className="font-bold text-white block">{p.name?.replace(/\{pe:\d+\}/gi, '').trim()}</span>
                              <span className="text-[10px] text-zinc-500">
                                {p.category?.replace(/\{pe:\d+\}/gi, '').trim()} · {p.id}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-carbon-800 text-zinc-300">
                                {p.provider}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-zinc-400">${p.base_price_usd.toFixed(2)}</td>
                            <td className="p-4">
                              {editingPriceProductId === p.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={customPriceInput}
                                    onChange={(e) => setCustomPriceInput(e.target.value)}
                                    placeholder={p.cost_with_platform_fee_usd.toFixed(2)}
                                    className="w-20 px-2 py-1 rounded bg-carbon-800 border border-laser-500 text-white font-mono text-xs focus:outline-none"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleSaveCustomPrice(p.id)}
                                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]"
                                    title="Save custom wholesale price"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingPriceProductId(null)}
                                    className="px-2 py-1 rounded bg-carbon-800 hover:bg-carbon-700 text-zinc-400 font-bold text-[10px]"
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group">
                                  <span className="font-bold text-emerald-400">
                                    ${p.cost_with_platform_fee_usd.toFixed(2)}
                                  </span>
                                  {p.custom_price_usd !== undefined && p.custom_price_usd !== null && (
                                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-mono">
                                      Custom
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingPriceProductId(p.id);
                                      setCustomPriceInput(p.custom_price_usd ? String(p.custom_price_usd) : String(p.cost_with_platform_fee_usd.toFixed(2)));
                                    }}
                                    className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white text-[10px] transition-colors"
                                    title="Customize / Increase wholesale price for this product"
                                  >
                                    ✎ Edit
                                  </button>
                                </div>
                              )}
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
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Vexorix (Mogent V2) Reseller API Key</label>
                  <input
                    type="text"
                    placeholder="Paste vexorix (207-148-64-141.sslip.io) key"
                    value={config.vexorixKey || ''}
                    onChange={(e) => setConfig({ ...config, vexorixKey: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
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

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">ProdSeller (Mogent V4) Reseller API Key</label>
                  <input
                    type="text"
                    placeholder="Paste prodseller.com API Key (psk_...)"
                    value={config.prodsellerKey || ''}
                    onChange={(e) => setConfig({ ...config, prodsellerKey: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">SsonDigital (Mogent V5) Reseller API Key</label>
                  <input
                    type="text"
                    placeholder="Paste ssondigitalworks.online Bearer Token / API Key"
                    value={config.ssondigitalKey || ''}
                    onChange={(e) => setConfig({ ...config, ssondigitalKey: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
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

              {/* God-Mode Telegram Alerts */}
              <div className="space-y-4 md:col-span-2 pt-4 border-t border-white/5">
                <h4 className="text-xs font-mono font-bold text-laser-400 uppercase">3. God-Mode Telegram Notifications (Wholesale Topups & Critical Alerts)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Your Telegram User ID (God Admin)</label>
                    <input
                      type="number"
                      placeholder="e.g. 6301160440"
                      value={config.godmodeTelegramId || ''}
                      onChange={(e) => setConfig({ ...config, godmodeTelegramId: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                    />
                    <span className="text-[10px] text-zinc-500">Get this from @userinfobot on Telegram. You will receive real-time alerts whenever a merchant tops up API wallet.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Dedicated Platform Bot Token (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 7123456789:AAH..."
                      value={config.godmodeBotToken || ''}
                      onChange={(e) => setConfig({ ...config, godmodeBotToken: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                    />
                    <span className="text-[10px] text-zinc-500">Leave blank to automatically use the merchant's bot token to deliver the notification.</span>
                  </div>
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

        {/* ==========================================
            TAB 4: SUBSCRIPTION PLANS & COUPONS ENGINE
           ========================================== */}
        {godTab === 'plans' && (
          <div className="space-y-10">
            {/* 1. Plans Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-crimson-400" />
                    Subscription Plans Management ({plans.length})
                  </h3>
                  <p className="text-xs text-zinc-400">Configure tiers, monthly/yearly pricing, limits, and public features</p>
                </div>
                <button
                  onClick={handleOpenCreatePlan}
                  className="px-4 py-2 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-crimson-600/30"
                >
                  <Plus className="w-4 h-4" /> Create New Plan
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((p) => {
                  const features = Array.isArray(p.features_json) ? p.features_json : [];
                  return (
                    <div
                      key={p.id}
                      className={`glass-card-cyber rounded-2xl p-6 border transition-all flex flex-col justify-between ${
                        p.is_popular ? 'border-crimson-500/50 bg-carbon-900/90' : 'border-white/10'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-white">{p.name}</h4>
                              {p.is_popular === 1 && (
                                <span className="px-2 py-0.5 rounded-full bg-crimson-500/20 text-crimson-400 text-[10px] font-mono font-bold uppercase">
                                  Popular
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-zinc-400">ID: {p.id}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              p.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                            }`}
                          >
                            {p.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </div>

                        {p.description && <p className="text-xs text-zinc-400">{p.description}</p>}

                        <div className="p-3.5 rounded-xl bg-carbon-950 border border-white/5 space-y-1.5 font-mono">
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Monthly:</span>
                            <span className="text-white font-bold">${p.price_monthly_usd.toFixed(2)} USD</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-zinc-400">Yearly:</span>
                            <span className="text-laser-400 font-bold">${p.price_yearly_usd.toFixed(2)} USD</span>
                          </div>
                          <div className="flex justify-between text-xs border-t border-white/5 pt-1.5 text-[11px]">
                            <span className="text-zinc-400">🛍️ Resale Quota:</span>
                            <span className="text-emerald-400 font-bold">{p.max_resale_products === -1 ? 'Unlimited' : `${p.max_resale_products} items`}</span>
                          </div>
                          <div className="flex justify-between text-xs text-[11px]">
                            <span className="text-zinc-400">📦 Custom Quota:</span>
                            <span className="text-laser-400 font-bold">{p.max_custom_products === -1 ? 'Unlimited' : `${p.max_custom_products} items`}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider block">
                            Features List:
                          </span>
                          <div className="space-y-1.5">
                            {features.map((feat: string, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-zinc-300">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-white/10 mt-6 flex items-center justify-between">
                        <button
                          onClick={() => handleTogglePlanActive(p)}
                          className={`text-xs font-mono font-bold flex items-center gap-1 ${
                            p.is_active ? 'text-zinc-400 hover:text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {p.is_active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-zinc-500" />}
                          <span>{p.is_active ? 'Active' : 'Enable'}</span>
                        </button>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditPlan(p)}
                            className="p-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-zinc-300 hover:text-white"
                            title="Edit Plan"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlan(p.id, p.name)}
                            className="p-1.5 rounded-lg bg-carbon-800 hover:bg-crimson-500/20 text-zinc-400 hover:text-crimson-400"
                            title="Delete Plan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: PROMOTIONAL & DISCOUNT COUPONS ENGINE
           ========================================== */}
        {godTab === 'coupons' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-laser-400" />
                  Promotional & Discount Coupons ({coupons.length})
                </h3>
                <p className="text-xs text-zinc-400">
                  Create discount vouchers for merchants. Percentage (%) or fixed USD ($) discounts with usage limits & expiry dates.
                </p>
              </div>
              <button
                onClick={handleOpenCreateCoupon}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-laser-600 to-laser-500 hover:from-laser-500 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-laser-600/30 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" /> Create New Coupon
              </button>
            </div>

            {/* Quick summary cards for Coupons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
              <div className="glass-card-cyber rounded-xl p-4 border border-white/10 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase">Total Coupons Created</span>
                <div className="text-xl font-bold text-white">{coupons.length}</div>
              </div>
              <div className="glass-card-cyber rounded-xl p-4 border border-white/10 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase">Active Coupons</span>
                <div className="text-xl font-bold text-emerald-400">{coupons.filter(c => c.is_active).length}</div>
              </div>
              <div className="glass-card-cyber rounded-xl p-4 border border-white/10 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase">Total Redemptions</span>
                <div className="text-xl font-bold text-laser-400">
                  {coupons.reduce((acc, c) => acc + (c.used_count || 0), 0)}
                </div>
              </div>
            </div>

            <div className="glass-card-cyber rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-carbon-900 border-b border-white/10 font-mono text-zinc-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Coupon Code</th>
                      <th className="p-3.5">Discount Value</th>
                      <th className="p-3.5">Applicable Tier</th>
                      <th className="p-3.5">Billing Cycle</th>
                      <th className="p-3.5">Usage Count</th>
                      <th className="p-3.5">Expiration</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {coupons.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-zinc-500 text-xs font-sans">
                          No coupons created yet. Click "+ Create New Coupon" above to generate promotional codes!
                        </td>
                      </tr>
                    ) : (
                      coupons.map((c) => (
                        <tr key={c.id} className="hover:bg-white/[0.02]">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm tracking-wider px-2.5 py-1 rounded-lg bg-carbon-800 border border-white/10">
                                {c.code}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(c.code);
                                  setCopiedCouponId(c.id);
                                  setTimeout(() => setCopiedCouponId(null), 2000);
                                }}
                                className="p-1 rounded bg-carbon-800 hover:bg-carbon-700 text-zinc-400 hover:text-white"
                                title="Copy Code"
                              >
                                {copiedCouponId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                          <td className="p-3.5 text-emerald-400 font-bold text-sm">
                            {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `$${Number(c.discount_value).toFixed(2)} OFF`}
                          </td>
                          <td className="p-3.5 text-zinc-300">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-carbon-800">
                              {c.applicable_plan_id === 'ALL' ? 'All Plans' : c.applicable_plan_id}
                            </span>
                          </td>
                          <td className="p-3.5 text-zinc-300">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-carbon-800">
                              {c.applicable_cycle}
                            </span>
                          </td>
                          <td className="p-3.5 text-zinc-400">
                            {c.used_count} / {c.max_uses === -1 ? '∞' : c.max_uses}
                          </td>
                          <td className="p-3.5 text-zinc-400">
                            {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                c.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                              }`}
                            >
                              {c.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleCoupon(c)}
                                className="p-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-zinc-300"
                                title="Toggle Status"
                              >
                                {c.is_active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4 text-zinc-500" />}
                              </button>
                              <button
                                onClick={() => handleDeleteCoupon(c.id, c.code)}
                                className="p-1.5 rounded-lg bg-carbon-800 hover:bg-crimson-500/20 text-zinc-400 hover:text-crimson-400"
                                title="Delete Coupon"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
        )}

        {/* ==========================================
            TAB 6: SUBSCRIPTION PAYMENT AUDIT LEDGER
           ========================================== */}
        {godTab === 'subscriptions' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  Subscription Payment Ledger (Direct to Owner UID)
                </h3>
                <p className="text-xs text-zinc-400">Audited Binance Pay subscriptions purchased across all merchants</p>
              </div>
              <div className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                Total Revenue: ${subTotalRevenue.toFixed(2)} USDT
              </div>
            </div>

            <div className="glass-card-cyber rounded-2xl border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-carbon-900 border-b border-white/10 font-mono text-zinc-400 uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Store / Merchant</th>
                      <th className="p-3.5">Plan</th>
                      <th className="p-3.5">Cycle</th>
                      <th className="p-3.5">Paid USDT</th>
                      <th className="p-3.5">Coupon</th>
                      <th className="p-3.5">Binance Trx ID</th>
                      <th className="p-3.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {subscriptionsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500 text-xs font-sans">
                          No subscription payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      subscriptionsHistory.map((s) => (
                        <tr key={s.id} className="hover:bg-white/[0.02]">
                          <td className="p-3.5 font-bold text-white">
                            {s.tenant_name} <span className="text-zinc-500 font-normal">({s.tenant_slug})</span>
                          </td>
                          <td className="p-3.5 text-laser-400 font-bold">{s.plan_name}</td>
                          <td className="p-3.5 text-zinc-300">{s.billing_cycle}</td>
                          <td className="p-3.5 text-emerald-400 font-bold">${Number(s.final_amount_paid_usd).toFixed(2)}</td>
                          <td className="p-3.5 text-zinc-400">{s.coupon_code || '-'}</td>
                          <td className="p-3.5 text-zinc-300 font-mono">{s.trx_id}</td>
                          <td className="p-3.5 text-zinc-400">{new Date(s.created_at).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create / Edit Subscription Plan */}
        {showPlanModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl max-w-lg w-full p-6 border border-white/10 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-base font-mono font-bold text-white">
                  {editingPlan ? `Edit Plan "${editingPlan.name}"` : 'Create New Subscription Plan'}
                </h3>
                <button onClick={() => setShowPlanModal(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
                {!editingPlan && (
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Unique Plan ID (slug)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. starter, pro, vip-scale"
                      value={planForm.id}
                      onChange={(e) => setPlanForm({ ...planForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pro Merchant Cloud"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Short summary for pricing card"
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Monthly Price ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="8.00"
                      value={planForm.priceMonthlyUsd}
                      onChange={(e) => setPlanForm({ ...planForm, priceMonthlyUsd: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Yearly Price ($ USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="80.00"
                      value={planForm.priceYearlyUsd}
                      onChange={(e) => setPlanForm({ ...planForm, priceYearlyUsd: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Resale Limit (-1 unlim)</label>
                    <input
                      type="number"
                      required
                      placeholder="5"
                      value={planForm.maxResaleProducts}
                      onChange={(e) => setPlanForm({ ...planForm, maxResaleProducts: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Custom Limit (-1 unlim)</label>
                    <input
                      type="number"
                      required
                      placeholder="50"
                      value={planForm.maxCustomProducts}
                      onChange={(e) => setPlanForm({ ...planForm, maxCustomProducts: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={planForm.sortOrder}
                      onChange={(e) => setPlanForm({ ...planForm, sortOrder: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">
                    Features List (One bullet per line)
                  </label>
                  <textarea
                    rows={4}
                    value={planForm.featuresText}
                    onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs"
                    placeholder="1 Active Telegram Bot&#10;Up to 50 Products&#10;Instant Binance Pay&#10;Priority Support"
                  ></textarea>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={planForm.allowWholesale}
                      onChange={(e) => setPlanForm({ ...planForm, allowWholesale: e.target.checked })}
                      className="rounded bg-carbon-800 border-white/20"
                    />
                    <span>Allow Wholesale Reseller Access</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={planForm.allowBinancePay}
                      onChange={(e) => setPlanForm({ ...planForm, allowBinancePay: e.target.checked })}
                      className="rounded bg-carbon-800 border-white/20"
                    />
                    <span>Allow Automated Binance Pay for Customers</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={planForm.isPopular}
                      onChange={(e) => setPlanForm({ ...planForm, isPopular: e.target.checked })}
                      className="rounded bg-carbon-800 border-white/20"
                    />
                    <span>Mark as "Most Popular" Tier</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={planForm.isActive}
                      onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                      className="rounded bg-carbon-800 border-white/20"
                    />
                    <span>Active & Available for Purchase</span>
                  </label>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowPlanModal(false)}
                    className="px-4 py-2 rounded-xl bg-carbon-800 text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white font-bold"
                  >
                    Save Plan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create Discount Coupon */}
        {showCouponModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl max-w-md w-full p-6 border border-white/10 space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-base font-mono font-bold text-white">Create New Discount Coupon</h3>
                <button onClick={() => setShowCouponModal(false)} className="text-zinc-400 hover:text-white">✕</button>
              </div>

              <form onSubmit={handleSaveCoupon} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Coupon Code (Uppercase)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LAUNCH50, EID2026, SAVE20"
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase().trim() })}
                    className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Discount Type</label>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED_USD">Fixed Amount ($ USD)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Discount Value</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder={couponForm.discountType === 'PERCENTAGE' ? '20' : '5.00'}
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Applicable Plan</label>
                    <select
                      value={couponForm.applicablePlanId}
                      onChange={(e) => setCouponForm({ ...couponForm, applicablePlanId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white"
                    >
                      <option value="ALL">All Plans</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Billing Cycle</label>
                    <select
                      value={couponForm.applicableCycle}
                      onChange={(e) => setCouponForm({ ...couponForm, applicableCycle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white"
                    >
                      <option value="ALL">Both Monthly & Yearly</option>
                      <option value="MONTHLY">Monthly Only</option>
                      <option value="YEARLY">Yearly Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Max Uses (-1 for unlimited)</label>
                    <input
                      type="number"
                      value={couponForm.maxUses}
                      onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-300 mb-1">Expiration Date (Optional)</label>
                    <input
                      type="date"
                      value={couponForm.expiresAt}
                      onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowCouponModal(false)}
                    className="px-4 py-2 rounded-xl bg-carbon-800 text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-laser-600 hover:bg-laser-500 text-white font-bold"
                  >
                    Create Coupon
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Merchant Wholesale Wallet Adjustment Modal */}
        {adjustingMerchant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-carbon-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-laser-600/20 text-laser-400 flex items-center justify-center font-bold">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white font-mono">Adjust Merchant Balance</h4>
                    <p className="text-xs text-zinc-400 font-mono">
                      {adjustingMerchant.name} (@{adjustingMerchant.slug})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustingMerchant(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                  Select Provider Wallet
                </label>
                <div className="grid grid-cols-5 gap-1 p-1 bg-carbon-800 rounded-xl border border-white/5">
                  {[
                    { id: 'digitalcore', label: 'V1', name: 'DigitalCore' },
                    { id: 'vexorix', label: 'V2', name: 'Vexorix' },
                    { id: 'canboso', label: 'V3', name: 'Canboso' },
                    { id: 'prodseller', label: 'V4', name: 'ProdSeller' },
                    { id: 'ssondigital', label: 'V5', name: 'SsonDigital' },
                  ].map((p) => {
                    const isSelected = walletAdjustProvider === p.id;
                    const bal = Number(
                      adjustingMerchant.walletsByProvider?.[p.id] ??
                      (p.id === 'digitalcore' ? adjustingMerchant.wallet_usd || 0 : 0)
                    );
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setWalletAdjustProvider(p.id)}
                        className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                          isSelected
                            ? 'bg-laser-600 text-white font-bold shadow-md shadow-laser-600/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="text-[11px] font-mono leading-none">{p.label}</div>
                        <div className="text-[9px] font-mono truncate mt-0.5 opacity-80">${bal.toFixed(1)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Balance Display */}
              <div className="p-3.5 rounded-xl bg-carbon-800/80 border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 font-mono">Current {walletAdjustProvider.toUpperCase()} Balance:</span>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    {[
                      { id: 'digitalcore', tag: 'V1' },
                      { id: 'vexorix', tag: 'V2' },
                      { id: 'canboso', tag: 'V3' },
                      { id: 'prodseller', tag: 'V4' },
                      { id: 'ssondigital', tag: 'V5' },
                    ].map(x => `${x.tag}: $${Number(adjustingMerchant.walletsByProvider?.[x.id] ?? (x.id === 'digitalcore' ? adjustingMerchant.wallet_usd || 0 : 0)).toFixed(2)}`).join(' | ')}
                  </div>
                </div>
                <span className="text-sm font-bold font-mono text-laser-400">
                  ${Number(
                    adjustingMerchant.walletsByProvider?.[walletAdjustProvider] ??
                    (walletAdjustProvider === 'digitalcore' ? adjustingMerchant.wallet_usd || 0 : 0)
                  ).toFixed(2)} USD
                </span>
              </div>

              <form onSubmit={handleConfirmWalletAdjustment} className="space-y-4">
                {/* Action Selector: Add or Deduct */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-carbon-800 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setWalletAdjustAction('ADD')}
                    className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all font-mono ${
                      walletAdjustAction === 'ADD'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Credit / Add (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletAdjustAction('DEDUCT')}
                    className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all font-mono ${
                      walletAdjustAction === 'DEDUCT'
                        ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Debit / Deduct (-)
                  </button>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                    Amount to {walletAdjustAction === 'ADD' ? 'Credit' : 'Debit'} ({walletAdjustProvider.toUpperCase()}) (USD $)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-zinc-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="10.00"
                      value={walletAdjustAmount}
                      onChange={(e) => setWalletAdjustAmount(e.target.value)}
                      className="w-full pl-7 pr-14 py-2 bg-carbon-800 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-laser-500"
                    />
                    <span className="absolute right-3 top-2.5 text-zinc-500 font-mono text-xs">USD</span>
                  </div>
                  {walletAdjustAmount && !isNaN(parseFloat(walletAdjustAmount)) && (
                    <p className="text-[11px] font-mono text-zinc-400 mt-1">
                      Resulting {walletAdjustProvider.toUpperCase()} Balance:{' '}
                      <span className="font-bold text-white">
                        $
                        {Math.max(
                          0,
                          walletAdjustAction === 'ADD'
                            ? Number(adjustingMerchant.walletsByProvider?.[walletAdjustProvider] ?? (walletAdjustProvider === 'digitalcore' ? adjustingMerchant.wallet_usd || 0 : 0)) + parseFloat(walletAdjustAmount)
                            : Number(adjustingMerchant.walletsByProvider?.[walletAdjustProvider] ?? (walletAdjustProvider === 'digitalcore' ? adjustingMerchant.wallet_usd || 0 : 0)) - parseFloat(walletAdjustAmount)
                        ).toFixed(2)}{' '}
                        USD
                      </span>
                    </p>
                  )}
                </div>

                {/* Audit Note */}
                <div>
                  <label className="block text-xs font-mono font-medium text-zinc-300 mb-1.5">
                    Audit Note / Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Manual wholesale credit, deposit adjustment, bonus..."
                    value={walletAdjustNote}
                    onChange={(e) => setWalletAdjustNote(e.target.value)}
                    className="w-full px-3 py-2 bg-carbon-800 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-laser-500 placeholder:text-zinc-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setAdjustingMerchant(null)}
                    className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={walletAdjustLoading || !walletAdjustAmount || parseFloat(walletAdjustAmount) <= 0}
                    className={`px-5 py-2 rounded-xl text-xs font-mono font-bold text-white shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                      walletAdjustAction === 'ADD'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                        : 'bg-crimson-600 hover:bg-crimson-500 shadow-crimson-600/30'
                    }`}
                  >
                    {walletAdjustLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {walletAdjustAction === 'ADD' ? 'Confirm Credit ($)' : 'Confirm Debit ($)'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Global CyberDialog Popup Modal */}
        <CyberDialog dialog={dialog} onClose={() => setDialog(null)} />
      </div>
    </div>
  );
};
