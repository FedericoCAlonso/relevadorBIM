/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: usePwaViewModel.ts
 * Responsabilidad Única (SRP):
 * Enlace reactivo del ciclo de vida de la Progressive Web App (PWA):
 * conectividad, instalación y actualización para los componentes de vista.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { pwaService, type PwaStatus } from '../services/pwaService';

export interface PwaViewModelState extends PwaStatus {
  installApp: () => Promise<boolean>;
  refreshApp: () => void;
}

export function usePwaViewModel(): PwaViewModelState {
  const [status, setStatus] = useState<PwaStatus>(() => pwaService.getStatus());

  useEffect(() => {
    return pwaService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  const installApp = useCallback(async () => {
    return pwaService.promptInstall();
  }, []);

  const refreshApp = useCallback(() => {
    pwaService.reloadApp();
  }, []);

  return {
    ...status,
    installApp,
    refreshApp
  };
}
