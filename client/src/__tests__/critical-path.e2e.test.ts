import { test, expect } from '@playwright/test';

test.describe('Critical User Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    
    // Login as admin
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard');
  });

  test('Admin can create and delete a client', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('http://localhost:5173/admin');
    
    // Go to clients tab
    await page.click('text=Client Management');
    
    // Click add client
    await page.click('button:has-text("Add Client")');
    
    // Fill form
    await page.fill('input[name="name"]', 'E2E Test Client');
    await page.fill('input[name="website"]', 'https://e2e-test.com');
    await page.selectOption('select[name="businessSize"]', 'Medium');
    await page.selectOption('select[name="industryVertical"]', 'Technology');
    
    // Submit
    await page.click('button:has-text("Create Client")');
    
    // Verify client appears
    await expect(page.locator('text=E2E Test Client')).toBeVisible();
    
    // Delete the client
    const row = page.locator('tr', { has: page.locator('text=E2E Test Client') });
    await row.locator('button[aria-label="Delete"]').click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete Client")');
    
    // Verify client is gone
    await expect(page.locator('text=E2E Test Client')).not.toBeVisible();
  });

  test('Portfolio company triggers SEMrush integration', async ({ page }) => {
    await page.goto('http://localhost:5173/admin?tab=cd-clients');
    
    // Add portfolio company
    await page.click('button:has-text("Add Company")');
    
    // Fill form
    await page.fill('input[name="name"]', 'E2E Portfolio Company');
    await page.fill('input[name="websiteUrl"]', 'https://portfolio-test.com');
    await page.selectOption('select[name="businessSize"]', 'Large');
    await page.selectOption('select[name="industryVertical"]', 'SaaS');
    
    // Submit
    await page.click('button:has-text("Add Company")');
    
    // Verify toast notification appears
    await expect(page.locator('text=Company added - data syncing')).toBeVisible();
  });
});