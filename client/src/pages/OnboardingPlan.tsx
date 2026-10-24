import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Bot,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Ticket,
  X,
  CreditCard,
  Globe
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly_usd: number;
  price_yearly_usd: number;
  max_products: number;
  max_resale_products: number;
  max_custom_products: number;
  allow_wholesale: number;
  allow_binance_pay: number;
  allow_custom_branding: number;
  features_json: string[];
  is_popular: number;
  is_active: number;
  sort_order: number;
}

export const OnboardingPlan: React.FC = () => {
  const { token, tenant, refreshSession } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [ownerBinanceUid, setOwnerBinanceUid] = useState('1147094108');
  const [loading, setLoading] = useState(true);

  // Modal checkout state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<'BD' | 'OTHERS'>(() => {
    return (localStorage.getItem('billing_country') as any) || 'BD';
  });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'BINANCE' | 'ZINIPAY'>('BINANCE');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmountUsd: number;
    finalPriceUsd: number;
  } | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Checkout state
  const [trxId, setTrxId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const authHeaders = {
    headers: { Authorization: `Bearer ${token}` },
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await axios.get('/api/merchant/subscription/current', authHeaders);
        const fetchedPlans: Plan[] = res.data?.plans || [];
        setPlans(fetchedPlans);
        if (res.data?.ownerBinanceUid) {
          setOwnerBinanceUid(res.data.ownerBinanceUid);
        }
        const defaultPlan = fetchedPlans.find((p) => p.is_popular === 1) || fetchedPlans[0];
        if (defaultPlan) setSelectedPlan(defaultPlan);
      } catch (err) {
        console.error('Failed to load subscription plans:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [token]);

  // Copy UID helper
  const handleCopyUid = () => {
    navigator.clipboard.writeText(ownerBinanceUid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2500);
  };

  // Open checkout for a plan
  const handleOpenCheckout = (plan: Plan) => {
    setSelectedPlan(plan);
    setAppliedCoupon(null);
    setCouponFeedback(null);
    setCouponCode('');
    setTrxId('');
    setVerifyFeedback(null);
    setShowCheckoutModal(true);
  };

  // Switch cycle
  const handleSwitchCycle = (cycle: 'MONTHLY' | 'YEARLY') => {
    setSelectedCycle(cycle);
    setAppliedCoupon(null);
    setCouponFeedback(null);
    setCouponCode('');
  };

  // Validate coupon
  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || !selectedPlan) return;
    setCouponLoading(true);
    setCouponFeedback(null);

    try {
      const res = await axios.post(
        '/api/merchant/subscription/validate-coupon',
        {
          code: couponCode.trim(),
          planId: selectedPlan.id,
          cycle: selectedCycle,
        },
        authHeaders
      );
      setAppliedCoupon(res.data);
      setCouponFeedback({
        type: 'success',
        message: `Coupon "${res.data.code}" applied! (-$${res.data.discountAmountUsd} USD)`,
      });
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Invalid or expired coupon',
      });
    } finally {
      setCouponLoading(false);
    }
  };

  // Verify Binance Pay
  const handleVerifyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId.trim() || !selectedPlan) return;
    setVerifying(true);
    setVerifyFeedback(null);

    try {
      const res = await axios.post(
        '/api/merchant/subscription/verify-binance',
        {
          planId: selectedPlan.id,
          cycle: selectedCycle,
          couponCode: appliedCoupon?.code || undefined,
          trxId: trxId.trim(),
        },
        authHeaders
      );

      setVerifyFeedback({
        type: 'success',
        message: res.data.message || 'Subscription successfully activated!',
      });

      await refreshSession();

      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } catch (err: any) {
      setVerifyFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Verification failed. Please check TrxID and sent amount.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const basePrice = selectedCycle === 'YEARLY'
    ? (selectedPlan?.price_yearly_usd || 80)
    : (selectedPlan?.price_monthly_usd || 8);

  const payablePrice = appliedCoupon ? appliedCoupon.finalPriceUsd : basePrice;

  return (
    <div className="min-h-screen bg-carbon-950 text-white font-sans flex flex-col justify-between relative overflow-hidden select-none">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-crimson-600/10 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-10 w-[400px] h-[300px] bg-laser-600/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Compact Top Header */}
      <header className="border-b border-white/10 bg-carbon-900/70 backdrop-blur-md px-5 py-2.5 flex items-center justify-between z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-crimson-600 to-laser-600 flex items-center justify-center shadow-md shadow-crimson-500/20">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-xs tracking-wider uppercase text-white block">
              Mogent Cloud
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">Store: {tenant?.name || 'My Store'}</span>
          </div>
        </div>

        {/* Stepper in Center */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
          <div className="flex items-center gap-1 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>1. Store Created</span>
          </div>
          <span className="text-zinc-600">→</span>
          <div className="flex items-center gap-1 text-crimson-400 font-bold bg-crimson-500/10 px-2 py-0.5 rounded-full border border-crimson-500/30">
            <span className="w-3 h-3 rounded-full bg-crimson-500 text-white flex items-center justify-center text-[9px]">2</span>
            <span>2. Select Plan</span>
          </div>
          <span className="text-zinc-600">→</span>
          <div className="flex items-center gap-1 text-zinc-500">
            <span className="w-3 h-3 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center text-[9px]">3</span>
            <span>3. Launch Bot</span>
          </div>
        </div>

        {/* Right Action */}
        <div className="flex items-center gap-3">
          {tenant?.subscription_status === 'ACTIVE' && (
            <button
              onClick={() => navigate('/admin')}
              className="text-xs text-zinc-300 hover:text-white transition-colors flex items-center gap-1"
            >
              <span>Dashboard</span> &rarr;
            </button>
          )}
          <button
            onClick={() => {
              localStorage.removeItem('mogent_token');
              window.location.href = '/login';
            }}
            className="text-xs text-zinc-500 hover:text-crimson-400 transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main Content Area (Fitted for Zero Scroll) */}
      <main className="flex-1 flex flex-col justify-center max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-5 relative z-10">
        {/* Title & Billing Toggle Row */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 text-[11px] font-mono font-medium">
            <Sparkles className="w-3 h-3" />
            <span>Zero Transaction Fee • Automated Telegram Bot</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Choose Your Store Subscription
          </h1>

          <p className="text-xs text-zinc-400 max-w-lg mx-auto">
            Select a plan to immediately activate your Telegram bot and start selling digital products.
          </p>

          {/* Compact Billing Switcher */}
          <div className="pt-1 flex items-center justify-center">
            <div className="p-1 rounded-xl bg-carbon-900 border border-white/10 inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSwitchCycle('MONTHLY')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCycle === 'MONTHLY'
                    ? 'bg-crimson-600 text-white shadow-md shadow-crimson-600/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => handleSwitchCycle('YEARLY')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedCycle === 'YEARLY'
                    ? 'bg-gradient-to-r from-laser-600 to-crimson-600 text-white shadow-md shadow-laser-600/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] uppercase font-mono font-black">
                  Save ~17% (2 Mo Free)
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Compact Plan Cards */}
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-crimson-500 border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {plans.map((p) => {
              const isPopular = p.is_popular === 1;
              const price = selectedCycle === 'YEARLY' ? p.price_yearly_usd : p.price_monthly_usd;
              const perMonthDisplay = selectedCycle === 'YEARLY' ? (p.price_yearly_usd / 12).toFixed(1) : p.price_monthly_usd.toFixed(2);

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl p-5 sm:p-5 flex flex-col justify-between transition-all duration-200 relative border ${
                    isPopular
                      ? 'bg-gradient-to-b from-carbon-850 to-carbon-900 border-crimson-500 shadow-xl shadow-crimson-500/10 ring-1 ring-crimson-500'
                      : 'bg-carbon-900/90 border-white/10 hover:border-white/20'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-crimson-500 to-laser-500 text-white text-[9px] font-mono font-black uppercase tracking-wider shadow-sm">
                      MOST POPULAR
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-white">{p.name}</h3>
                      <p className="text-[11px] text-zinc-400 line-clamp-1">{p.description}</p>
                    </div>

                    {/* Price Block */}
                    <div className="py-1.5 border-y border-white/5 flex items-baseline justify-between">
                      <div>
                        <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">${price.toFixed(0)}</span>
                        <span className="text-[10px] text-zinc-400 font-mono ml-1">USD / {selectedCycle === 'YEARLY' ? 'yr' : 'mo'}</span>
                      </div>
                      {selectedCycle === 'YEARLY' && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          ~${perMonthDisplay}/mo
                        </span>
                      )}
                    </div>

                    {/* Compact Quota Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-xl bg-carbon-950/80 border border-white/5">
                        <span className="text-zinc-500 text-[10px] block">Wholesale Resale:</span>
                        <span className="font-bold text-laser-400">
                          {p.max_resale_products === -1 ? 'Unlimited' : `${p.max_resale_products} Products`}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-carbon-950/80 border border-white/5">
                        <span className="text-zinc-500 text-[10px] block">Custom Accounts:</span>
                        <span className="font-bold text-emerald-400">
                          {p.max_custom_products === -1 ? 'Unlimited' : `${p.max_custom_products} Accounts`}
                        </span>
                      </div>
                    </div>

                    {/* Short Key Feature Bullets */}
                    <ul className="space-y-1.5 text-xs text-zinc-300">
                      {p.features_json?.slice(0, 4).map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="truncate">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Choose & Pay CTA */}
                  <div className="pt-4 mt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenCheckout(p)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-98 ${
                        isPopular
                          ? 'bg-crimson-600 hover:bg-crimson-500 text-white shadow-lg shadow-crimson-600/30'
                          : 'bg-carbon-800 hover:bg-carbon-700 text-white border border-white/10'
                      }`}
                    >
                      <span>Choose {p.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="text-center text-[10px] text-zinc-600 py-2 border-t border-white/5 z-10">
        Mogent Cloud • Instant Automated Binance Pay Activation • 100% Zero Fee SAPI
      </footer>

      {/* ==========================================
          MODAL: BINANCE PAY CHECKOUT (ZERO SCROLL)
         ========================================== */}
      {showCheckoutModal && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="glass-card rounded-3xl p-5 sm:p-7 max-w-xl w-full border border-white/10 relative shadow-2xl bg-carbon-900/95 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Plan</span>
              </button>

              <div className="flex items-center gap-1.5 text-crimson-400 font-bold text-xs uppercase font-mono tracking-wider">
                <Shield className="w-4 h-4" />
                <span>Instant SAPI Activation</span>
              </div>

              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Plan Summary Banner */}
            <div className="p-3 rounded-xl bg-carbon-950 border border-white/10 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-sm block">{selectedPlan.name}</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {selectedCycle} Billing ({selectedCycle === 'YEARLY' ? '12 Months' : '1 Month'})
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-zinc-400 block font-mono">Total Payable:</span>
                <span className="text-lg font-extrabold text-emerald-400 font-mono">
                  ${payablePrice.toFixed(2)} USDT
                </span>
                {selectedCountry === 'BD' && (
                  <span className="text-[10px] text-zinc-500 font-mono block">
                    ~ ৳ {Math.round(payablePrice * 125).toLocaleString()} BDT
                  </span>
                )}
              </div>
            </div>

            {/* Step 1: Country Geo-Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                1. Select Billing Region / Country:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCountry('BD');
                    localStorage.setItem('billing_country', 'BD');
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    selectedCountry === 'BD'
                      ? 'bg-crimson-600/20 border-crimson-500 text-white shadow-md ring-1 ring-crimson-500'
                      : 'bg-carbon-800 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="text-base">🇧🇩</span>
                  <span>Bangladesh (BD)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCountry('OTHERS');
                    setSelectedPaymentMethod('BINANCE');
                    localStorage.setItem('billing_country', 'OTHERS');
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    selectedCountry === 'OTHERS'
                      ? 'bg-laser-600/20 border-laser-500 text-white shadow-md ring-1 ring-laser-500'
                      : 'bg-carbon-800 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Globe className="w-4 h-4 text-laser-400" />
                  <span>International / Others</span>
                </button>
              </div>
            </div>

            {/* Step 2: Payment Method (Only shown for BD; Others is forced to Binance Pay Crypto) */}
            {selectedCountry === 'BD' && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                  2. Select Payment Method:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('BINANCE')}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedPaymentMethod === 'BINANCE'
                        ? 'bg-amber-500/20 border-amber-500 text-white shadow-md ring-1 ring-amber-500'
                        : 'bg-carbon-800 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>🟡 Binance Pay (USDT)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('ZINIPAY')}
                    className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      selectedPaymentMethod === 'ZINIPAY'
                        ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-md ring-1 ring-emerald-500'
                        : 'bg-carbon-800 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>⚡ bKash / Nagad</span>
                  </button>
                </div>
              </div>
            )}

            {/* BD Local Payment Card (bKash / Nagad / ZiniPay) */}
            {selectedCountry === 'BD' && selectedPaymentMethod === 'ZINIPAY' && (
              <div className="p-4 rounded-2xl bg-carbon-950 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> Local Mobile Banking Payment
                  </span>
                  <span className="font-mono text-sm font-black text-white">
                    ৳ {Math.round(payablePrice * 125).toLocaleString()} BDT
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  বিকাশ, নগদ বা রকেট দিয়ে ইনস্ট্যান্ট প্ল্যান সাবস্ক্রিপশনের জন্য আমাদের অফিশিয়াল টেলিগ্রাম সাপোর্টে যোগাযোগ করুন। পেমেন্ট কনফার্মেশনের সাথে সাথে আপনার স্টোর অ্যাক্টিভেট করে দেওয়া হবে।
                </p>
                <div className="p-2.5 rounded-xl bg-carbon-900 border border-white/5 text-[11px] text-zinc-400 flex justify-between items-center font-mono">
                  <span>Exchange Rate: <b>$1.00 USD = 125 BDT</b></span>
                  <span className="text-emerald-400 font-bold">Manual / Instant</span>
                </div>
                <a
                  href="https://t.me/mogentsupport"
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white font-bold text-xs text-center transition-all shadow-lg shadow-emerald-600/20"
                >
                  💬 Pay via bKash/Nagad on Telegram Support
                </a>
              </div>
            )}

            {/* Promo Coupon Form */}
            {!(selectedCountry === 'BD' && selectedPaymentMethod === 'ZINIPAY') && (
            <form onSubmit={handleApplyCoupon} className="space-y-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Coupon code (e.g. MOGENT50)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-3.5 py-2 rounded-xl bg-carbon-700 hover:bg-carbon-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  <span>{couponLoading ? 'Checking...' : 'Apply'}</span>
                </button>
              </div>

              {couponFeedback && (
                <p className={`text-[11px] ${couponFeedback.type === 'success' ? 'text-emerald-400' : 'text-crimson-400'}`}>
                  {couponFeedback.message}
                </p>
              )}
            </form>
            )}

            {/* Binance UID Card & Verification Form */}
            {!(selectedCountry === 'BD' && selectedPaymentMethod === 'ZINIPAY') && (
              <>
                <div className="p-3.5 rounded-xl bg-carbon-950 border border-laser-500/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span className="font-mono text-laser-400 font-bold uppercase">
                      {selectedCountry === 'OTHERS' ? '1. Global Binance Pay Transfer:' : '1. Send to Binance UID:'}
                    </span>
                    <span className="font-mono text-emerald-400 font-bold">Amount: ${payablePrice.toFixed(2)} USDT</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-carbon-900 border border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase font-mono">Platform Owner Binance UID</span>
                      <span className="text-base font-bold font-mono text-white tracking-widest">{ownerBinanceUid}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyUid}
                      className="px-3 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-xs font-mono text-zinc-200 flex items-center gap-1"
                    >
                      {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUid ? 'Copied' : 'Copy UID'}</span>
                    </button>
                  </div>
                </div>

                {/* Transaction ID Verification Form */}
                <form onSubmit={handleVerifyPayment} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                      2. Enter 17-digit Binance Pay Transaction ID / Order ID:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 459917465708191744"
                      value={trxId}
                      onChange={(e) => setTrxId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                    />
                  </div>

                  {verifyFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-xs ${
                        verifyFeedback.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-crimson-500/10 text-crimson-400 border border-crimson-500/30'
                      }`}
                    >
                      {verifyFeedback.message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verifying || !trxId.trim()}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-1.5 active:scale-98 transition-all"
                  >
                    {verifying ? (
                      <>
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                        <span>Verifying with Binance SAPI...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Verify & Activate Store Instant ⚡</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
