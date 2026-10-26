import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PwaService, type BeforeInstallPromptEvent } from '../pwaService';

describe('PwaService - Ciclo de Vida PWA y Soporte Offline', () => {
  let service: PwaService;

  beforeEach(() => {
    service = new PwaService();
  });

  it('debe inicializarse con estado por defecto coherente', () => {
    const status = service.getStatus();
    expect(typeof status.isOnline).toBe('boolean');
    expect(status.hasUpdate).toBe(false);
    expect(status.isInstallable).toBe(false);
  });

  it('debe notificar a los suscriptores cuando cambia el estado de conexión online/offline', () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    // Primer llamada con estado inicial
    expect(listener).toHaveBeenCalledTimes(1);

    // Simular pérdida de conexión
    service._simulateOnline(false);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(service.getStatus().isOnline).toBe(false);

    // Simular recuperación de conexión
    service._simulateOnline(true);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(service.getStatus().isOnline).toBe(true);

    unsubscribe();
    service._simulateOnline(false);
    // Ya no debe recibir notificaciones tras desuscribirse
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('debe capturar el evento beforeinstallprompt y ejecutar promptInstall', async () => {
    const listener = vi.fn();
    service.subscribe(listener);

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });

    const mockEvent = {
      platforms: ['web'],
      userChoice: mockChoice,
      prompt: mockPrompt,
      preventDefault: vi.fn()
    } as unknown as BeforeInstallPromptEvent;

    service._simulatePromptEvent(mockEvent);

    expect(service.getStatus().isInstallable).toBe(true);

    const installed = await service.promptInstall();
    expect(mockPrompt).toHaveBeenCalled();
    expect(installed).toBe(true);
    expect(service.getStatus().isInstalled).toBe(true);
    expect(service.getStatus().isInstallable).toBe(false);
  });

  it('debe marcar isInstalled cuando el navegador emite appinstalled', () => {
    service._simulateAppInstalled();
    expect(service.getStatus().isInstalled).toBe(true);
  });

  it('debe detectar actualizaciones del service worker', () => {
    service._simulateUpdate();
    expect(service.getStatus().hasUpdate).toBe(true);
  });
});
