/**
 * Playwright Test Fixtures for LichtBlick
 * Provides authenticated contexts for tests
 */

const { test as base, expect } = require('@playwright/test');
const { getAdminToken } = require('../helpers/db-setup');

/**
 * Extended test with custom fixtures
 */
const test = base.extend({
  /**
   * Authenticated player page fixture
   * Automatically logs in as testplayer1 and navigates to player page
   */
  authenticatedPage: async ({ page }, use) => {
    // Navigate to player page
    await page.goto('/player.html');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Enter player name if not already joined
    const nameInput = page.locator('input[name="playerName"], input#playerName, input[placeholder*="Name"]').first();
    
    if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await nameInput.fill('TestPlayer1');
      
      // Find and click join button
      const joinButton = page.locator('button:has-text("Beitreten"), button:has-text("Join"), button[type="submit"]').first();
      await joinButton.click();
      
      // Wait for successful join
      await page.waitForTimeout(1000);
    }
    
    await use(page);
  },
  
  /**
   * Admin page fixture with authentication
   * Automatically authenticates with admin token and PIN
   */
  adminPage: async ({ page }, use) => {
    // Get admin token from database
    const adminToken = await getAdminToken();
    
    if (!adminToken) {
      throw new Error('Admin token not found. Make sure the server has started and initialized the database.');
    }
    
    // Navigate to admin page with token
    await page.goto(`/admin-new.html?token=${adminToken}`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if PIN authentication is required
    const pinInput = page.locator('input[type="password"]#admin-pin, input[placeholder*="PIN"]').first();
    
    if (await pinInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Enter admin PIN
      await pinInput.fill('1234');
      
      // Submit PIN form
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      
      // Wait for authentication
      await page.waitForTimeout(1000);
    }
    
    // Wait for admin interface to load
    await page.waitForSelector('.app-header, header', { timeout: 5000 }).catch(() => {
      console.warn('Admin header not found, continuing anyway...');
    });
    
    await use(page);
  },

  /**
   * Beamer page fixture
   * Navigates to beamer display page
   */
  beamerPage: async ({ page }, use) => {
    await page.goto('/beamer.html');
    await page.waitForLoadState('networkidle');
    
    // Wait for beamer to connect
    await page.waitForTimeout(1000);
    
    await use(page);
  },

  /**
   * Multiple player contexts fixture
   * Provides multiple browser contexts for multiplayer testing
   */
  multiplePlayerContexts: async ({ browser }, use) => {
    const contexts = [];
    const pages = [];
    
    // Create 3 player contexts
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      // Navigate to player page
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
      
      contexts.push(context);
      pages.push(page);
    }
    
    await use({ contexts, pages });
    
    // Cleanup
    for (const context of contexts) {
      await context.close();
    }
  }
});

module.exports = { test, expect };
