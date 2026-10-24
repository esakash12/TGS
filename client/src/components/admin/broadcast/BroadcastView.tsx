import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Megaphone,
  TrendingDown,
  Flame,
  Send,
  History,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Tag,
  Clock,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface BroadcastViewProps {
  products: any[];
  authHeaders: { headers: { Authorization: string } };
  showNotice: (title: string, msg: string, type?: 'success' | 'warning' | 'danger') => void;
  botUsername?: string;
}

export const BroadcastView: React.FC<BroadcastViewProps> = ({
  products,
  authHeaders,
  showNotice,
  botUsername,
}) => {
  const [subTab, setSubTab] = useState<'price_change' | 'custom' | 'history'>('price_change');

  // Custom Notice State
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customBtnText, setCustomBtnText] = useState('');
  const [customBtnUrl, setCustomBtnUrl] = useState('');
  const [customSending, setCustomSending] = useState(false);

  // Price Change State
  const [selectedProdId, setSelectedProdId] = useState(products.length > 0 ? products[0].id : '');
  const [priceChangeType, setPriceChangeType] = useState<'PRICE_DROP' | 'PRICE_UPDATE'>('PRICE_DROP');
  const [wasPrice, setWasPrice] = useState('');
  const [nowPrice, setNowPrice] = useState('');
  const [customNote, setCustomNote] = useState('Just limited time offer — buy now!');
  const [priceSending, setPriceSending] = useState(false);

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Auto-fill selected product price
  useEffect(() => {
    if (selectedProdId) {
      const p = products.find((item) => item.id === selectedProdId);
      if (p) {
        const curPrice = Number(p.retail_price_usd || 0);
        setNowPrice(curPrice.toFixed(2));
        if (!wasPrice || Number(wasPrice) <= curPrice) {
          setWasPrice((curPrice * 1.25).toFixed(2));
        }
      }
    }
  }, [selectedProdId, products]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get('/api/merchant/broadcast/history', authHeaders);
      setHistory(res.data.history || []);
    } catch (err: any) {
      console.error('Failed to load broadcast history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'history') {
      loadHistory();
    }
  }, [subTab]);

  const handleSendCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMessage.trim()) return;
    setCustomSending(true);
    try {
      const res = await axios.post(
        '/api/merchant/broadcast/send',
        {
          title: customTitle.trim() || undefined,
          message: customMessage.trim(),
          buttonText: customBtnText.trim() || undefined,
          buttonUrl: customBtnUrl.trim() || undefined,
        },
        authHeaders
      );
      const result = res.data.result;
      showNotice(
        'Broadcast Completed',
        `Successfully delivered to ${result.successCount} of ${result.totalRecipients} customers!`,
        'success'
      );
      setCustomMessage('');
      setCustomTitle('');
      setCustomBtnText('');
      setCustomBtnUrl('');
    } catch (err: any) {
      showNotice('Broadcast Failed', err.response?.data?.error || err.message, 'danger');
    } finally {
      setCustomSending(false);
    }
  };

  const handleSendPriceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdId) {
      showNotice('Validation Error', 'Please select a product to broadcast', 'warning');
      return;
    }
    setPriceSending(true);
    try {
      const res = await axios.post(
        '/api/merchant/broadcast/price-change',
        {
          productId: selectedProdId,
          type: priceChangeType,
          wasPriceUsd: parseFloat(wasPrice),
          nowPriceUsd: parseFloat(nowPrice),
          customNote: customNote.trim() || undefined,
        },
        authHeaders
      );
      const result = res.data.result;
      showNotice(
        'Price Broadcast Sent',
        `Price update dispatched to ${result.successCount} of ${result.totalRecipients} customers!`,
        'success'
      );
    } catch (err: any) {
      showNotice('Price Broadcast Failed', err.response?.data?.error || err.message, 'danger');
    } finally {
      setPriceSending(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProdId);
  const cleanSelectedName = (selectedProduct?.name || 'Selected Product').replace(/\{pe:\d+\}/gi, '').trim();

  // Price Drop Preview text
  const previewPriceDrop = `📉 <b>Price Drop!</b>\n\n💎 <b>${cleanSelectedName}</b>\n\n💰 Was: $${Number(wasPrice || 0).toFixed(2)} USDT\n✅ Now: $${Number(nowPrice || 0).toFixed(2)} USDT\n\n<i>${customNote || 'Just limited time offer — buy now!'}</i>`;

  // Price Update Preview text
  const previewPriceUpdate = `🔥 <b>Price update</b>\n\n✨ <b>${cleanSelectedName}</b>\n🤑 $${Number(wasPrice || 0).toFixed(2)} 👉 $${Number(nowPrice || 0).toFixed(2)}${customNote ? `\n\n<i>${customNote}</i>` : ''}`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-laser-400" /> Telegram Broadcast & Marketing Hub
          </h3>
          <p className="text-xs text-zinc-400">
            Send instant notifications, price drops, and announcements to all registered bot customers with 1-click deep links!
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex rounded-xl bg-carbon-900 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => setSubTab('price_change')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === 'price_change'
                ? 'bg-laser-600 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" /> Price Drop / Update
          </button>
          <button
            type="button"
            onClick={() => setSubTab('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === 'custom'
                ? 'bg-laser-600 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Send className="w-3.5 h-3.5" /> Custom Notice
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              subTab === 'history'
                ? 'bg-laser-600 text-white shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" /> History
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: PRICE DROP & PRICE UPDATE BROADCAST */}
      {/* ========================================================================= */}
      {subTab === 'price_change' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Side */}
          <div className="lg:col-span-7 glass-card rounded-2xl p-6 border border-white/10 space-y-5">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-laser-400" /> Automated Price Change Campaign
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Choose a product and broadcast a formatted Price Drop alert or Price Update to generate instant sales.
              </p>
            </div>

            <form onSubmit={handleSendPriceChange} className="space-y-4">
              {/* Template Switcher */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Broadcast Style / Template</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPriceChangeType('PRICE_DROP');
                      setCustomNote('Just limited time offer — buy now!');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      priceChangeType === 'PRICE_DROP'
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow'
                        : 'bg-carbon-800 border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-emerald-400">
                      <TrendingDown className="w-4 h-4" /> 📉 Price Drop!
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Shows Was vs Now price with limited-time discount urgency.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPriceChangeType('PRICE_UPDATE');
                      setCustomNote('');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      priceChangeType === 'PRICE_UPDATE'
                        ? 'bg-crimson-500/15 border-crimson-500 text-white shadow'
                        : 'bg-carbon-800 border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs text-crimson-400">
                      <Flame className="w-4 h-4" /> 🔥 Price Update
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Clean & modern arrow update ($1.20 👉 $1.10).
                    </span>
                  </button>
                </div>
              </div>

              {/* Product Selector */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Select Store Product</label>
                <select
                  value={selectedProdId}
                  onChange={(e) => setSelectedProdId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-laser-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name?.replace(/\{pe:\d+\}/gi, '').trim()} (${Number(p.retail_price_usd).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price Comparison Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Previous Price (Was $ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={wasPrice}
                    onChange={(e) => setWasPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
                    placeholder="e.g. 4.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Current Offer Price (Now $ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={nowPrice}
                    onChange={(e) => setNowPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-carbon-800 border border-emerald-500/50 text-emerald-400 font-mono text-xs font-bold focus:outline-none focus:border-emerald-400"
                    placeholder="e.g. 3.50"
                  />
                </div>
              </div>

              {/* Note / Tagline */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Bottom Note / Tagline (Italicized)
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="e.g. Just limited time offer — buy now!"
                  className="w-full px-3.5 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-laser-500"
                />
              </div>

              <button
                type="submit"
                disabled={priceSending}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-laser-600 to-purple-600 hover:from-laser-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-laser-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {priceSending ? 'Broadcasting to All Customers...' : 'Broadcast Price Drop to All Users 🚀'}
              </button>
            </form>
          </div>

          {/* Live Telegram Message Simulation Box */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
              <Eye className="w-4 h-4 text-laser-400" /> Live Telegram Chat Preview
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 min-h-[300px] flex flex-col justify-end">
              {/* Telegram Chat Bubble */}
              <div className="bg-[#182533] p-4 rounded-2xl rounded-bl-sm border border-white/5 space-y-3 max-w-[92%] shadow-xl">
                <div className="text-xs text-white leading-relaxed whitespace-pre-line font-sans">
                  {priceChangeType === 'PRICE_DROP' ? (
                    <>
                      <div className="font-bold text-sm">📉 Price Drop!</div>
                      <div className="font-bold text-white mt-1">💎 {cleanSelectedName}</div>
                      <div className="mt-2 text-zinc-300">
                        💰 Was: ${Number(wasPrice || 0).toFixed(2)} USDT
                        <br />
                        <span className="font-bold text-emerald-400">
                          ✅ Now: ${Number(nowPrice || 0).toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="mt-2 italic text-zinc-400 text-[11px]">
                        {customNote || 'Just limited time offer — buy now!'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-bold text-sm">🔥 Price update</div>
                      <div className="font-bold text-white mt-1">✨ {cleanSelectedName}</div>
                      <div className="mt-2 font-mono text-zinc-200">
                        🤑 ${Number(wasPrice || 0).toFixed(2)} 👉 ${Number(nowPrice || 0).toFixed(2)}
                      </div>
                      {customNote && <div className="mt-2 italic text-zinc-400 text-[11px]">{customNote}</div>}
                    </>
                  )}
                </div>

                {/* Direct Buy Inline Button Simulation */}
                <div className="pt-2">
                  <div className="w-full py-2 rounded-xl bg-[#2b5278] hover:bg-[#346290] text-center text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow">
                    <ShoppingBag className="w-3.5 h-3.5" /> 🛒 Buy in Bot Now
                  </div>
                </div>

                <div className="text-[10px] text-zinc-400 text-right">10:45 PM ✓✓</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: CUSTOM NOTICE BROADCAST */}
      {/* ========================================================================= */}
      {subTab === 'custom' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 glass-card rounded-2xl p-6 border border-white/10 space-y-5">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-laser-400" /> Send Custom Announcement
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Compose custom announcements, maintenance updates, or festive promos. Supports HTML tags (<b>bold</b>, <i>italic</i>, <code>code</code>).
              </p>
            </div>

            <form onSubmit={handleSendCustom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Notice Title / Subject (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 📢 Important Service Update"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-laser-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Message Content (HTML Supported)
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Type your message here... Use <b>bold</b>, <i>italic</i>, or standard emojis!"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs font-sans leading-relaxed focus:outline-none focus:border-laser-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Inline Button Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 🎁 Claim Bonus Offer"
                    value={customBtnText}
                    onChange={(e) => setCustomBtnText(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-laser-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Inline Button Link / URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://t.me/your_support"
                    value={customBtnUrl}
                    onChange={(e) => setCustomBtnUrl(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-laser-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={customSending}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-laser-600 to-crimson-600 hover:from-laser-500 text-white font-bold text-xs shadow-lg shadow-laser-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {customSending ? 'Sending Announcement...' : 'Send Broadcast to All Bot Customers 🚀'}
              </button>
            </form>
          </div>

          {/* Live Preview Box */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
              <Eye className="w-4 h-4 text-laser-400" /> Live Chat Preview
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 min-h-[300px] flex flex-col justify-end">
              <div className="bg-[#182533] p-4 rounded-2xl rounded-bl-sm border border-white/5 space-y-3 max-w-[92%] shadow-xl">
                {customTitle && <div className="font-bold text-sm text-laser-300">{customTitle}</div>}
                <div className="text-xs text-white leading-relaxed whitespace-pre-line font-sans">
                  {customMessage || 'Your message preview will appear here in real-time...'}
                </div>

                {customBtnText && (
                  <div className="pt-2">
                    <div className="w-full py-2 rounded-xl bg-[#2b5278] text-center text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow">
                      <ExternalLink className="w-3.5 h-3.5" /> {customBtnText}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-zinc-400 text-right">Now ✓✓</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: BROADCAST HISTORY */}
      {/* ========================================================================= */}
      {subTab === 'history' && (
        <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-laser-400" /> Campaign & Dispatch History
            </h4>
            <button
              onClick={loadHistory}
              className="p-1.5 rounded-lg bg-carbon-800 text-zinc-400 hover:text-white"
              title="Refresh History"
            >
              <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {history.length === 0 ? (
            <div className="p-10 text-center text-zinc-500 text-xs">
              No broadcast campaigns sent yet. Send your first price drop or notice above!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-carbon-900/60 uppercase font-mono text-[10px] text-zinc-400 border-b border-white/5">
                  <tr>
                    <th className="p-3">Type</th>
                    <th className="p-3">Campaign / Title</th>
                    <th className="p-3">Recipients</th>
                    <th className="p-3">Success</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {history.map((row) => (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.broadcast_type === 'PRICE_DROP'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : row.broadcast_type === 'PRICE_UPDATE'
                              ? 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
                              : 'bg-laser-600/20 text-laser-300 border border-laser-500/30'
                          }`}
                        >
                          {row.broadcast_type}
                        </span>
                      </td>
                      <td className="p-3 font-sans font-semibold text-white max-w-xs truncate">
                        {row.title || row.message.slice(0, 50)}
                      </td>
                      <td className="p-3 text-zinc-400">{row.target_recipients_count}</td>
                      <td className="p-3 text-emerald-400 font-bold">
                        {row.success_count} / {row.target_recipients_count}
                      </td>
                      <td className="p-3 text-zinc-500 text-[11px]">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
