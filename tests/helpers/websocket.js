/**
 * WebSocket Helper for E2E Tests
 * Provides utilities for waiting on WebSocket connections
 */

/**
 * Wait for WebSocket connection to be established
 * @param {Page} page - Playwright page object
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} True if connected, false if timeout
 */
async function waitForSocketConnection(page, timeout = 10000) {
  try {
    const connected = await page.evaluate((timeout) => {
      return new Promise((resolve) => {
        // Already connected
        if (window.socket?.connected) {
          resolve(true);
          return;
        }

        // Wait for connect event
        const timer = setTimeout(() => {
          resolve(false);
        }, timeout);

        if (window.socket) {
          window.socket.on('connect', () => {
            clearTimeout(timer);
            resolve(true);
          });
        } else {
          clearTimeout(timer);
          resolve(false);
        }
      });
    }, timeout);

    return connected;
  } catch (error) {
    console.error('Error waiting for socket connection:', error);
    return false;
  }
}

/**
 * Wait for multiple WebSocket connections
 * Useful for multiplayer tests with multiple contexts
 * @param {Array<Page>} pages - Array of Playwright page objects
 * @param {number} timeout - Maximum wait time per page
 * @returns {Promise<number>} Number of successfully connected pages
 */
async function waitForMultipleSocketConnections(pages, timeout = 10000) {
  let connectedCount = 0;

  for (const page of pages) {
    const connected = await waitForSocketConnection(page, timeout);
    if (connected) {
      connectedCount++;
    }
  }

  return connectedCount;
}

/**
 * Check if socket is connected
 * @param {Page} page - Playwright page object
 * @returns {Promise<boolean>} True if connected
 */
async function isSocketConnected(page) {
  try {
    return await page.evaluate(() => {
      return window.socket?.connected === true;
    });
  } catch (error) {
    return false;
  }
}

/**
 * Get socket connection status
 * @param {Page} page - Playwright page object
 * @returns {Promise<string>} 'connected', 'connecting', or 'disconnected'
 */
async function getSocketStatus(page) {
  try {
    return await page.evaluate(() => {
      if (!window.socket) return 'disconnected';
      if (window.socket.connected) return 'connected';
      return 'connecting';
    });
  } catch (error) {
    return 'disconnected';
  }
}

/**
 * Wait for socket event
 * @param {Page} page - Playwright page object
 * @param {string} eventName - Event name to wait for
 * @param {number} timeout - Maximum wait time
 * @returns {Promise<any>} Event data or null if timeout
 */
async function waitForSocketEvent(page, eventName, timeout = 5000) {
  try {
    return await page.evaluate(({ eventName, timeout }) => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve(null);
        }, timeout);

        if (window.socket) {
          window.socket.once(eventName, (data) => {
            clearTimeout(timer);
            resolve(data);
          });
        } else {
          clearTimeout(timer);
          resolve(null);
        }
      });
    }, { eventName, timeout });
  } catch (error) {
    console.error(`Error waiting for socket event ${eventName}:`, error);
    return null;
  }
}

/**
 * Emit socket event and wait for response
 * @param {Page} page - Playwright page object
 * @param {string} eventName - Event to emit
 * @param {any} data - Data to send
 * @param {string} responseEvent - Event to wait for (optional)
 * @param {number} timeout - Maximum wait time
 * @returns {Promise<any>} Response data or null
 */
async function emitSocketEvent(page, eventName, data, responseEvent = null, timeout = 5000) {
  try {
    if (responseEvent) {
      // Emit and wait for response
      return await page.evaluate(({ eventName, data, responseEvent, timeout }) => {
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            resolve(null);
          }, timeout);

          if (window.socket) {
            window.socket.once(responseEvent, (responseData) => {
              clearTimeout(timer);
              resolve(responseData);
            });
            
            window.socket.emit(eventName, data);
          } else {
            clearTimeout(timer);
            resolve(null);
          }
        });
      }, { eventName, data, responseEvent, timeout });
    } else {
      // Just emit
      return await page.evaluate(({ eventName, data }) => {
        if (window.socket) {
          window.socket.emit(eventName, data);
          return true;
        }
        return false;
      }, { eventName, data });
    }
  } catch (error) {
    console.error(`Error emitting socket event ${eventName}:`, error);
    return null;
  }
}

module.exports = {
  waitForSocketConnection,
  waitForMultipleSocketConnections,
  isSocketConnected,
  getSocketStatus,
  waitForSocketEvent,
  emitSocketEvent
};
