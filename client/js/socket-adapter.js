/**
 * Socket.IO Adapter
 * 
 * Wrapper for Socket.IO client with auto-reconnect, error handling,
 * and centralized error reporting to server
 */

class SocketAdapter {
  constructor(url = window.location.origin) {
    this.socket = io(url, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      // Plesk compatibility - try polling first, then upgrade to WebSocket
      transports: ['polling', 'websocket'],
      path: '/socket.io/',
      // Force secure connection on HTTPS
      secure: window.location.protocol === 'https:',
      rejectUnauthorized: false // For self-signed certs (development only)
    });
    
    this.connected = false;
    this.setupListeners();
    this.setupGlobalErrorHandlers();
  }

  setupListeners() {
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket.id);
      this.connected = true;
      
      // Trigger custom event
      window.dispatchEvent(new CustomEvent('socket:connected', { 
        detail: { socketId: this.socket.id } 
      }));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.connected = false;
      
      window.dispatchEvent(new CustomEvent('socket:disconnected', { 
        detail: { reason } 
      }));
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error.message);
      
      window.dispatchEvent(new CustomEvent('socket:error', { 
        detail: { error: error.message } 
      }));
    });

    this.socket.on('error', (error) => {
      console.error('⚠️ Socket error:', error);
      this.reportError({ message: 'Socket error', error: String(error) });
      
      window.dispatchEvent(new CustomEvent('socket:error', { 
        detail: { error } 
      }));
    });
  }

  /**
   * Setup global error handlers to catch all client-side errors
   * and report them to the server for debugging
   */
  setupGlobalErrorHandlers() {
    // Catch uncaught errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.reportError({
        message: String(message),
        source,
        lineno,
        colno,
        stack: error?.stack
      });
      return false; // Don't prevent default handling
    };

    // Catch unhandled promise rejections
    window.onunhandledrejection = (event) => {
      this.reportError({
        message: 'Unhandled Promise Rejection',
        reason: String(event.reason),
        stack: event.reason?.stack
      });
    };
  }

  /**
   * Report error to server for centralized logging
   * @param {Object} errorData - Error details
   */
  reportError(errorData) {
    try {
      const payload = {
        ...errorData,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      // Use fetch for error reporting (works even if socket is disconnected)
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {
        // Silently fail if server is unreachable
        console.warn('Failed to report error to server');
      });
    } catch (e) {
      // Ignore errors in error reporting
    }
  }

  /**
   * Emit event to server
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @param {Function} callback - Optional callback
   */
  emit(event, data, callback) {
    if (!this.connected) {
      console.warn('⚠️ Socket not connected, queuing event:', event);
    }
    
    if (callback) {
      this.socket.emit(event, data, callback);
    } else if (data) {
      this.socket.emit(event, data);
    } else {
      this.socket.emit(event);
    }
  }

  /**
   * Listen for event from server
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    this.socket.on(event, callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler (optional)
   */
  off(event, callback) {
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Listen for event once
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  once(event, callback) {
    this.socket.once(event, callback);
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    this.socket.disconnect();
  }

  /**
   * Reconnect socket
   */
  reconnect() {
    this.socket.connect();
  }

  /**
   * Get connection status
   * @returns {boolean}
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get socket ID
   * @returns {string|null}
   */
  getSocketId() {
    return this.socket.id || null;
  }
}

// Export singleton instance
window.socketAdapter = new SocketAdapter();
