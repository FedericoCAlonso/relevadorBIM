import { describe, it, expect, vi } from 'vitest';
import { laserBluetoothService } from '../../services/laserBluetoothService';

describe('laserBluetoothService & useLaserViewModel contract', () => {
  it('getStatus retorna una copia inmutable del estado del distanciómetro', () => {
    const status = laserBluetoothService.getStatus();
    expect(status).toBeDefined();
    expect(typeof status.isConnected).toBe('boolean');
    expect(status.isConnected).toBe(false);
  });

  it('subscribe notifica el estado inmediatamente y emite mediciones emuladas', () => {
    const onMeasurement = vi.fn();
    const onStatus = vi.fn();

    const unsubscribe = laserBluetoothService.subscribe(onMeasurement, onStatus);

    // Debe recibir el estado inicial al suscribirse
    expect(onStatus).toHaveBeenCalledTimes(1);
    expect(onStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        isConnected: false
      })
    );

    // Emular medición
    laserBluetoothService.simulateMeasurement(5.42);
    expect(onMeasurement).toHaveBeenCalledWith(5.42);
    expect(laserBluetoothService.getStatus().lastMeasurementM).toBe(5.42);

    unsubscribe();

    // Luego de desuscribirse no debe llamar al callback
    laserBluetoothService.simulateMeasurement(2.10);
    expect(onMeasurement).toHaveBeenCalledTimes(1);
  });
});
