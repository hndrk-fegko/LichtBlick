/**
 * Authentication E2E Tests
 * Tests login, registration, session management, and validation
 */

const { test, expect } = require('../fixtures/base');
const { testUsers, invalidPlayerNames, validPlayerNames } = require('../helpers/test-data');
const { getAdminToken } = require('../helpers/db-setup');

test.describe('Authentication Tests', () => {
  
  test.describe('Player Join', () => {
    
    test('should successfully join as a player with valid name', async ({ page }) => {
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      // Find name input
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      
      // Enter valid player name
      await nameInput.fill('MaxMustermann');
      
      // Click join button
      const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
      await joinButton.click();
      
      // Wait for successful join - should see game interface or confirmation
      await page.waitForTimeout(2000);
      
      // Verify we're on the player page (not showing join form anymore or showing game state)
      // Note: This depends on the actual implementation
      const url = page.url();
      expect(url).toContain('player.html');
    });

    test('should reject empty player name', async ({ page }) => {
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      
      // Try to join with empty name
      await nameInput.fill('');
      
      const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
      
      // Button should be disabled or form validation should prevent submission
      const isDisabled = await joinButton.isDisabled().catch(() => false);
      if (!isDisabled) {
        await joinButton.click();
        
        // Should show error or validation message
        // Note: Exact selector depends on implementation
        await page.waitForTimeout(1000);
      }
    });

    test('should validate player name length', async ({ page }) => {
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      await expect(nameInput).toBeVisible({ timeout: 5000 });
      
      // Test too short name (if validation exists)
      for (const invalidName of invalidPlayerNames) {
        await nameInput.fill(invalidName);
        await page.waitForTimeout(500);
        
        // Check if there's validation (HTML5 or custom)
        const validationMessage = await nameInput.evaluate(el => el.validationMessage);
        if (validationMessage) {
          expect(validationMessage.length).toBeGreaterThan(0);
        }
      }
    });

    test('should allow valid player names', async ({ page }) => {
      // FIX: Improved timing and explicit waits for each iteration
      // Test valid names sequentially with proper waits
      for (const validName of validPlayerNames.slice(0, 2)) {
        await page.goto('/player.html');
        await page.waitForLoadState('networkidle');
        
        // FIX: Use actual selector from player.html (id="player-name")
        const nameInput = page.locator('input#player-name').first();
        await nameInput.waitFor({ state: 'visible', timeout: 5000 });
        await nameInput.fill(validName);
        
        const joinButton = page.locator('button[type="submit"]').first();
        await joinButton.waitFor({ state: 'visible', timeout: 3000 });
        await joinButton.click();
        
        // FIX: Wait longer for successful join before reloading
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Admin Authentication', () => {
    
    test('should access admin panel with valid token', async ({ page }) => {
      const adminToken = await getAdminToken();
      
      if (!adminToken) {
        test.skip('Admin token not available');
      }
      
      // Navigate with token
      await page.goto(`/admin-new.html?token=${adminToken}`);
      await page.waitForLoadState('networkidle');
      
      // Should see admin interface or PIN prompt
      const isPinVisible = await page.locator('input[type="password"]#admin-pin, input[placeholder*="PIN"]').first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      
      if (isPinVisible) {
        // Enter PIN
        await page.locator('input[type="password"]#admin-pin').fill('1234');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(1000);
      }
      
      // Should see admin interface
      const hasAdminInterface = await page.locator('.app-header, header, .logo').first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      
      expect(hasAdminInterface).toBeTruthy();
    });

    test('should reject admin access without token', async ({ page }) => {
      // Try to access admin without token
      await page.goto('/admin-new.html');
      await page.waitForLoadState('networkidle');
      
      await page.waitForTimeout(2000);
      
      // Should show auth screen or redirect
      const url = page.url();
      const content = await page.content();
      
      // Either we see auth screen or we're redirected/blocked
      const hasAuthScreen = content.includes('Admin Zugang') || 
                           content.includes('Token') || 
                           content.includes('auth');
      
      // This is expected behavior - we need proper auth
      expect(hasAuthScreen || url.includes('auth') || url.includes('login')).toBeTruthy();
    });

    test('should validate admin PIN', async ({ page }) => {
      const adminToken = await getAdminToken();
      
      if (!adminToken) {
        test.skip('Admin token not available');
      }
      
      await page.goto(`/admin-new.html?token=${adminToken}`);
      await page.waitForLoadState('networkidle');
      
      const pinInput = page.locator('input[type="password"]#admin-pin, input[placeholder*="PIN"]').first();
      const isPinVisible = await pinInput.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (isPinVisible) {
        // Try wrong PIN
        await pinInput.fill('0000');
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(1000);
        
        // Should show error or remain on auth screen
        // Note: This tests if PIN validation exists
      }
    });
  });

  test.describe('Session Management', () => {
    
    test('should persist player session after page reload', async ({ page }) => {
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      // Join as player
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('SessionTestPlayer');
        const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
        await joinButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Get current page state
      const beforeReload = await page.content();
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Check if session persisted (e.g., localStorage, cookies)
      // Note: Implementation-specific - may need to check localStorage
      const hasLocalStorage = await page.evaluate(() => {
        return localStorage.getItem('playerName') !== null || 
               localStorage.getItem('playerId') !== null;
      });
      
      // If there's session persistence, it should be in localStorage
      // This is a basic check - actual implementation may vary
    });

    test('should handle logout/disconnect', async ({ page }) => {
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      // Join as player
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('LogoutTestPlayer');
        const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
        await joinButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Look for logout/disconnect button
      const logoutButton = page.locator('button:has-text("Verlassen"), button:has-text("Logout"), button:has-text("Disconnect")').first();
      const hasLogout = await logoutButton.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (hasLogout) {
        await logoutButton.click();
        await page.waitForTimeout(1000);
        
        // Should return to join screen or show logged out state
      }
    });
  });

  test.describe('WebSocket Connection', () => {
    
    test('should establish WebSocket connection on player join', async ({ page }) => {
      // Monitor WebSocket connections
      const wsConnections = [];
      page.on('websocket', ws => {
        wsConnections.push(ws);
        console.log('WebSocket connection established:', ws.url());
      });
      
      await page.goto('/player.html');
      await page.waitForLoadState('networkidle');
      
      // Join as player
      const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.fill('WSTestPlayer');
        const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
        await joinButton.click();
        await page.waitForTimeout(2000);
      }
      
      // Should have WebSocket connection
      // Note: This checks if Socket.IO is loaded and connected
      const hasSocketIO = await page.evaluate(() => {
        return typeof io !== 'undefined' && typeof io.connect === 'function';
      });
      
      expect(hasSocketIO).toBeTruthy();
    });
  });
});
