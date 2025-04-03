import { API_BASE_URL } from './config';

export interface DownloadProgress {
  status: 'downloading' | 'processing' | 'complete' | 'error' | 'log';
  title?: string;
  downloaded_bytes?: number;
  total_bytes?: number;
  speed?: number;
  eta?: number;
  progress?: number;
  message?: string;
  filename?: string;
  type?: string;
  size?: number;
  level?: 'debug' | 'info' | 'warning' | 'error';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Patterns to identify different stages
const LOG_PATTERNS = {
  DOWNLOAD: [
    /\[download\]/i,
    /Downloading/i,
    /Destination/i,
  ],
  MERGE: [
    /\[Merger\]/i,
    /Merging formats/i,
    /into mkv/i,
    /into mp4/i,
  ],
  POSTPROCESS: [
    /\[PostProcessor\]/i,
    /\[Metadata\]/i,
    /\[FFmpeg\]/i,
    /Fixing/i,
    /Post-process/i,
  ],
  // Messages to filter out (too noisy)
  FILTER: [
    /\[debug\]/i,
    /Downloading webpage/i,
    /Downloading api/i,
    /Downloading m3u8/i,
    /Downloading MPD manifest/i,
    /Downloading JSON metadata/i,
    /\[generic\] \w+: Downloading webpage/i,
  ]
};

function identifyLogStage(message: string): 'download' | 'merge' | 'postprocess' | 'general' {
  if (LOG_PATTERNS.DOWNLOAD.some(pattern => pattern.test(message))) {
    return 'download';
  }
  if (LOG_PATTERNS.MERGE.some(pattern => pattern.test(message))) {
    return 'merge';
  }
  if (LOG_PATTERNS.POSTPROCESS.some(pattern => pattern.test(message))) {
    return 'postprocess';
  }
  return 'general';
}

function shouldFilterLog(message: string): boolean {
  return LOG_PATTERNS.FILTER.some(pattern => pattern.test(message));
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private clientId: string;
  private pingInterval: NodeJS.Timeout | null = null;
  private onProgressCallback: ((progress: DownloadProgress) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private isConnecting: boolean = false;

  constructor() {
    this.clientId = 'client-' + Math.random().toString(36).substr(2, 9);
    console.log('🔧 [WebSocket] Created with client ID:', this.clientId);
  }

  connect() {
    if (this.isConnecting) {
      console.log('⏳ [WebSocket] Connection already in progress');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('✅ [WebSocket] Already connected');
      return;
    }

    this.isConnecting = true;
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const fullUrl = `${wsUrl}/ws/${this.clientId}`;
    console.log('🔌 [WebSocket] Attempting connection to:', fullUrl, 'Attempt:', this.reconnectAttempts + 1);
    
    try {
      this.ws = new WebSocket(fullUrl);
      console.log('✨ [WebSocket] Instance created, waiting for connection...');

      this.ws.onmessage = (event) => {
        try {
          const rawData = event.data;
          console.log('📨 [WebSocket] Raw message received:', typeof rawData, rawData.slice(0, 200) + (rawData.length > 200 ? '...' : ''));
          
          const data: DownloadProgress = JSON.parse(rawData);
          console.log('✅ [WebSocket] Parsed message:', {
            status: data.status,
            level: data.level,
            messagePreview: data.message?.slice(0, 100)
          });
          
          // Filter out noisy debug messages if needed
          if (data.status === 'log' && data.level === 'debug' && shouldFilterLog(data.message || '')) {
            console.log('🔇 [WebSocket] Filtered debug message');
            return;
          }

          if (this.onProgressCallback) {
            console.log('🎯 [WebSocket] Calling progress callback');
            this.onProgressCallback(data);
          } else {
            console.warn('⚠️ [WebSocket] No progress callback registered');
          }
        } catch (error) {
          console.error('❌ [WebSocket] Failed to parse message:', error);
          console.error('❌ [WebSocket] Raw message that failed:', event.data);
        }
      };

      this.ws.onopen = () => {
        console.log('🟢 [WebSocket] Connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
        this.onConnectionChangeCallback?.(true);
      };

      this.ws.onclose = (event) => {
        console.log('🔴 [WebSocket] Disconnected - Code:', event.code, 'Reason:', event.reason || 'No reason provided');
        this.isConnecting = false;
        this.stopPing();
        this.onConnectionChangeCallback?.(false);

        // Attempt to reconnect if not manually disconnected
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log('🔄 [WebSocket] Attempting reconnection...');
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 2000 * Math.pow(2, this.reconnectAttempts - 1));
        } else {
          console.error('❌ [WebSocket] Max reconnection attempts reached');
        }
      };

      this.ws.onerror = (error) => {
        console.error('💥 [WebSocket] Error:', error);
        this.onConnectionChangeCallback?.(false);
      };
    } catch (error) {
      console.error('💥 [WebSocket] Failed to create instance:', error);
      this.isConnecting = false;
      this.onConnectionChangeCallback?.(false);
    }
  }

  disconnect() {
    if (this.ws) {
      console.log('👋 [WebSocket] Disconnecting...');
      this.ws.close();
      this.ws = null;
    }
    this.stopPing();
  }

  private startPing() {
    console.log('🏓 [WebSocket] Starting ping interval');
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('📤 [WebSocket] Sending ping');
        this.ws.send('ping');
      } else {
        console.warn('⚠️ [WebSocket] Cannot send ping - connection not open');
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      console.log('⏹️ [WebSocket] Stopping ping interval');
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  onProgress(callback: (progress: DownloadProgress) => void) {
    console.log('📝 [WebSocket] Registering progress callback');
    this.onProgressCallback = callback;
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    this.onConnectionChangeCallback = callback;
  }

  getClientId() {
    return this.clientId;
  }
} 