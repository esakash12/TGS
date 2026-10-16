import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot, ArrowRight, LayoutDashboard, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-carbon-900/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-crimson-600 to-laser-600 flex items-center justify-center shadow-lg shadow-crimson-500/20 group-hover:scale-105 transition-all">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              Bot <span className="text-zinc-400 font-normal text-xs">by mogent</span>
            </span>
            <span className="text-[10px] text-crimson-400 font-mono tracking-widest uppercase -mt-0.5">
              Commerce Cloud
            </span>
          </div>
        </Link>

        {/* Center Links (Landing) */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#simulator" className="hover:text-white transition-colors">Bot Simulator</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#calculator" className="hover:text-white transition-colors">ROI Calculator</a>
        </div>

        {/* Right CTA / Auth Status */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 border border-white/10 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-crimson-400" />
                <span>{tenant?.name || 'Dashboard'}</span>
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-2 rounded-xl hover:bg-carbon-800 text-zinc-400 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                Merchant Login
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 hover:to-crimson-400 text-white text-xs font-bold shadow-md shadow-crimson-500/20 active:scale-95 transition-all"
              >
                <span>Get Started</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
