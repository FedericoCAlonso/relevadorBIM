/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VISTA: BulkEditModal.tsx (Patrón Estricto MVVM)
 * Modal contenedor de Edición en Lote para dispositivos móviles o acceso rápido.
 * Renderiza BulkEditPanel dentro de un diálogo modal responsive.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { BulkEditPanel } from './BulkEditPanel';
import { X, Layers } from 'lucide-react';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Layers size={16} />
            </div>
            <span className="text-sm font-bold text-slate-800">Edición en Lote</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-3 overflow-y-auto flex-1">
          <BulkEditPanel />
        </div>
      </div>
    </div>
  );
};
