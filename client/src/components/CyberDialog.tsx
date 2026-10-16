import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, X } from 'lucide-react';

export interface CyberDialogOptions {
  type?: 'alert' | 'confirm' | 'prompt';
  tone?: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (value?: string) => void | Promise<void>;
  onCancel?: () => void;
}

interface CyberDialogProps {
  dialog: CyberDialogOptions | null;
  onClose: () => void;
}

export const CyberDialog: React.FC<CyberDialogProps> = ({ dialog, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (dialog?.type === 'prompt') {
      setInputValue(dialog.defaultValue || '');
    }
  }, [dialog]);

  if (!dialog) return null;

  const tone = dialog.tone || (dialog.type === 'confirm' ? 'warning' : 'info');

  const getToneStyles = () => {
    switch (tone) {
      case 'danger':
        return {
          border: 'border-crimson-500/50 shadow-crimson-600/30',
          iconBg: 'bg-crimson-500/20 text-crimson-400',
          btnBg: 'bg-crimson-600 hover:bg-crimson-500 text-white shadow-crimson-600/30',
          icon: ShieldAlert,
        };
      case 'warning':
        return {
          border: 'border-amber-500/50 shadow-amber-600/30',
          iconBg: 'bg-amber-500/20 text-amber-400',
          btnBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30',
          icon: AlertTriangle,
        };
      case 'success':
        return {
          border: 'border-emerald-500/50 shadow-emerald-600/30',
          iconBg: 'bg-emerald-500/20 text-emerald-400',
          btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30',
          icon: CheckCircle,
        };
      default:
        return {
          border: 'border-laser-500/50 shadow-laser-600/30',
          iconBg: 'bg-laser-500/20 text-laser-400',
          btnBg: 'bg-laser-600 hover:bg-laser-500 text-white shadow-laser-600/30',
          icon: Info,
        };
    }
  };

  const toneStyle = getToneStyles();
  const IconComponent = toneStyle.icon;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (dialog.onConfirm) {
        await dialog.onConfirm(dialog.type === 'prompt' ? inputValue : undefined);
      }
      onClose();
    } catch (err) {
      console.error('CyberDialog confirm error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (dialog.onCancel) dialog.onCancel();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && dialog.type !== 'prompt') {
      handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div
        className={`glass-card-cyber max-w-md w-full rounded-2xl border p-6 space-y-5 shadow-2xl relative ${toneStyle.border}`}
      >
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toneStyle.iconBg}`}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="space-y-1 pr-6">
            <h3 className="text-base font-mono font-bold text-white tracking-wide">{dialog.title}</h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">{dialog.message}</p>
          </div>
        </div>

        {dialog.type === 'prompt' && (
          <div className="space-y-2 pt-1">
            {dialog.inputLabel && (
              <label className="block text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                {dialog.inputLabel}
              </label>
            )}
            <input
              type="text"
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              placeholder={dialog.inputPlaceholder || 'Enter value...'}
              className="w-full px-4 py-2.5 rounded-xl bg-carbon-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-laser-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          {dialog.type !== 'alert' && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-carbon-800 hover:bg-carbon-700 text-zinc-300 hover:text-white text-xs font-mono font-semibold transition-colors"
            >
              {dialog.cancelText || 'Cancel'}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`px-5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 ${toneStyle.btnBg}`}
          >
            {dialog.confirmText || (dialog.type === 'alert' ? 'Got It' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
