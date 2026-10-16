import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Navbar } from '../components/Navbar';
import { PhoneSimulator } from '../components/PhoneSimulator';
import { RoiCalculator } from '../components/RoiCalculator';
import {
  Bot,
  Zap,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Layers,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Server,
  Key,
} from 'lucide-react';
import { PRICING_TIERS } from '../../../shared/constants';

export const Landing: React.FC = () => {
  const [plans, setPlans] = useState<any[]>(PRICING_TIERS);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    axios
      .get('/api/public/plans')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setPlans(res.data);
        }
      })
      .catch((err) => console.warn('Using default pricing tiers:', err.message));
  }, []);
  return (
    <div className="min-h-screen bg-carbon-900 text-zinc-100 relative overflow-hidden">
      <Navbar />

      {/* Ambient Neon Background Glows */}
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-crimson-600/15 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-slow"></div>
      <div className="absolute top-40 right-10 w-[600px] h-[600px] bg-laser-600/15 rounded-full blur-[160px] pointer-events-none -z-10"></div>

      {/* ==========================================
          HERO SECTION
         ========================================== */}
      <section className="pt-32 pb-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Hero Copy */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 text-xs font-bold tracking-wide uppercase shadow-inner">
              <Sparkles className="w-4 h-4 text-crimson-400" />
              <span>Autonomous Telegram Commerce Cloud</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
              আপনার টেলিগ্রাম শপ চালান <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-crimson-400 via-rose-300 to-laser-400">
                ১০০% সম্পূর্ণ অটোমেশনে
              </span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
              বিকাশ, নগদ এবং বাইনান্স পে ইনস্ট্যান্ট অটো-ডিপোজিট। প্রিমিয়াম সাবস্ক্রিপশন, ভিপিএন এবং সিরিয়াল কি সেকেন্ডে গ্রাহকের ইনবক্সে অটো-ডেলিভারি। কোনো সার্ভার বা কোডিং জানার প্রয়োজন নেই।
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                to="/register"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 hover:to-crimson-400 text-white font-extrabold text-sm shadow-xl shadow-crimson-500/30 hover:shadow-crimson-500/50 transition-all flex items-center justify-center gap-2.5 active:scale-95"
              >
                <span>ফ্রি ট্রায়াল শুরু করুন</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#simulator"
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-carbon-800 hover:bg-carbon-700 border border-white/10 text-zinc-300 hover:text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <span>বট সিমুলেটর টেস্ট করুন</span>
              </a>
            </div>

            {/* Quick Metrics Bar */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-white/10 max-w-lg mx-auto lg:mx-0">
              <div>
                <span className="block text-2xl font-black text-white font-mono">0.4s</span>
                <span className="text-xs text-zinc-400">ডেলিভারি স্পিড</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-crimson-400 font-mono">100%</span>
                <span className="text-xs text-zinc-400">অটো-ডিপোজিট</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-laser-400 font-mono">$0</span>
                <span className="text-xs text-zinc-400">সার্ভার খরচ</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Phone Simulator */}
          <div id="simulator" className="lg:col-span-5 flex justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-crimson-500/20 to-laser-500/20 blur-3xl -z-10 rounded-full scale-90"></div>
            <PhoneSimulator />
          </div>
        </div>
      </section>

      {/* ==========================================
          FEATURES SECTION
         ========================================== */}
      <section id="features" className="py-24 px-4 sm:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-crimson-400">
            Engineered For Scale
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            সবকিছু সাজানো আপনার বিজনেসের শতভাগ প্রফিটের জন্য
          </h2>
          <p className="text-sm text-zinc-400">
            ম্যানুয়াল চ্যাট এবং পেমেন্ট ভেরিফিকেশনের ক্লান্তি শেষ। আপনার নিজের টেলিগ্রাম বট নিজেই কাস্টমারের অর্ডার নেবে এবং প্রফিট আপনার ওয়ালেটে এনে দেবে।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-crimson-500/10 border border-crimson-500/20 flex items-center justify-center text-crimson-400">
              <Bot className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">হোয়াইট-লেবেল টেলিগ্রাম বট</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              আপনার নিজস্ব @BotFather টোকেন দিয়ে চালু করুন। কাস্টমার দেখবে আপনার ব্র্যান্ডের নাম, লোগো এবং পার্সোনাল পেমেন্ট নাম্বার।
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-laser-500/10 border border-laser-500/20 flex items-center justify-center text-laser-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">বিকাশ ও নগদ BDT অটো-কনভার্ট</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              কাস্টমার বাংলায় বিকাশ/নগদে টাকা পাঠাবে, আর আপনার সেট করা ডলার রেট অনুযায়ী কাস্টমারের ওয়ালেটে অটোমেটিক USD জমা হবে।
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">ইনস্ট্যান্ট Binance Pay SAPI</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              গ্রাহক আপনার নিজস্ব Binance UID-তে USDT পে করে TxID দিলেই সিস্টেম বাইনান্স এপিআই দিয়ে সেকেন্ডে ভেরিফাই করে ব্যালেন্স যোগ করে দেবে।
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">সেন্ট্রাল হোলসেল প্রক্সি</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              DigitalCore ও Canboso-এর মতো আন্তর্জাতিক পাইকারি সাপ্লায়ারদের হাজারো প্রোডাক্ট ১-ক্লিকে নিজের স্টোরে যুক্ত করুন এবং নিজের প্রফিট মার্জিন সেট করুন।
            </p>
          </div>

          {/* Card 5 */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">অটোমিক কাস্টম ইনভেন্টরি</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              আপনার নিজের অ্যাকাউন্ট বা লাইসেন্স কি লাইন বাই লাইন ইনপুট দিন। কাস্টমার অর্ডার করা মাত্র মোনোস্পেস বক্সে তাৎক্ষণিক কোড ডেলিভারি হবে।
            </p>
          </div>

          {/* Card 6 */}
          <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">আল্ট্রা-লাইট মেমোরি ইঞ্জিন</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              একটিমাত্র হালকা $7 VPS-এ ৫০+ মার্চেন্টের বট ও শপ একইসাথে নিশ্চিন্তে চলবে (&lt;300MB RAM)। ১০০% আপটাইম নিশ্চয়তা।
            </p>
          </div>
        </div>
      </section>

      {/* ==========================================
          ROI CALCULATOR SECTION
         ========================================== */}
      <section id="calculator" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <RoiCalculator />
      </section>

      {/* ==========================================
          PRICING TIERS
         ========================================== */}
      <section id="pricing" className="py-24 px-4 sm:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-laser-400">
            Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            সহজ ও সাশ্রয়ী সাবস্ক্রিপশন প্ল্যান
          </h2>
          <p className="text-sm text-zinc-400">
            কোনো লুকায়িত ফি নেই। আপনার বিজনেসের আকার অনুযায়ী সেরা প্ল্যানটি বেছে নিন।
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-carbon-800 border border-white/10 mt-4">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-crimson-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              মাসিক (Monthly)
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-crimson-600 to-laser-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>বাৎসরিক (Yearly)</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase">
                Save 20% 🎉
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((tier) => {
            const isPopular = Boolean(tier.is_popular || tier.popular);
            const priceUsd = billingCycle === 'yearly'
              ? Number(tier.price_yearly_usd || (Number(tier.price_monthly_usd || tier.price_usd || 10) * 10))
              : Number(tier.price_monthly_usd || tier.price_usd || 10);
            const priceBdt = tier.price_bdt && billingCycle === 'monthly'
              ? tier.price_bdt
              : Math.round(priceUsd * 125);
            const features = Array.isArray(tier.features_json)
              ? tier.features_json
              : Array.isArray(tier.features)
              ? tier.features
              : [];

            return (
              <div
                key={tier.id}
                className={`rounded-3xl p-8 transition-all relative flex flex-col justify-between ${
                  isPopular
                    ? 'bg-gradient-to-b from-carbon-800 to-carbon-850 border-2 border-crimson-500 shadow-2xl shadow-crimson-500/15 scale-105 z-10'
                    : 'glass-card border border-white/10'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-crimson-500 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                    <p className="text-xs text-zinc-400 mt-1">{tier.description || 'Complete cloud telegram store'}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-white font-mono">৳{priceBdt.toLocaleString()}</span>
                      <span className="text-xs text-zinc-400">/ {billingCycle === 'yearly' ? 'বছর' : 'মাস'}</span>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono">
                      ~ ${priceUsd} USD / {billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>

                  <div className="border-t border-white/10 pt-6 space-y-3">
                    {features.map((f: string, i: number) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs text-zinc-300">
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-8">
                  <Link
                    to={`/register?plan=${tier.id}&cycle=${billingCycle}`}
                    className={`block w-full py-3.5 rounded-xl text-center text-xs font-bold transition-all ${
                      isPopular
                        ? 'bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 hover:to-crimson-400 text-white shadow-lg shadow-crimson-500/30'
                        : 'bg-carbon-700 hover:bg-carbon-600 text-white border border-white/10'
                    }`}
                  >
                    Get Started with {tier.name}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==========================================
          FOOTER
         ========================================== */}
      <footer className="border-t border-white/10 py-12 px-4 sm:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-crimson-500" />
          <span className="text-zinc-300 font-semibold">Bot by mogent</span>
          <span>© 2026. All rights reserved.</span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-zinc-300">Privacy Policy</a>
          <a href="#" className="hover:text-zinc-300">Terms of Service</a>
          <a href="#" className="hover:text-zinc-300">Documentation</a>
          <Link to="/login" className="hover:text-zinc-300">Merchant Portal</Link>
        </div>
      </footer>
    </div>
  );
};
