import { test, expect } from '@playwright/test';

test.describe('Kirim Karya Main Flow', () => {
  const testEmail = "test@example.com";
  const testPassword = "Password123!";

  test('should allow a studio to create a gallery and a client to select photos', async ({ page, context }) => {
    await page.goto('/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText('Studio Dashboard');

    await page.click('text=Create Gallery');
    await expect(page).toHaveURL(/.*dashboard\/galleries\/new/);

    const galleryTitle = `E2E Test Gallery ${Date.now()}`;
    await page.fill('#title', galleryTitle);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard\/galleries\/.*/);
    await expect(page.locator('h1')).toContainText(galleryTitle);
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Click or drop photos here');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('tests/test-image.jpg');

    await page.click('text=Start Upload');

    await expect(page.locator('text=Managed Photos')).toBeVisible();

    await page.waitForTimeout(5000);
    await page.click('text=Refresh Status');

    await expect(page.locator('img[alt="test-image.jpg"]')).toBeVisible();

    const galleryUrl = page.url().replace('/dashboard/galleries/', '/g/');

    const clientPage = await context.newPage();
    await clientPage.goto(galleryUrl);

    await expect(clientPage.locator('h2')).toContainText(galleryTitle);

    const firstPhoto = clientPage.locator('img[alt="Gallery preview"]').first();
    await firstPhoto.hover();
    await clientPage.click('button[aria-label="Select photo"]');

    await expect(clientPage.locator('text=1 SHORTLISTED')).toBeVisible();

    await firstPhoto.click();
    await expect(clientPage.locator('button[aria-label="Close Lightbox"]')).toBeVisible();

    const comment = "This is a great shot! Please retouch the skin.";
    await clientPage.fill('textarea[placeholder*="Add a special instruction"]', comment);

    await clientPage.waitForTimeout(1000);

    await clientPage.click('button[aria-label="Close Lightbox"]');

    await clientPage.click('text=Send Selection');
    await page.reload();
    await expect(page.getByText('SELECTED')).toContainText('1');
  });
});
