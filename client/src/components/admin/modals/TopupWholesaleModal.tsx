import React, { useState } from 'react';
import axios from 'axios';
import { Zap, X } from 'lucide-react';

interface TopupWholesaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  topupInfo: {
    walletUsd?: number;
    walletsByProvider?: Record<string, number>;
    platformOwnerBinanceUid?: string;
  } | null;
  authHeaders: { headers: { Authorization: string } };
  showNotice: (title: string, msg: string, type?: 'success' | 'warning' | 'danger') => void;
  onSuccess: () => void;
}

export const TopupWholesaleModal: React.FC<TopupWholesaleModalProps> = ({
  isOpen,
  onClose,
  topupInfo,
  authHeaders,
  showNotice,
  onSuccess,
}) => {
  const [topupTrxId, setTopupTrxId] = useState('');
  const [topupAmountUsd, setTopupAmountUsd] = useState('');
  const [topupProvider, setTopupProvider] = useState('digitalcore');
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMsg, setTopupMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleVerifyTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopupLoading(true);
    setTopupMsg(null);
    try {
      const res = await axios.post(
        '/api/merchant/wholesale-wallet/verify',
        {
          trxId: topupTrxId.trim(),
          amountUsd: parseFloat(topupAmountUsd),
          provider: topupProvider,
        },
        authHeaders
      );
      setTopupMsg({ text: res.data.message || 'Deposit successfully verified!', type: 'success' });
      setTopupTrxId('');
      setTopupAmountUsd('');
      onSuccess();
      showNotice(
        'Top-Up Successful',
        `Credited $${parseFloat(topupAmountUsd).toFixed(2)} to ${topupProvider.toUpperCase()} wholesale wallet!`,
        'success'
      );
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Verification failed. Please check TxID & Amount.';
      setTopupMsg({ text: errMsg, type: 'error' });
      showNotice('Verification Failed', errMsg, 'danger');
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="glass-card rounded-3xl p-5 sm:p-6 max-w-lg w-full max-h-[92vh] overflow-y-auto space-y-4 border border-white/10 relative my-auto shadow-2xl">
        {/* Header with securely docked close button */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2 text-crimson-400 font-bold text-base">
            <Zap className="w-5 h-5" /> Top Up Wholesale Wallet
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          Transfer USDT to the platform owner via Binance Pay. Enter the 17-digit Transaction ID for automated instant verification.
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

        {/* Per-Provider Balance Badges */}
        <div className="p-2.5 rounded-2xl bg-carbon-950 border border-white/5 space-y-1.5">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Your API Provider Balances:</span>
          <div className="grid grid-cols-5 gap-1.5 text-center">
            <div className="p-1.5 rounded-xl bg-carbon-900 border border-crimson-500/20">
              <span className="text-[9px] text-crimson-400 block font-bold leading-none">Mogent V1</span>
              <span className="font-mono text-[11px] font-extrabold text-white mt-1 block">
                ${Number(topupInfo?.walletsByProvider?.digitalcore || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-1.5 rounded-xl bg-carbon-900 border border-emerald-500/20">
              <span className="text-[9px] text-emerald-400 block font-bold leading-none">Mogent V2</span>
              <span className="font-mono text-[11px] font-extrabold text-white mt-1 block">
                ${Number(topupInfo?.walletsByProvider?.vexorix || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-1.5 rounded-xl bg-carbon-900 border border-blue-500/20">
              <span className="text-[9px] text-blue-400 block font-bold leading-none">Mogent V3</span>
              <span className="font-mono text-[11px] font-extrabold text-white mt-1 block">
                ${Number(topupInfo?.walletsByProvider?.canboso || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-1.5 rounded-xl bg-carbon-900 border border-purple-500/20">
              <span className="text-[9px] text-purple-400 block font-bold leading-none">Mogent V4</span>
              <span className="font-mono text-[11px] font-extrabold text-white mt-1 block">
                ${Number(topupInfo?.walletsByProvider?.prodseller || 0).toFixed(2)}
              </span>
            </div>
            <div className="p-1.5 rounded-xl bg-carbon-900 border border-amber-500/20">
              <span className="text-[9px] text-amber-400 block font-bold leading-none">Mogent V5</span>
              <span className="font-mono text-[11px] font-extrabold text-white mt-1 block">
                ${Number(topupInfo?.walletsByProvider?.ssondigital || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Platform Owner Binance UID Instruction */}
        <div className="bg-carbon-900/90 p-3.5 rounded-2xl border border-white/10 space-y-2">
          <span className="text-[11px] text-zinc-400 block font-semibold">1. Send USDT to Platform Owner UID:</span>
          <div className="flex items-center justify-between bg-carbon-800 p-2.5 rounded-xl font-mono text-xs text-white">
            <span className="font-bold text-laser-400 select-all">{topupInfo?.platformOwnerBinanceUid || 'N/A'}</span>
            <span className="text-[10px] text-zinc-400">Binance Pay</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            Open Binance App &rarr; Pay &rarr; Send &rarr; Enter UID above and transfer USDT.
          </p>
        </div>

        {/* Topup Form */}
        <form onSubmit={handleVerifyTopup} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">Select API Provider to Credit</label>
            <select
              value={topupProvider}
              onChange={(e) => setTopupProvider(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-laser-500"
            >
              <option value="digitalcore">📦 Mogent V1 Wholesale</option>
              <option value="vexorix">🚀 Mogent V2 Wholesale</option>
              <option value="canboso">🌐 Mogent V3 Wholesale</option>
              <option value="prodseller">🔥 Mogent V4 Wholesale</option>
              <option value="ssondigital">⚡ Mogent V5 Wholesale</option>
            </select>
          </div>

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
  );
};
