import { useEffect, useState } from 'react';

const WS_SERVER_URL = 'wss://api.agora.cash/ws';
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 30000;

// All mutable WebSocket state in one singleton object
const state = {
  wsConnection: null as WebSocket | null,
  reconnectTimer: null as NodeJS.Timeout | null,
  currentReconnectDelay: INITIAL_RECONNECT_DELAY,
  reconnectAttempts: 0,
  heartbeatTimer: null as NodeJS.Timeout | null,
  lastSuccessfulConnection: null as number | null,
  currentAddresses: [] as string[],
  connectionStatus: 'disconnected' as 'connecting' | 'connected' | 'disconnected',
  listeners: [] as ((status: string) => void)[],
};

function notifyStatusChange(status: string) {
  state.listeners.forEach(listener => listener(status));
  state.connectionStatus = status as typeof state.connectionStatus;
}

function connectWebSocket(addresses: string[]) {
  try {
    if (state.wsConnection) {
      state.wsConnection.close();
    }

    if (addresses.length === 0) {
      return;
    }

    state.currentAddresses = [...addresses];

    state.wsConnection = new WebSocket(WS_SERVER_URL);
    notifyStatusChange('connecting');

    const connectionTimeout = setTimeout(() => {
      if (state.wsConnection && state.wsConnection.readyState !== WebSocket.OPEN) {
        state.wsConnection.close();
        scheduleReconnect();
      }
    }, 10000);

    state.wsConnection.onopen = () => {
      clearTimeout(connectionTimeout);
      state.reconnectAttempts = 0;
      state.currentReconnectDelay = INITIAL_RECONNECT_DELAY;
      state.lastSuccessfulConnection = Date.now();
      notifyStatusChange('connected');

      state.wsConnection?.send(JSON.stringify({ type: 'client_online', addresses }));
      startHeartbeat();

      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
      }
    };

    state.wsConnection.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pong') {
          return;
        }
      } catch (_error) {
      }
    };

    state.wsConnection.onclose = () => {
      clearTimeout(connectionTimeout);
      stopHeartbeat();
      notifyStatusChange('disconnected');
      scheduleReconnect();
    };

    state.wsConnection.onerror = () => {
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
  if (!state.reconnectTimer && state.currentAddresses.length > 0) {
    state.reconnectAttempts++;
    state.currentReconnectDelay = Math.min(state.currentReconnectDelay * 1.5, MAX_RECONNECT_DELAY);
    const delay = state.currentReconnectDelay + Math.random() * 1000;
    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      connectWebSocket(state.currentAddresses);
    }, delay);
  }
}

function startHeartbeat() {
  stopHeartbeat();
  state.heartbeatTimer = setInterval(() => {
    if (state.wsConnection && state.wsConnection.readyState === WebSocket.OPEN) {
      state.wsConnection.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
    } else {
      stopHeartbeat();
      if (!state.reconnectTimer) {
        scheduleReconnect();
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

export function updateAddresses(addresses: string[]) {
  if (JSON.stringify([...state.currentAddresses].sort()) === JSON.stringify([...addresses].sort())) {
    return;
  }

  if (state.wsConnection && state.wsConnection.readyState === WebSocket.OPEN) {
    state.currentAddresses = [...addresses];
    state.wsConnection.send(JSON.stringify({ type: 'update_addresses', addresses }));
  } else {
    connectWebSocket(addresses);
  }
}

export function closeConnection() {
  if (state.wsConnection) {
    state.wsConnection.close();
    state.wsConnection = null;
  }

  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }

  stopHeartbeat();
  state.currentAddresses = [];
}

export function addStatusListener(listener: (status: string) => void) {
  state.listeners.push(listener);
  listener(state.connectionStatus);
  return () => {
    const index = state.listeners.indexOf(listener);
    if (index !== -1) {
      state.listeners.splice(index, 1);
    }
  };
}

export function useWebSocketStatus() {
  const [status, setStatus] = useState<string>(state.connectionStatus);

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
      disconnectAddress(address);
    };
  }, [address]);

  return notifying;
}

export function disconnectAddress(address: string) {
  if (!address) return;

  state.currentAddresses = state.currentAddresses.filter(addr => addr !== address);

  if (state.currentAddresses.length > 0 && state.wsConnection && state.wsConnection.readyState === WebSocket.OPEN) {
    state.wsConnection.send(JSON.stringify({ type: 'update_addresses', addresses: state.currentAddresses }));
  } else if (state.currentAddresses.length === 0) {
    closeConnection();
  }
}


