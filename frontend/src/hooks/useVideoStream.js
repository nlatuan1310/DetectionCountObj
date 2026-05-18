import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook quản lý WebSocket video stream.
 *
 * KHÔNG auto-connect on mount — chỉ connect khi gọi connect() thủ công.
 * Tránh flood reconnect khi chưa cần thiết.
 */
const useVideoStream = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    display_fps: 0,
    inference_fps: 0,
    total_detections: 0,
    class_counts: {},
    crossing_total: 0,
    warnings: [],
    camera_connected: false,
  });

  const imgRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const blobUrlRef = useRef(null);
  const intentionalCloseRef = useRef(false);

  const getWsUrl = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/stream`;
  };

  const cleanup = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Tránh mở nhiều connection song song
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return;
      }
    }

    intentionalCloseRef.current = false;

    try {
      const ws = new WebSocket(getWsUrl());
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        setIsConnected(true);
        console.log('[WS] Connected to stream');
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Tạo blob URL mới, revoke cũ
          const blob = new Blob([event.data], { type: 'image/jpeg' });
          const newUrl = URL.createObjectURL(blob);
          const oldUrl = blobUrlRef.current;
          blobUrlRef.current = newUrl;

          // Dùng rAF để batch render, tránh layout thrashing
          requestAnimationFrame(() => {
            if (imgRef.current) {
              imgRef.current.src = newUrl;
            }
            if (oldUrl) {
              URL.revokeObjectURL(oldUrl);
            }
          });
        } else {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'stats') {
              setStats(data);
            } else if (data.type === 'status') {
              setStats((prev) => ({ ...prev, ...data }));
            }
          } catch (e) {
            // ignore invalid JSON
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Chỉ auto-reconnect nếu KHÔNG phải do user chủ động disconnect
        if (!intentionalCloseRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            console.log('[WS] Attempting reconnect...');
            connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        // onclose sẽ fire sau onerror, không cần xử lý thêm
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WS] Connection failed:', error);
    }
  }, []);

  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    cleanup();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [cleanup]);

  const sendConfig = useCallback((config) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(config));
    }
  }, []);

  // Cleanup on unmount — KHÔNG auto-connect
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [cleanup]);

  return {
    isConnected,
    stats,
    imgRef,
    connect,
    disconnect,
    sendConfig,
  };
};

export default useVideoStream;
