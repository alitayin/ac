import { useEffect, useState } from 'react';

const WS_SERVER_URL = 'wss://api.agora.cash/ws';
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;
let wsConnection: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let currentReconnectDelay = INITIAL_RECONNECT_DELAY;
let reconnectAttempts = 0;
let heartbeatTimer: NodeJS.Timeout | null = null;
let lastSuccessfulConnection: number | null = null;
let currentAddresses: string[] = [];
let connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
const listeners: ((status: string) => void)[] = [];

function notifyStatusChange(status: string) {
  listeners.forEach(listener => listener(status));
  connectionStatus = status as any;
}

function connectWebSocket(addresses: string[]) {
  try {
    if (wsConnection) {
      wsConnection.close();
    }
    
    if (addresses.length === 0) {
      return;
    }
    
    currentAddresses = [...addresses];
    
    wsConnection = new WebSocket(WS_SERVER_URL);
    notifyStatusChange('connecting');
    
    const connectionTimeout = setTimeout(() => {
      if (wsConnection && wsConnection.readyState !== WebSocket.OPEN) {
        wsConnection.close();
        scheduleReconnect();
      }
    }, 10000);
    
    wsConnection.onopen = () => {
      clearTimeout(connectionTimeout);
      reconnectAttempts = 0;
      currentReconnectDelay = INITIAL_RECONNECT_DELAY;
      lastSuccessfulConnection = Date.now();
      notifyStatusChange('connected');
      
      const message = {
        type: 'client_online',
        addresses: addresses
      };
      
      wsConnection?.send(JSON.stringify(message));
      startHeartbeat();
      
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };
    
    wsConnection.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pong') {
          return;
        }
      } catch (_error) {
      }
    };
    
    wsConnection.onclose = (event) => {
      clearTimeout(connectionTimeout);
      stopHeartbeat();
      notifyStatusChange('disconnected');
      scheduleReconnect();
    };
    
    wsConnection.onerror = (error) => {
      clearTimeout(connectionTimeout);
      stopHeartbeat();
      notifyStatusChange('disconnected');
      scheduleReconnect();
    };
    
  } catch (_error) {
    notifyStatusChange('disconnected');
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimer && currentAddresses.length > 0) {
    reconnectAttempts++;
    
    currentReconnectDelay = Math.min(
      currentReconnectDelay * 1.5, 
      MAX_RECONNECT_DELAY
    );
    
    const jitter = Math.random() * 1000;
    const delay = currentReconnectDelay + jitter;
    
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket(currentAddresses);
    }, delay);
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      const heartbeat = {
        type: 'ping',
        timestamp: Date.now()
      };
      wsConnection.send(JSON.stringify(heartbeat));
    } else {
      stopHeartbeat();
      if (!reconnectTimer) {
        scheduleReconnect();
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function updateAddresses(addresses: string[]) {
  if (JSON.stringify(currentAddresses.sort()) === JSON.stringify([...addresses].sort())) {
    return;
  }
  
  currentAddresses = [...addresses];
  
  if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    const message = {
      type: 'update_addresses',
      addresses: addresses
    };
    wsConnection.send(JSON.stringify(message));
  } else if (addresses.length > 0) {
    connectWebSocket(addresses);
  }
}

export function closeConnection() {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  stopHeartbeat();
  currentAddresses = [];
}

export function addStatusListener(listener: (status: string) => void) {
  listeners.push(listener);
  listener(connectionStatus);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

export function useWebSocketStatus() {
  const [status, setStatus] = useState<string>(connectionStatus);
  
  useEffect(() => {
    const removeListener = addStatusListener(setStatus);
    return removeListener;
  }, []);
  
  return status;
}

export function useAddressNotifier(address: string | undefined) {
  const [notifying, setNotifying] = useState<boolean>(false);
  
  useEffect(() => {
    if (!address) {
      return;
    }
    
    updateAddresses([address]);
    setNotifying(true);
    
    return () => {
    };
  }, [address]);
  
  return notifying;
}

export function disconnectAddress(address: string) {
  if (!address) return;
  
  currentAddresses = currentAddresses.filter(addr => addr !== address);
  
  if (currentAddresses.length > 0 && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
    const message = {
      type: 'update_addresses',
      addresses: currentAddresses
    };
    wsConnection.send(JSON.stringify(message));
  } else if (currentAddresses.length === 0) {
    closeConnection();
  }
} 