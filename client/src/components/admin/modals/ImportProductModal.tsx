import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X } from 'lucide-react';

interface ImportProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any | null;
  groups: any[];
  authHeaders: { headers: { Authorization: string } };
  overview: any;
  showNotice: (title: string, msg: string, type?: 'success' | 'warning' | 'danger') => void;
  onSuccess: () => void;
  onCategoryCreated?: () => void;
}

export const ImportProductModal: React.FC<ImportProductModalProps> = ({
  isOpen,
  onClose,
  item,
  groups,
  authHeaders,
  overview,
  showNotice,
  onSuccess,
  onCategoryCreated,
}) => {
  const [groupId, setGroupId] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (item) {
      const base = item.cost_with_platform_fee_usd || item.wholesale_price_usd || 0;
      setRetailPrice((base + 0.50).toFixed(2));
      setGroupId(groups && groups.length > 0 ? groups[0].id : '');
      setShowNewCatInput(false);
      setNewCategoryName('');
    }
  }, [item, groups]);

  if (!isOpen || !item) return null;

  const cleanName = (item.name || '').replace(/\{pe:\d+\}/gi, '').trim();
  const cleanDesc = (item.description || '').replace(/\{pe:\d+\}/gi, '').trim();
  const baseCost = item.cost_with_platform_fee_usd || item.wholesale_price_usd || 0;

  const handleConfirmImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let finalGroupId = groupId || null;

      if (showNewCatInput && newCategoryName.trim()) {
        const catRes = await axios.post(
          '/api/merchant/groups',
          { name: newCategoryName.trim(), icon: '📁', sortOrder: 0 },
          authHeaders
        );
        finalGroupId = catRes.data?.id || null;
        if (onCategoryCreated) onCategoryCreated();
      }

      await axios.post(
        '/api/merchant/wholesale/import',
        {
          wholesaleProductId: item.id,
          name: cleanName,
          category: (item.category || '').replace(/\{pe:\d+\}/gi, '').trim(),
          wholesaleCostUsd: baseCost,
          retailPriceUsd: parseFloat(retailPrice),
          provider: item.provider,
          groupId: finalGroupId,
          description: cleanDesc,
          stock: item.stock ?? 0,
        },
        authHeaders
      );

      onSuccess();
      showNotice('Wholesale Import', 'Product imported successfully to your store catalog!', 'success');
      onClose();
    } catch (err: any) {
      showNotice('Import Failed', err.response?.data?.error || 'Failed to import product', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const parsedRetail = parseFloat(retailPrice) || 0;
  const profitUsd = parsedRetail > 0 ? (parsedRetail - baseCost).toFixed(2) : null;
  const bdtRate = overview?.usdToBdtRate || 125;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="glass-card rounded-3xl p-5 sm:p-6 max-w-md w-full max-h-[92vh] overflow-y-auto space-y-4 border border-white/10 relative my-auto shadow-2xl">
        {/* Header with securely docked close button */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2 text-crimson-400 font-bold text-base">
            <Plus className="w-5 h-5" /> Import to Store
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Details Preview */}
        <div className="bg-carbon-800/80 p-4 rounded-2xl border border-white/5 space-y-2">
          <h4 className="font-bold text-sm text-white">{cleanName}</h4>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Wholesale Base Cost:</span>
            <span className="font-mono font-bold text-white">
              ${baseCost.toFixed(2)} USD
            </span>
          </div>
          {cleanDesc && (
            <div className="mt-2 p-2.5 rounded-xl bg-carbon-900 border border-white/5 text-[11px] text-zinc-300 max-h-28 overflow-y-auto whitespace-pre-line leading-relaxed">
              <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Product Description / Instructions:</span>
              {cleanDesc}
            </div>
          )}
        </div>

        {/* Import Form */}
        <form onSubmit={handleConfirmImport} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-300">
                Assign to Category / Folder
              </label>
              <button
                type="button"
                onClick={() => setShowNewCatInput(!showNewCatInput)}
                className="text-[11px] text-laser-400 hover:underline flex items-center gap-1 font-semibold"
              >
                {showNewCatInput ? 'Select Existing' : '+ New Category'}
              </button>
            </div>

            {showNewCatInput ? (
              <div className="space-y-1">
                <input
                  type="text"
                  required
                  placeholder="e.g. 🎬 OTT & Streaming, 🛡️ VPNs..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-laser-500/50 text-white text-xs focus:outline-none focus:border-laser-400"
                />
                <span className="text-[10px] text-laser-400 block">
                  This folder will be automatically created and assigned to this product!
                </span>
              </div>
            ) : (
              <div>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500"
                >
                  <option value="">📁 General (No Category Folder)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.icon || '📁'} {g.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-zinc-500">
                  Customers will find this product inside this folder in Telegram.
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Your Retail Selling Price ($ USD)
            </label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="e.g. 5.99"
              value={retailPrice}
              onChange={(e) => setRetailPrice(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-crimson-500"
            />
            {parsedRetail > 0 && (
              <div className="flex justify-between items-center text-[11px] font-mono text-zinc-400 mt-1">
                <span>
                  Estimated Profit:{' '}
                  <strong className={Number(profitUsd) >= 0 ? 'text-emerald-400' : 'text-crimson-400'}>
                    {Number(profitUsd) >= 0 ? `+$${profitUsd}` : `-$${Math.abs(Number(profitUsd)).toFixed(2)}`} USD
                  </strong>
                </span>
                <span>
                  ~ ৳ {(parsedRetail * bdtRate).toFixed(0)} BDT
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-crimson-600 to-crimson-500 hover:from-crimson-500 text-white font-bold text-xs shadow-md active:scale-98 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {loading ? 'Importing...' : 'Confirm & Add to Bot 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
};
