import React, { useState } from 'react';
import { Wifi, Battery, Signal, Send, ShoppingBag, Wallet, PlusCircle, Package, CheckCircle2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
  buttons?: { label: string; action: string }[];
  isCode?: boolean;
}

export const PhoneSimulator: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: '👋 <b>Welcome to Demo Shop!</b>\n\nBuy premium digital subscriptions and keys with instant auto-delivery.\n\n💵 Balance: <b>$12.50 USD</b>',
      time: '12:00',
    },
  ]);
  const [inputText, setInputText] = useState('');

  const getTime = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleAction = (action: string) => {
    const time = getTime();

    if (action === 'products') {
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), sender: 'user', text: '🛍️ Products', time },
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: '🛍️ <b>Catalog:</b>\n1. YouTube Premium 3M — <b>$1.50</b>\n2. Netflix 4K UHD 1M — <b>$2.50</b>\n3. NordVPN 1 Year — <b>$3.00</b>',
          time,
          buttons: [
            { label: '⚡ Buy YouTube ($1.50)', action: 'buy_yt' },
            { label: '⚡ Buy Netflix ($2.50)', action: 'buy_nf' },
          ],
        },
      ]);
    } else if (action === 'buy_yt') {
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), sender: 'user', text: 'Buy YouTube Premium ($1.50)', time },
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: '🎉 <b>Order #ORD-77821 Completed!</b>\nPaid: <b>$1.50 USD</b>\n\n🔑 <b>Delivery Code:</b>\n<code>https://youtube.com/redeem?claim=MOGENT-PREM-9988</code>\n\n<i>Auto-delivered in 0.4s!</i>',
          time,
          isCode: true,
        },
      ]);
    } else if (action === 'wallet') {
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), sender: 'user', text: '💰 My Wallet', time },
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: '💰 <b>My Wallet Profile</b>\n\n💵 Current Balance: <b>$11.00 USD</b>\n🛒 Total Spent: <b>$48.50 USD</b>\n📦 Completed Orders: <b>14</b>',
          time,
        },
      ]);
    } else if (action === 'add_funds') {
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), sender: 'user', text: '➕ Add Funds', time },
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: '➕ <b>Deposit Channels</b>\nRate: $1 USD = 125 BDT (or 1:1 USDT)\n\nSelect payment method:',
          time,
          buttons: [
            { label: '📱 bKash / Nagad', action: 'dep_bkash' },
            { label: '🟡 Binance Pay USDT', action: 'dep_binance' },
          ],
        },
      ]);
    } else if (action === 'orders') {
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), sender: 'user', text: '📦 My Orders', time },
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: '📦 <b>Recent Orders:</b>\n\n1. YouTube Premium ($1.50) ✅\n2. Spotify Family ($1.80) ✅\n3. NordVPN 1M ($2.10) ✅',
          time,
        },
      ]);
    }
  };

  return (
    <div className="relative mx-auto w-[310px] sm:w-[340px] h-[640px] bg-carbon-950 rounded-[48px] p-3 shadow-2xl border-4 border-zinc-800 ring-1 ring-crimson-500/30 flex flex-col justify-between overflow-hidden">
      {/* Top Dynamic Island & Status Bar */}
      <div className="relative z-20 flex justify-between items-center px-6 pt-2 pb-1 text-xs text-zinc-400 select-none">
        <span className="font-semibold text-white">9:41</span>
        <div className="w-20 h-5 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-2 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-zinc-800 rounded-full mr-2"></div>
          <div className="w-2 h-2 bg-crimson-500/80 rounded-full animate-pulse"></div>
        </div>
        <div className="flex items-center space-x-1.5">
          <Signal className="w-3.5 h-3.5 text-zinc-300" />
          <Wifi className="w-3.5 h-3.5 text-zinc-300" />
          <Battery className="w-4 h-4 text-zinc-300" />
        </div>
      </div>

      {/* Bot Chat Header */}
      <div className="relative z-10 bg-carbon-800/90 backdrop-blur-md px-4 py-2.5 border-b border-white/5 flex items-center justify-between mt-1 rounded-2xl mx-1">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-crimson-500 to-laser-500 flex items-center justify-center font-bold text-white text-xs shadow-md">
            M
          </div>
          <div>
            <div className="text-xs font-semibold text-white flex items-center gap-1">
              StoreBot <CheckCircle2 className="w-3 h-3 text-laser-400" />
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> bot
            </div>
          </div>
        </div>
        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-zinc-300">Live Simulator</span>
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2.5 text-xs text-zinc-200">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                m.sender === 'user'
                  ? 'bg-crimson-600 text-white rounded-br-none shadow-md'
                  : 'bg-carbon-800/95 text-zinc-100 border border-white/10 rounded-bl-none shadow-sm'
              }`}
            >
              <div dangerouslySetInnerHTML={{ __html: m.text }} />
              <div className="text-[9px] text-right mt-1 opacity-60">{m.time}</div>
            </div>

            {/* In-chat dynamic action buttons */}
            {m.buttons && (
              <div className="mt-1.5 space-y-1 w-[85%]">
                {m.buttons.map((b, i) => (
                  <button
                    key={i}
                    onClick={() => handleAction(b.action)}
                    className="w-full text-center bg-carbon-700/80 hover:bg-crimson-500/20 hover:border-crimson-500/50 border border-white/10 rounded-lg py-1.5 text-[11px] font-medium text-laser-300 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Interactive Telegram Bottom Menu Keyboard */}
      <div className="p-2 bg-carbon-900 border-t border-white/10 rounded-b-[40px] space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleAction('products')}
            className="flex items-center justify-center gap-1.5 bg-carbon-800 hover:bg-carbon-700 active:scale-95 border border-white/10 rounded-xl py-2 text-[11px] font-semibold text-white transition-all shadow-sm hover:border-crimson-500/40"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-crimson-400" /> 🛍️ Products
          </button>
          <button
            onClick={() => handleAction('wallet')}
            className="flex items-center justify-center gap-1.5 bg-carbon-800 hover:bg-carbon-700 active:scale-95 border border-white/10 rounded-xl py-2 text-[11px] font-semibold text-white transition-all shadow-sm hover:border-laser-400/40"
          >
            <Wallet className="w-3.5 h-3.5 text-laser-400" /> 💰 My Wallet
          </button>
          <button
            onClick={() => handleAction('add_funds')}
            className="flex items-center justify-center gap-1.5 bg-carbon-800 hover:bg-carbon-700 active:scale-95 border border-white/10 rounded-xl py-2 text-[11px] font-semibold text-white transition-all shadow-sm hover:border-emerald-400/40"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" /> ➕ Add Funds
          </button>
          <button
            onClick={() => handleAction('orders')}
            className="flex items-center justify-center gap-1.5 bg-carbon-800 hover:bg-carbon-700 active:scale-95 border border-white/10 rounded-xl py-2 text-[11px] font-semibold text-white transition-all shadow-sm hover:border-amber-400/40"
          >
            <Package className="w-3.5 h-3.5 text-amber-400" /> 📦 Orders
          </button>
        </div>

        {/* Input Bar */}
        <div className="flex items-center bg-carbon-800/90 rounded-full px-3 py-1.5 border border-white/10">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="bg-transparent flex-1 text-xs text-white focus:outline-none placeholder:text-zinc-500"
          />
          <button className="text-crimson-400 hover:text-crimson-300">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
