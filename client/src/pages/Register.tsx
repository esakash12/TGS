import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Bot, Sparkles, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';

export const Register: React.FC = () => {
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [password, setPassword] = useState('');
  const [botToken, setBotToken] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSlugGen = (name: string) => {
    setStoreName(name);
    if (!slug) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 20));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await axios.post('/api/auth/register', {
        storeName,
        slug,
        ownerEmail,
        password,
        botToken: botToken || undefined,
      });

      login(res.data.token, res.data.user, res.data.tenant);
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-carbon-900 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-crimson-600/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-laser-600/15 rounded-full blur-[140px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-crimson-600 to-laser-600 flex items-center justify-center shadow-lg shadow-crimson-500/25">
              <Bot className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Create Your Merchant Store
          </h2>
          <p className="text-xs text-zinc-400">
            Start selling digital products on Telegram in less than 60 seconds
          </p>
        </div>

        {/* Clean Catalog Guarantee Notice */}
        <div className="p-3.5 rounded-2xl bg-carbon-800/80 border border-white/10 flex items-start gap-3 text-xs text-zinc-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span>
            <b>Clean Slate Guarantee:</b> Your catalog starts completely fresh with 0 fake products. You have 100% control over what you sell.
          </span>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-6 sm:p-8 border border-white/10 space-y-4 shadow-2xl">
          {error && (
            <div className="p-3 rounded-xl bg-crimson-500/10 border border-crimson-500/30 text-crimson-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Store / Brand Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Nexus Digital Store"
              value={storeName}
              onChange={(e) => handleSlugGen(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Store Identifier / Slug</label>
            <div className="flex items-center bg-carbon-800 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-400">
              <span>bot.mogent.tech/</span>
              <input
                type="text"
                required
                placeholder="nexus-store"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                className="bg-transparent flex-1 text-white focus:outline-none ml-1 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Owner Email Address</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">Telegram Bot Token (Optional)</label>
              <span className="text-[10px] text-zinc-500">From @BotFather</span>
            </div>
            <input
              type="text"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-laser-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              You can also configure or update this anytime inside your store dashboard.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 hover:to-crimson-400 text-white font-bold text-xs shadow-lg shadow-crimson-500/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Deploying Store...</span>
            ) : (
              <>
                <span>Create Store & Enter Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-zinc-400">
          Already have a merchant store?{' '}
          <Link to="/login" className="text-crimson-400 hover:text-crimson-300 font-semibold">
            Merchant Login
          </Link>
        </div>
      </div>
    </div>
  );
};
