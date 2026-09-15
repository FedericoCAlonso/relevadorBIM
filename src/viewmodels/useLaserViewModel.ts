/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useLaserViewModel.ts
 * Hook reactivo para estado y acciones del distanciómetro láser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { laserBluetoothService } from '../services/laserBluetoothService';
import type { LaserDeviceStatus } from '../services/laserBluetoothService';

export function useLaserViewModel(onMeasurementReceived?: (distanceM: number) => void) {
  const [status, setStatus] = useState<LaserDeviceStatus>({
    isConnected: false,
    deviceName: null,
    batteryPercent: null,
    lastMeasurementM: null,
    error: null
  });

  useEffect(() => {
    const unsubscribe = laserBluetoothService.subscribe(
      (dist) => {
        if (onMeasurementReceived) {
          onMeasurementReceived(dist);
        }
      },
      (newStatus) => {
        setStatus(newStatus);
      }
    );

    return () => unsubscribe();
  }, [onMeasurementReceived]);

  const connect = useCallback(async () => {
    await laserBluetoothService.connect();
  }, []);

  const disconnect = useCallback(() => {
    laserBluetoothService.disconnect();
  }, []);

  const simulateMeasurement = useCallback((valM: number) => {
    laserBluetoothService.simulateMeasurement(valM);
  }, []);

  return {
    status,
    connect,
    disconnect,
    simulateMeasurement
  };
}
