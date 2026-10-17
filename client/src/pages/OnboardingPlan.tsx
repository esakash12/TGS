import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Bot,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
  ArrowRight,
  Copy,
  Check,
  Ticket,
  Lock,
  ChevronRight,
  ExternalLink,
  Layers,
  Crown
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
        // Select popular or starter by default
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

  // Switch Plan or Cycle helper
  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setAppliedCoupon(null);
    setCouponFeedback(null);
    setCouponCode('');
  };

  const handleSelectCycle = (cycle: 'MONTHLY' | 'YEARLY') => {
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
        message: `Coupon "${res.data.code}" applied! You save $${res.data.discountAmountUsd} USD.`,
      });
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Invalid or expired coupon code',
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

      // Smooth delay for celebratory experience
      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } catch (err: any) {
      setVerifyFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Payment verification failed. Please verify your TrxID and sent amount.',
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
    <div className="min-h-screen bg-carbon-950 text-white font-sans relative overflow-x-hidden pb-16">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-crimson-600/10 rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-laser-600/10 rounded-full blur-[160px] pointer-events-none"></div>

      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-carbon-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-crimson-600 to-laser-600 flex items-center justify-center shadow-lg shadow-crimson-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-300">
                Mogent Cloud
              </span>
              <span className="text-[10px] text-zinc-500 block font-mono">Store: {tenant?.name || 'My Store'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Skip to Dashboard &rarr;
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 space-y-10 relative z-10">
        {/* Onboarding Wizard Stepper */}
        <div className="flex items-center justify-center max-w-xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>1. Store Created</span>
            </div>
            <div className="w-10 h-0.5 bg-emerald-500/50"></div>
            <div className="flex items-center gap-1.5 text-crimson-400 font-bold">
              <span className="w-4 h-4 rounded-full bg-crimson-500 text-white flex items-center justify-center text-[10px]">2</span>
              <span>2. Select Plan</span>
            </div>
            <div className="w-10 h-0.5 bg-white/10"></div>
            <div className="flex items-center gap-1.5 text-zinc-500">
              <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center text-[10px]">3</span>
              <span>3. Launch Bot</span>
            </div>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 text-xs font-mono font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Scale with Zero Platform Commission</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Choose Your Store Subscription
          </h1>
          <p className="text-sm text-zinc-400">
            Activate your automated Telegram bot and instant digital product delivery. Upgrade, downgrade, or cancel anytime.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="pt-4 flex items-center justify-center">
            <div className="p-1 rounded-2xl bg-carbon-900 border border-white/10 inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSelectCycle('MONTHLY')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCycle === 'MONTHLY'
                    ? 'bg-crimson-600 text-white shadow-lg shadow-crimson-600/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => handleSelectCycle('YEARLY')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  selectedCycle === 'YEARLY'
                    ? 'bg-gradient-to-r from-laser-600 to-crimson-600 text-white shadow-lg shadow-laser-600/30'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-mono font-extrabold">
                  Save ~17% (2 Mo Free)
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Plan Cards Grid */}
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-crimson-500 border-t-transparent animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => {
              const isSelected = selectedPlan?.id === p.id;
              const price = selectedCycle === 'YEARLY' ? p.price_yearly_usd : p.price_monthly_usd;
              const perMonthDisplay = selectedCycle === 'YEARLY' ? (p.price_yearly_usd / 12).toFixed(1) : p.price_monthly_usd.toFixed(2);

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPlan(p)}
                  className={`rounded-3xl p-6 sm:p-7 cursor-pointer transition-all duration-300 relative flex flex-col justify-between border ${
                    isSelected
                      ? 'bg-gradient-to-b from-carbon-850 to-carbon-900 border-crimson-500 shadow-2xl shadow-crimson-500/20 ring-1 ring-crimson-500 scale-[1.02]'
                      : 'bg-carbon-900/80 border-white/10 hover:border-white/20 hover:bg-carbon-850'
                  }`}
                >
                  {p.is_popular === 1 && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-crimson-500 to-laser-500 text-white text-[10px] font-mono font-black uppercase tracking-widest shadow-md">
                      MOST POPULAR
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white">{p.name}</h3>
                        <p className="text-xs text-zinc-400 mt-1">{p.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-crimson-500 bg-crimson-500' : 'border-zinc-600'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>

                    <div className="py-2 border-y border-white/5 space-y-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono">${price.toFixed(2)}</span>
                        <span className="text-xs text-zinc-400 font-mono">USD / {selectedCycle === 'YEARLY' ? 'yr' : 'mo'}</span>
                      </div>
                      {selectedCycle === 'YEARLY' && (
                        <span className="text-[11px] text-emerald-400 font-mono block">
                          ~ ${perMonthDisplay}/mo billed annually
                        </span>
                      )}
                    </div>

                    {/* Resale vs Custom Product Limits Highlights */}
                    <div className="p-3 rounded-2xl bg-carbon-950/60 border border-white/5 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">Wholesale Resale:</span>
                        <span className="font-bold text-laser-400">
                          {p.max_resale_products === -1 ? 'Unlimited' : `${p.max_resale_products} Products`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400">Custom Products:</span>
                        <span className="font-bold text-emerald-400">
                          {p.max_custom_products === -1 ? 'Unlimited' : `${p.max_custom_products} Accounts`}
                        </span>
                      </div>
                    </div>

                    {/* Feature Checklist */}
                    <ul className="space-y-2.5 pt-2 text-xs text-zinc-300">
                      {p.features_json?.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-crimson-600 hover:bg-crimson-500 text-white shadow-lg shadow-crimson-600/30'
                          : 'bg-carbon-800 hover:bg-carbon-700 text-zinc-300'
                      }`}
                    >
                      {isSelected ? 'Selected Plan' : 'Choose Plan'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Plan Binance Pay Checkout Card */}
        {selectedPlan && (
          <div className="glass-card rounded-3xl p-6 sm:p-10 border border-white/10 space-y-8 bg-carbon-900/90 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-crimson-400 font-bold uppercase tracking-wider">
                  <Shield className="w-4 h-4" />
                  <span>Instant Automated SAPI Activation</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Activate {selectedPlan.name} ({selectedCycle})
                </h2>
              </div>

              <div className="text-right">
                <span className="text-xs text-zinc-400 font-mono block">Amount Payable</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                  ${payablePrice.toFixed(2)} USDT
                </span>
              </div>
            </div>

            {/* Step 1: Promo Coupon */}
            <form onSubmit={handleApplyCoupon} className="space-y-2 max-w-lg">
              <label className="block text-xs font-semibold text-zinc-300">Have a Discount Coupon?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. MOGENT50, LAUNCH2026"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponCode.trim()}
                  className="px-5 py-2.5 rounded-xl bg-carbon-700 hover:bg-carbon-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Ticket className="w-3.5 h-3.5" />
                  {couponLoading ? 'Checking...' : 'Apply Coupon'}
                </button>
              </div>

              {couponFeedback && (
                <p className={`text-xs ${couponFeedback.type === 'success' ? 'text-emerald-400' : 'text-crimson-400'}`}>
                  {couponFeedback.message}
                </p>
              )}
            </form>

            {/* Step 2: Binance UID Transfer Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-carbon-950 border border-white/10">
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-laser-400 uppercase tracking-wider block">
                  1. Send USDT via Binance Pay
                </span>
                <ol className="space-y-2 text-xs text-zinc-300 list-decimal list-inside">
                  <li>Open the <b>Binance App</b> on your mobile phone or browser.</li>
                  <li>Go to <b>Pay</b> &rarr; tap <b>Send</b>.</li>
                  <li>Select <b>Binance ID (UID)</b> and send to Platform Owner UID:</li>
                </ol>

                <div className="p-3.5 rounded-xl bg-carbon-900 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-500 block uppercase font-mono">Platform Owner Binance UID</span>
                    <span className="text-lg font-bold font-mono text-white tracking-widest">{ownerBinanceUid}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUid}
                    className="px-3 py-1.5 rounded-lg bg-carbon-800 hover:bg-carbon-700 text-xs font-mono text-zinc-200 flex items-center gap-1.5"
                  >
                    {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUid ? 'Copied!' : 'Copy UID'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                  2. Transfer Exact Amount
                </span>
                <p className="text-xs text-zinc-300">
                  Transfer exactly <b>${payablePrice.toFixed(2)} USDT</b> to match automated verification.
                </p>
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                  <div className="flex justify-between font-mono">
                    <span>Base Subscription:</span>
                    <span>${basePrice.toFixed(2)} USD</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between font-mono text-emerald-400 font-bold">
                      <span>Discount ({appliedCoupon.code}):</span>
                      <span>-${appliedCoupon.discountAmountUsd.toFixed(2)} USD</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-emerald-500/20 flex justify-between font-mono font-black text-sm text-white">
                    <span>Net Amount to Send:</span>
                    <span className="text-emerald-400">${payablePrice.toFixed(2)} USDT</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Verify Transaction ID */}
            <form onSubmit={handleVerifyPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Enter 17-digit Binance Pay Transaction ID / Order ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 459917465708191744"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-crimson-500"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">
                  Found immediately inside Binance App &rarr; Pay &rarr; Transaction History &rarr; Order ID
                </span>
              </div>

              {verifyFeedback && (
                <div
                  className={`p-4 rounded-xl text-xs ${
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
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 disabled:opacity-50 text-white font-bold text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                {verifying ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    <span>Verifying with Binance SAPI...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Verify & Activate Store Instant ⚡</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
