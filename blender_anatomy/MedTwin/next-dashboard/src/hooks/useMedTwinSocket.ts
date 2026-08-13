"use client";

import { useEffect, useState, useRef } from 'react';

interface TelemetryData {
  heart_rate: number;
  risk_score: number;
  ecg_prediction: string;
  vision_prediction: string;
  agreement_score: number;
  conflict: boolean;
}

export function useMedTwinSocket(patientId = 'PT-001') {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;

    function connect() {
      // Connect to the FastAPI hub WebSocket running on port 8001
      wsRef.current = new WebSocket(`ws://localhost:8001/ws/patient/${patientId}`);

      wsRef.current.onopen = () => {
        setConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'fusion_update') {
            setData(msg);
          }
        } catch (err) {
          console.error("Failed to parse websocket message", err);
        }
      };

      wsRef.current.onclose = () => {
        setConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      wsRef.current.onerror = () => {
        wsRef.current.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [patientId]);

  return { connected, data };
}
