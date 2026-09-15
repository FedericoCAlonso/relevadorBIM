/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: laserBluetoothService.ts
 * Driver Web Bluetooth para Distanciómetros Láser (Leica, Bosch, Mileseey).
 * Provee conexión inalámbrica directa en obra y modo simulador para testing.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface LaserDeviceStatus {
  isConnected: boolean;
  deviceName: string | null;
  batteryPercent: number | null;
  lastMeasurementM: number | null;
  error: string | null;
}

export type MeasurementCallback = (distanceM: number) => void;
export type StatusCallback = (status: LaserDeviceStatus) => void;

class LaserBluetoothService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private onMeasurement: MeasurementCallback | null = null;
  private onStatusChange: StatusCallback | null = null;

  private status: LaserDeviceStatus = {
    isConnected: false,
    deviceName: null,
    batteryPercent: null,
    lastMeasurementM: null,
    error: null
  };

  /**
   * Suscribe oyentes de mediciones y cambios de estado.
   */
  public subscribe(onMeasurement: MeasurementCallback, onStatusChange: StatusCallback): () => void {
    this.onMeasurement = onMeasurement;
    this.onStatusChange = onStatusChange;
    this.notifyStatus();

    return () => {
      this.onMeasurement = null;
      this.onStatusChange = null;
    };
  }

  /**
   * Conecta al distanciómetro vía Web Bluetooth API nativa de Chrome / Android.
   */
  public async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      this.status.error = 'Web Bluetooth no está soportado en este navegador. Usa Chrome o Edge.';
      this.notifyStatus();
      return;
    }

    try {
      this.status.error = null;
      this.notifyStatus();

      // Solicitar dispositivo con filtros para marcas comunes o cualquier medidor BLE
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'battery_service',
          '0000ffe0-0000-1000-8000-00805f9b34fb', // Mileseey / Duka / Atuman
          '3ab10100-f831-4395-b29d-570977d5bf94', // Leica DISTO
          '0000181a-0000-1000-8000-00805f9b34fb'  // Environmental Sensing / Distance GATT
        ]
      });

      this.device = device;
      this.status.deviceName = device.name || 'Distanciómetro Láser';

      device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

      const server = await device.gatt?.connect();
      if (!server) throw new Error('No se pudo conectar al servidor GATT');
      this.server = server;

      this.status.isConnected = true;
      this.notifyStatus();

      // Intentar suscribir a características de distancia
      await this.setupGattListeners(server);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        this.status.error = err.message || 'Error al conectar dispositivo Bluetooth';
      }
      this.status.isConnected = false;
      this.notifyStatus();
    }
  }

  /**
   * Desconecta el dispositivo actual.
   */
  public disconnect(): void {
    if (this.server?.connected) {
      this.server.disconnect();
    } else if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnect();
  }

  /**
   * Emula una medición (para testing en desktop o cuando se ingresa con teclado táctil).
   */
  public simulateMeasurement(distanceM: number): void {
    this.status.lastMeasurementM = distanceM;
    this.notifyStatus();
    if (this.onMeasurement) {
      this.onMeasurement(distanceM);
    }
  }

  private handleDisconnect(): void {
    this.status.isConnected = false;
    this.status.deviceName = null;
    this.server = null;
    this.device = null;
    this.notifyStatus();
  }

  private notifyStatus(): void {
    if (this.onStatusChange) {
      this.onStatusChange({ ...this.status });
    }
  }

  private async setupGattListeners(server: BluetoothRemoteGATTServer): Promise<void> {
    try {
      const services = await server.getPrimaryServices();
      for (const svc of services) {
        const chars = await svc.getCharacteristics();
        for (const char of chars) {
          if (char.properties.notify || char.properties.indicate) {
            await char.startNotifications();
            char.addEventListener('characteristicvaluechanged', (e: any) => {
              this.parseLaserData(e.target.value);
            });
          }
        }
      }
    } catch {
      // Si el escaneo genérico falla, la conexión sigue activa para lectura bajo demanda
    }
  }

  private parseLaserData(dataView: DataView): void {
    try {
      // Parsear buffer métrico estándar (punto flotante IEEE o ASCII de distanciómetros chinos/europeos)
      if (dataView.byteLength >= 4) {
        // Formato flotante común de 32 bits Little Endian
        const floatVal = dataView.getFloat32(0, true);
        if (floatVal > 0.05 && floatVal < 100.0) {
          const valM = Number(floatVal.toFixed(3));
          this.simulateMeasurement(valM);
          return;
        }
      }

      // Formato texto ASCII (ej: "DIST 3.450 m")
      const textDecoder = new TextDecoder();
      const str = textDecoder.decode(dataView);
      const match = str.match(/([0-9]+\.[0-9]+)/);
      if (match) {
        const valM = parseFloat(match[1]);
        if (!isNaN(valM) && valM > 0) {
          this.simulateMeasurement(Number(valM.toFixed(3)));
        }
      }
    } catch {
      // Ignorar cuadros de control
    }
  }
}

export const laserBluetoothService = new LaserBluetoothService();
