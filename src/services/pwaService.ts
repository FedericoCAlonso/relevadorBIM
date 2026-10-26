/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: pwaService.ts
 * Responsabilidad Única (SRP):
 * Gestión del ciclo de vida del Service Worker, conectividad de red y evento
 * beforeinstallprompt de la PWA.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface PwaStatus {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  isIos: boolean;
  hasUpdate: boolean;
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PwaListener = (status: PwaStatus) => void;

export class PwaService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isOnline: boolean =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  private isInstalled: boolean = false;
  private hasUpdate: boolean = false;
  private isIos: boolean = false;
  private listeners = new Set<PwaListener>();
  private initialized = false;

  constructor() {
    this.checkInitialState();
  }

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.checkInitialState();

    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', this.handleAppInstalled);

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', this.handleControllerChange);
    }
  }

  private checkInitialState(): void {
    if (typeof window === 'undefined') return;
    const isStandaloneDisplay = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
    const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    this.isInstalled = isStandaloneDisplay || isIosStandalone;

    if (typeof navigator !== 'undefined') {
      if (typeof navigator.onLine === 'boolean') {
        this.isOnline = navigator.onLine;
      }
      this.isIos =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as unknown as { MSStream?: unknown }).MSStream;
    }
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notify();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notify();
  };

  private handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    this.deferredPrompt = e as BeforeInstallPromptEvent;
    this.notify();
  };

  private handleAppInstalled = () => {
    this.isInstalled = true;
    this.deferredPrompt = null;
    this.notify();
  };

  private handleControllerChange = () => {
    this.hasUpdate = true;
    this.notify();
  };

  public getStatus(): PwaStatus {
    return {
      isOnline: this.isOnline,
      isInstallable: !!this.deferredPrompt,
      isInstalled: this.isInstalled,
      isIos: this.isIos,
      hasUpdate: this.hasUpdate
    };
  }

  public subscribe(listener: PwaListener): () => void {
    this.init();
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;
    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.notify();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public reloadApp(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  // Métodos de apoyo para pruebas y simulación
  public _simulatePromptEvent(e: BeforeInstallPromptEvent): void {
    this.handleBeforeInstallPrompt(e);
  }

  public _simulateAppInstalled(): void {
    this.handleAppInstalled();
  }

  public _simulateOnline(online: boolean): void {
    this.isOnline = online;
    this.notify();
  }

  public _simulateUpdate(): void {
    this.hasUpdate = true;
    this.notify();
  }
}

export const pwaService = new PwaService();
