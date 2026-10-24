import React, { useState } from 'react';
import axios from 'axios';
import { Send, CheckCircle2, AlertCircle, Shield, Radio, RefreshCw, MessageSquare } from 'lucide-react';

interface LogChannelSettingsCardProps {
  logChannelId: string;
  setLogChannelId: (val: string) => void;
  logPurchasesEnabled: boolean;
  setLogPurchasesEnabled: (val: boolean) => void;
  logDepositsEnabled: boolean;
  setLogDepositsEnabled: (val: boolean) => void;
  authHeaders: { headers: { Authorization: string } };
  showNotice: (title: string, msg: string, type?: 'success' | 'warning' | 'danger') => void;
}

export const LogChannelSettingsCard: React.FC<LogChannelSettingsCardProps> = ({
  logChannelId,
  setLogChannelId,
  logPurchasesEnabled,
  setLogPurchasesEnabled,
  logDepositsEnabled,
  setLogDepositsEnabled,
  authHeaders,
  showNotice,
}) => {
  const [testLoading, setTestLoading] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!logChannelId.trim()) {
      showNotice('Channel Required', 'Please enter a Channel Username (e.g. @my_logs) or Group ID first', 'warning');
      return;
    }
    setTestLoading(true);
    setTestFeedback(null);
    try {
      const res = await axios.post(
        '/api/merchant/broadcast/test-log-channel',
        { channelId: logChannelId.trim() },
        authHeaders
      );
      if (res.data.success) {
        setTestFeedback({ type: 'success', message: res.data.message });
        showNotice('Connection Verified', res.data.message, 'success');
      } else {
        setTestFeedback({ type: 'error', message: res.data.message });
        showNotice('Connection Failed', res.data.message, 'danger');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to send test message';
      setTestFeedback({ type: 'error', message: msg });
      showNotice('Connection Error', msg, 'danger');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
              Real-Time Log Channel / Group (Optional)
            </h4>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Stream live order purchases (💥 New Purchase!) and deposits to your private or public Telegram channel/group.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testLoading || !logChannelId.trim()}
          className="px-3.5 py-1.5 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300 hover:text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-40 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testLoading ? 'animate-spin text-laser-400' : ''}`} />
          <span>{testLoading ? 'Testing...' : '⚡ Send Test Message'}</span>
        </button>
      </div>

      {testFeedback && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            testFeedback.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-crimson-500/20 text-crimson-400 border border-crimson-500/30'
          }`}
        >
          {testFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{testFeedback.message}</span>
        </div>
      )}

      {/* Input Channel / Group ID */}
      <div>
        <label className="block text-xs font-semibold text-zinc-300 mb-1">
          Telegram Channel Username or Chat ID
        </label>
        <div className="relative">
          <input
            type="text"
            value={logChannelId}
            onChange={(e) => setLogChannelId(e.target.value)}
            placeholder="e.g. @vexorix_logs or -1001234567890"
            className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
          💡 <strong>How to set up:</strong> Add your bot to the Telegram channel or group, and give it <strong>Administrator</strong> privileges with <strong>"Post Messages"</strong> enabled.
        </p>
      </div>

      {/* Event Notification Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <label
          onClick={() => setLogPurchasesEnabled(!logPurchasesEnabled)}
          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
            logPurchasesEnabled
              ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
              : 'bg-carbon-900 border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          <div className="space-y-0.5">
            <span className="font-bold text-xs block text-white">💥 Log Order Purchases</span>
            <span className="text-[10px] text-zinc-400 block">Announce customer orders with masked IDs</span>
          </div>
          <input
            type="checkbox"
            checked={logPurchasesEnabled}
            onChange={() => {}}
            className="w-4 h-4 rounded text-emerald-500 focus:ring-0 accent-emerald-500"
          />
        </label>

        <label
          onClick={() => setLogDepositsEnabled(!logDepositsEnabled)}
          className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
            logDepositsEnabled
              ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
              : 'bg-carbon-900 border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          <div className="space-y-0.5">
            <span className="font-bold text-xs block text-white">💰 Log Customer Deposits</span>
            <span className="text-[10px] text-zinc-400 block">Announce deposits with masked TxID codes</span>
          </div>
          <input
            type="checkbox"
            checked={logDepositsEnabled}
            onChange={() => {}}
            className="w-4 h-4 rounded text-emerald-500 focus:ring-0 accent-emerald-500"
          />
        </label>
      </div>

      <div className="p-3 rounded-xl bg-carbon-950 border border-white/5 text-[11px] text-zinc-400 flex items-center gap-2">
        <Shield className="w-4 h-4 text-laser-400 shrink-0" />
        <span>
          <strong>Privacy Guard:</strong> Customer IDs are automatically masked (e.g. <code>740***03</code>) and TxID codes are protected (e.g. <code>VEX0••••5VZ</code>) so no personal data is leaked.
        </span>
      </div>
    </div>
  );
};
