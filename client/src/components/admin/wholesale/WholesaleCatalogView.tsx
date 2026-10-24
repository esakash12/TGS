import React from 'react';
import {
  Zap,
  Sliders,
  RefreshCw,
  Search,
  FolderOpen,
  Folder,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface WholesaleCatalogViewProps {
  wholesaleCatalog: any[];
  wholesaleCategories: string[];
  wholesaleSearch: string;
  setWholesaleSearch: (val: string) => void;
  wholesaleProviderFilter: 'digitalcore' | 'vexorix' | 'canboso' | 'prodseller' | 'ssondigital' | 'blinkey' | 'all';
  setWholesaleProviderFilter: (val: any) => void;
  wholesaleCategoryFilter: string;
  setWholesaleCategoryFilter: (val: string) => void;
  onOpenMarginModal: () => void;
  onBulkImport: () => void;
  onRefreshCatalog: () => void;
  onOpenImportModal: (item: any) => void;
}

export const WholesaleCatalogView: React.FC<WholesaleCatalogViewProps> = ({
  wholesaleCatalog,
  wholesaleCategories,
  wholesaleSearch,
  setWholesaleSearch,
  wholesaleProviderFilter,
  setWholesaleProviderFilter,
  wholesaleCategoryFilter,
  setWholesaleCategoryFilter,
  onOpenMarginModal,
  onBulkImport,
  onRefreshCatalog,
  onOpenImportModal,
}) => {
  // Filter products based on search, provider, and category folder
  const filteredWholesale = wholesaleCatalog.filter((item) => {
    // 1. Search filter
    if (wholesaleSearch.trim()) {
      const q = wholesaleSearch.toLowerCase();
      const nameMatch = (item.name || '').toLowerCase().includes(q);
      const catMatch = (item.category || '').toLowerCase().includes(q);
      const idMatch = String(item.id || '').toLowerCase().includes(q);
      if (!nameMatch && !catMatch && !idMatch) return false;
    }

    // 2. Provider filter
    if (wholesaleProviderFilter !== 'all') {
      if (item.provider !== wholesaleProviderFilter) return false;
    }

    // 3. Category folder filter
    if (wholesaleCategoryFilter !== 'all') {
      if ((item.category || '').toLowerCase() !== wholesaleCategoryFilter.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-crimson-400" /> Cloud Wholesale Sourcing Catalog
          </h3>
          <p className="text-xs text-zinc-400">
            Search live digital products across global cloud providers. Filter by brand folders, set profit margins, and import to your bot with 1 click!
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenMarginModal}
            className="px-3.5 py-2 rounded-xl bg-laser-600/20 hover:bg-laser-600/30 border border-laser-500/40 text-laser-300 text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
            title="Configure global profit margin"
          >
            <Sliders className="w-3.5 h-3.5" /> Set Profit Margin
          </button>
          <button
            onClick={onBulkImport}
            className="px-3.5 py-2 rounded-xl bg-laser-600 hover:bg-laser-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Auto-Import All (+Margin)
          </button>
          <button
            onClick={onRefreshCatalog}
            className="p-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300 transition-colors"
            title="Refresh Catalog"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input & Category Folders */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Instant search by product name, category folder, or ID..."
            value={wholesaleSearch}
            onChange={(e) => setWholesaleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-carbon-800 border border-white/10 text-white text-xs focus:outline-none focus:border-crimson-500 transition-colors"
          />
          {wholesaleSearch && (
            <button
              onClick={() => setWholesaleSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* API Provider Switcher (Mogent V1, Mogent V2, etc.) */}
        <div className="space-y-1.5 pb-2 border-b border-white/5">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Wholesale API Provider:
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setWholesaleProviderFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wholesaleProviderFilter === 'all'
                  ? 'bg-gradient-to-r from-laser-600 to-purple-600 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>⚡ All Providers</span>
            </button>
            <button
              onClick={() => setWholesaleProviderFilter('digitalcore')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wholesaleProviderFilter === 'digitalcore'
                  ? 'bg-gradient-to-r from-crimson-600 to-rose-600 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>📦 Mogent V1</span>
            </button>
            <button
              onClick={() => setWholesaleProviderFilter('vexorix')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wholesaleProviderFilter === 'vexorix'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>🚀 Mogent V2</span>
            </button>
            <button
              onClick={() => setWholesaleProviderFilter('canboso')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wholesaleProviderFilter === 'canboso'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>🌐 Mogent V3</span>
            </button>
            <button
              onClick={() => setWholesaleProviderFilter('prodseller')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wholesaleProviderFilter === 'prodseller'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>🔥 Mogent V4</span>
            </button>
            <button
              onClick={() => setWholesaleProviderFilter('ssondigital')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wholesaleProviderFilter === 'ssondigital'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>⚡ Mogent V5</span>
            </button>
            <button
              onClick={() => setWholesaleProviderFilter('blinkey')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                wholesaleProviderFilter === 'blinkey'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>🔑 Mogent V6</span>
            </button>
          </div>
        </div>

        {/* Category Filter Chips (Brand & Service Folders) */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-laser-400" /> Product Folders:
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pt-0.5 pb-1">
            <button
              onClick={() => setWholesaleCategoryFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                wholesaleCategoryFilter === 'all'
                  ? 'bg-crimson-500 text-white shadow'
                  : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span>📁 All Folders</span>
              <span className="text-[10px] opacity-80">
                ({wholesaleCatalog.length})
              </span>
            </button>
            {wholesaleCategories.map((cat) => {
              const catCount = wholesaleCatalog.filter(
                (i) => i.category?.toLowerCase() === cat.toLowerCase()
              ).length;
              return (
                <button
                  key={cat}
                  onClick={() => setWholesaleCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    wholesaleCategoryFilter.toLowerCase() === cat.toLowerCase()
                      ? 'bg-crimson-500 text-white shadow'
                      : 'bg-carbon-800 text-zinc-400 hover:text-white border border-white/5'
                  }`}
                >
                  <Folder className="w-3 h-3 opacity-60" />
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-75 font-mono">({catCount})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Wholesale Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredWholesale.length === 0 ? (
          <div className="col-span-full glass-card rounded-2xl p-12 text-center text-zinc-500 space-y-3">
            <AlertCircle className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-white font-semibold">No matching wholesale products found.</p>
            <p className="text-xs text-zinc-400">
              Try adjusting your search query or check if upstream catalog is active.
            </p>
          </div>
        ) : (
          filteredWholesale.map((item) => (
            <div
              key={item.id}
              className="glass-card rounded-2xl p-5 border border-white/10 flex flex-col justify-between space-y-4 hover:border-white/20 transition-all"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-carbon-800 text-laser-400 border border-laser-500/20 uppercase flex items-center gap-1">
                    <span>{item.icon || '⚡'}</span> {item.provider === 'digitalcore' ? 'Mogent V1' : item.provider === 'vexorix' ? 'Mogent V2' : item.provider === 'canboso' ? 'Mogent V3' : item.provider === 'prodseller' ? 'Mogent V4' : item.provider === 'ssondigital' ? 'Mogent V5' : item.provider === 'blinkey' ? 'Mogent V6' : item.provider}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    In Stock ({item.stock})
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white">{item.name?.replace(/\{pe:\d+\}/gi, '').trim()}</h4>
                <div className="text-xs text-zinc-400">Folder: {item.category?.replace(/\{pe:\d+\}/gi, '').trim()}</div>
                {item.description && (
                  <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5 whitespace-pre-line">
                    {item.description.replace(/\{pe:\d+\}/gi, '').trim()}
                  </p>
                )}
              </div>

              <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Wholesale Cost:</span>
                  <span className="font-mono text-base font-bold text-white">
                    ${item.cost_with_platform_fee_usd.toFixed(2)} USD
                  </span>
                </div>
                <button
                  onClick={() => onOpenImportModal(item)}
                  className="px-3.5 py-1.5 rounded-xl bg-crimson-600 hover:bg-crimson-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Import to Bot
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
