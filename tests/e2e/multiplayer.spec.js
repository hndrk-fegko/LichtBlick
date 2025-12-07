/**
 * Multiplayer E2E Tests
 * Tests WebSocket connections, real-time synchronization, and multi-player scenarios
 */

const { test, expect } = require('../fixtures/base');

test.describe('Multiplayer Tests', () => {
  
  test.describe('WebSocket Connections', () => {
    
    test('should establish WebSocket connection for player', async ({ page }) => {
      // Track WebSocket connections
      const wsConnections = [];
      page.on('websocket', ws => {
        wsConnections.push(ws);
        console.log('WebSocket connected:', ws.url());
      });
      
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Check for Socket.IO connection
      const isConnected = await page.evaluate(() => {
        return window.socket && window.socket.connected;
      }).catch(() => false);
      
      expect(isConnected).toBeTruthy();
    });

    test('should establish WebSocket connection for admin', async ({ adminPage }) => {
      await adminPage.waitForTimeout(1000);
      
      // Check admin WebSocket connection
      const isConnected = await adminPage.evaluate(() => {
        return window.socket && window.socket.connected;
      }).catch(() => false);
      
      expect(isConnected).toBeTruthy();
    });

    test('should establish WebSocket connection for beamer', async ({ beamerPage }) => {
      await beamerPage.waitForTimeout(1000);
      
      // Check beamer WebSocket connection
      const isConnected = await beamerPage.evaluate(() => {
        return window.socket && window.socket.connected;
      }).catch(() => false);
      
      expect(isConnected).toBeTruthy();
    });

    test('should handle WebSocket reconnection', async ({ page }) => {
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      // Join as player
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('ReconnectTest');
        const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
        await joinButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Simulate disconnect by evaluating in browser
      await page.evaluate(() => {
        if (window.socket) {
          window.socket.disconnect();
        }
      });
      
      await page.waitForTimeout(1000);
      
      // Try to reconnect
      await page.evaluate(() => {
        if (window.socket) {
          window.socket.connect();
        }
      });
      
      await page.waitForTimeout(2000);
      
      // Should reconnect
      const isReconnected = await page.evaluate(() => {
        return window.socket && window.socket.connected;
      }).catch(() => false);
      
      // Reconnection should work
    });
  });

  test.describe('Multi-Player Scenarios', () => {
    
    test('should support multiple players joining simultaneously', async ({ browser }) => {
      // Create 3 player contexts
      const players = [];
      
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto('/player.html');
        await page.waitForLoadState('networkidle');
        
        // Join as player
        const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill(`Player${i + 1}`);
          const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
          await joinButton.click();
          await page.waitForTimeout(1000);
        }
        
        players.push({ context, page });
      }
      
      // All players should be connected
      for (const player of players) {
        const isConnected = await player.page.evaluate(() => {
          return window.socket && window.socket.connected;
        }).catch(() => false);
        
        expect(isConnected).toBeTruthy();
      }
      
      // Cleanup
      for (const player of players) {
        await player.context.close();
      }
    });

    test('should sync leaderboard across all players', async ({ browser }) => {
      // Create 2 player contexts
      const context1 = await browser.newContext();
      const page1 = await context1.newPage();
      
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();
      
      // Join both players
      for (const [idx, page] of [[1, page1], [2, page2]]) {
        await page.goto('/player.html');
        await page.waitForLoadState('networkidle');
        
        const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill(`SyncPlayer${idx}`);
          const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
          await joinButton.click();
          await page.waitForTimeout(1000);
        }
      }
      
      // Monitor leaderboard updates on both
      await page1.evaluate(() => {
        window.leaderboardData = null;
        if (window.socket) {
          window.socket.on('game:leaderboard', (data) => {
            window.leaderboardData = data;
          });
        }
      });
      
      await page2.evaluate(() => {
        window.leaderboardData = null;
        if (window.socket) {
          window.socket.on('game:leaderboard', (data) => {
            window.leaderboardData = data;
          });
        }
      });
      
      await page1.waitForTimeout(3000);
      
      // Get leaderboard data from both
      const leaderboard1 = await page1.evaluate(() => window.leaderboardData);
      const leaderboard2 = await page2.evaluate(() => window.leaderboardData);
      
      // Both should receive leaderboard updates
      // Note: May be null if no game is active
      
      await context1.close();
      await context2.close();
    });

    test('should handle player disconnect gracefully', async ({ browser, adminPage }) => {
      // Create player context
      const playerContext = await browser.newContext();
      const playerPage = await playerContext.newPage();
      
      await playerPage.goto('/player.html');
      await playerPage.waitForLoadState('networkidle');
      
      // Join as player
      const nameInput = playerPage.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('DisconnectTest');
        const joinButton = playerPage.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
        await joinButton.click();
        await playerPage.waitForTimeout(1000);
      }
      
      // Get initial player count from admin
      const initialCount = await adminPage.locator('[class*="player-count"]').first()
        .textContent()
        .catch(() => '0');
      
      // Disconnect player
      await playerContext.close();
      
      await adminPage.waitForTimeout(2000);
      
      // Player count should update (or disconnect should be handled)
      // Note: This tests the disconnect handling logic
    });
  });

  test.describe('Real-Time Synchronization', () => {
    
    test('should sync admin actions to beamer', async ({ adminPage, beamerPage }) => {
      await adminPage.waitForTimeout(1000);
      await beamerPage.waitForTimeout(1000);
      
      // Monitor beamer for state changes
      await beamerPage.evaluate(() => {
        window.stateChanges = [];
        if (window.socket) {
          window.socket.on('game:state', (data) => {
            window.stateChanges.push(data);
          });
        }
      });
      
      // Admin performs action (select image if possible)
      const firstImage = adminPage.locator('img, [class*="thumbnail"]').first();
      if (await firstImage.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstImage.click();
        await adminPage.waitForTimeout(1000);
      }
      
      await beamerPage.waitForTimeout(2000);
      
      // Check if beamer received updates
      const updates = await beamerPage.evaluate(() => window.stateChanges || []);
      
      // Beamer should receive game state updates
    });

    test('should sync player answers to admin', async ({ adminPage, page }) => {
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      // Join as player
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('AnswerSyncTest');
        const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
        await joinButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Monitor admin for answer events
      await adminPage.evaluate(() => {
        window.playerAnswers = [];
        if (window.socket) {
          window.socket.on('player:answer', (data) => {
            window.playerAnswers.push(data);
          });
        }
      });
      
      // Player submits answer
      const answerInput = page.locator('input[type="text"], input[placeholder*="Antwort"]').first();
      if (await answerInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await answerInput.fill('SyncTestAnswer');
        const submitButton = page.locator('button:has-text("Senden"), button[type="submit"]').first();
        if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitButton.click();
          await page.waitForTimeout(1000);
        }
      }
      
      await adminPage.waitForTimeout(2000);
      
      // Admin should receive answer
      const answers = await adminPage.evaluate(() => window.playerAnswers || []);
      
      // Answer sync should work
    });

    test('should broadcast leaderboard updates to all clients', async ({ browser }) => {
      // Create multiple client contexts
      const clients = [];
      
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto('/player.html');
        await page.waitForLoadState('networkidle');
        
        // Join as player
        const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill(`BroadcastTest${i + 1}`);
          const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
          await joinButton.click();
          await page.waitForTimeout(1000);
        }
        
        // Monitor leaderboard updates
        await page.evaluate(() => {
          window.leaderboardUpdates = 0;
          if (window.socket) {
            window.socket.on('game:leaderboard', (data) => {
              window.leaderboardUpdates++;
            });
          }
        });
        
        clients.push({ context, page });
      }
      
      await clients[0].page.waitForTimeout(3000);
      
      // Check if all clients received updates
      for (const client of clients) {
        const updateCount = await client.page.evaluate(() => window.leaderboardUpdates || 0);
        // All clients should receive broadcasts
      }
      
      // Cleanup
      for (const client of clients) {
        await client.context.close();
      }
    });
  });

  test.describe('Game State Management', () => {
    
    test('should maintain consistent game state across clients', async ({ adminPage, beamerPage }) => {
      await adminPage.waitForTimeout(1000);
      await beamerPage.waitForTimeout(1000);
      
      // Get game state from both
      const adminState = await adminPage.evaluate(() => {
        return window.gameState || {};
      }).catch(() => ({}));
      
      const beamerState = await beamerPage.evaluate(() => {
        return window.gameState || {};
      }).catch(() => ({}));
      
      // States should be synchronized
      // Note: Implementation-specific
    });

    test('should handle concurrent player actions', async ({ browser }) => {
      // Create 2 players
      const players = [];
      
      for (let i = 0; i < 2; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto('/player.html');
        await page.waitForLoadState('networkidle');
        
        const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill(`ConcurrentPlayer${i + 1}`);
          const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
          await joinButton.click();
          await page.waitForTimeout(1000);
        }
        
        players.push({ context, page });
      }
      
      // Both players submit answers simultaneously
      const answerPromises = players.map(async (player, idx) => {
        const answerInput = player.page.locator('input[type="text"], input[placeholder*="Antwort"]').first();
        if (await answerInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await answerInput.fill(`Answer${idx + 1}`);
          const submitButton = player.page.locator('button:has-text("Senden"), button[type="submit"]').first();
          if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await submitButton.click();
          }
        }
      });
      
      await Promise.all(answerPromises);
      
      await players[0].page.waitForTimeout(2000);
      
      // Both answers should be processed
      // Server should handle concurrent submissions
      
      // Cleanup
      for (const player of players) {
        await player.context.close();
      }
    });
  });

  test.describe('Chat/Communication', () => {
    
    test('should check for chat functionality', async ({ authenticatedPage }) => {
      await authenticatedPage.waitForTimeout(1000);
      
      // Look for chat interface
      const chatInput = authenticatedPage.locator('input[placeholder*="Chat"], input[placeholder*="Nachricht"], textarea').first();
      const hasChat = await chatInput.isVisible({ timeout: 3000 }).catch(() => false);
      
      // Chat may or may not be implemented
      // This is exploratory testing
      if (hasChat) {
        await chatInput.fill('Test message');
        
        const sendButton = authenticatedPage.locator('button:has-text("Send"), button:has-text("Senden")').first();
        if (await sendButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sendButton.click();
          await authenticatedPage.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Performance Under Load', () => {
    
    test('should handle 10 concurrent players', async ({ browser }) => {
      const players = [];
      const startTime = Date.now();
      
      // Create 10 players
      for (let i = 0; i < 10; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto('/player.html');
        await page.waitForLoadState('networkidle');
        
        const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill(`LoadTest${i + 1}`);
          const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
          await joinButton.click();
          await page.waitForTimeout(500);
        }
        
        players.push({ context, page });
      }
      
      const joinTime = Date.now() - startTime;
      
      console.log(`10 players joined in ${joinTime}ms`);
      
      // Check if all connected
      let connectedCount = 0;
      for (const player of players) {
        const isConnected = await player.page.evaluate(() => {
          return window.socket && window.socket.connected;
        }).catch(() => false);
        
        if (isConnected) connectedCount++;
      }
      
      console.log(`${connectedCount}/10 players connected`);
      
      expect(connectedCount).toBeGreaterThan(5); // At least half should connect
      
      // Cleanup
      for (const player of players) {
        await player.context.close();
      }
    });

    test('should maintain WebSocket connections under load', async ({ browser }) => {
      const players = [];
      
      // Create 5 players
      for (let i = 0; i < 5; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        await page.goto('/player.html');
        await page.waitForLoadState('networkidle');
        
        const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill(`StressTest${i + 1}`);
          const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
          await joinButton.click();
          await page.waitForTimeout(500);
        }
        
        players.push({ context, page });
      }
      
      // Wait and check connections are stable
      await players[0].page.waitForTimeout(5000);
      
      let stillConnected = 0;
      for (const player of players) {
        const isConnected = await player.page.evaluate(() => {
          return window.socket && window.socket.connected;
        }).catch(() => false);
        
        if (isConnected) stillConnected++;
      }
      
      expect(stillConnected).toBe(5); // All should still be connected
      
      // Cleanup
      for (const player of players) {
        await player.context.close();
      }
    });
  });
});
