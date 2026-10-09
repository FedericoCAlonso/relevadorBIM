/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIEWMODEL: useLaserViewModel.ts
 * Hook reactivo para estado y acciones del distanciómetro láser.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { laserBluetoothService } from '../services/laserBluetoothService';
import type { LaserDeviceStatus } from '../services/laserBluetoothService';

export function useLaserViewModel(onMeasurementReceived?: (distanceM: number) => void) {
  const [status, setStatus] = useState<LaserDeviceStatus>(() => laserBluetoothService.getStatus());

  const onMeasurementRef = useRef(onMeasurementReceived);

  useEffect(() => {
    onMeasurementRef.current = onMeasurementReceived;
  }, [onMeasurementReceived]);

  useEffect(() => {
    const unsubscribe = laserBluetoothService.subscribe(
      (dist) => {
        onMeasurementRef.current?.(dist);
      },
      (newStatus) => {
        setStatus(newStatus);
      }
    );

    return () => unsubscribe();
  }, []);

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
