import { test, expect } from '@playwright/test';

test.describe('Kirim Karya Main Flow', () => {
  const testEmail = "test@example.com";
  const testPassword = "Password123!";

  test('should allow a studio to create a gallery and a client to select photos', async ({ page, context }) => {
    // 1. Studio Login
    await page.goto('/login');
    await page.fill('#email', testEmail);
    await page.fill('#password', testPassword);
    await page.click('button[type="submit"]');

    // Wait for dashboard redirect
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText('Studio Dashboard');

    // 2. Create Gallery
    await page.click('text=Create Gallery');
    await expect(page).toHaveURL(/.*dashboard\/galleries\/new/);
    
    const galleryTitle = `E2E Test Gallery ${Date.now()}`;
    await page.fill('#title', galleryTitle);
    await page.click('button[type="submit"]');

    // Wait for gallery detail page
    await expect(page).toHaveURL(/.*dashboard\/galleries\/.*/);
    await expect(page.locator('h1')).toContainText(galleryTitle);

    // 3. Upload Photo
    // Note: We need a real file to upload. We created test-image.jpg in the previous step.
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('text=Click or drop photos here');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('tests/test-image.jpg');

    await page.click('text=Start Upload');
    
    // Wait for upload to complete (Refresh Status logic in app)
    // We expect the photo to appear in the list with status READY
    await expect(page.locator('text=Managed Photos')).toBeVisible();
    
    // Wait for worker to process (might take a few seconds)
    await page.waitForTimeout(5000); 
    await page.click('text=Refresh Status');
    
    // Check if photo is ready
    await expect(page.locator('img[alt="test-image.jpg"]')).toBeVisible();

    // 4. Get Public Link
    const galleryUrl = page.url().replace('/dashboard/galleries/', '/g/');
    
    // 5. Client View (New Context to simulate different user/browser)
    const clientPage = await context.newPage();
    await clientPage.goto(galleryUrl);
    
    await expect(clientPage.locator('h2')).toContainText(galleryTitle);
    
    // 6. Action: Select and Comment
    // Select the first photo
    const firstPhoto = clientPage.locator('img[alt="Gallery preview"]').first();
    await firstPhoto.hover();
    await clientPage.click('button[aria-label="Select photo"]');
    
    // Verify shortlisted count updated
    await expect(clientPage.locator('text=1 SHORTLISTED')).toBeVisible();
    
    // Open Lightbox to add comment
    await firstPhoto.click();
    await expect(clientPage.locator('button[aria-label="Close Lightbox"]')).toBeVisible();
    
    const comment = "This is a great shot! Please retouch the skin.";
    await clientPage.fill('textarea[placeholder*="Add a special instruction"]', comment);
    
    // Wait for debounce save (500ms in app)
    await clientPage.waitForTimeout(1000);
    
    // Close Lightbox
    await clientPage.click('button[aria-label="Close Lightbox"]');
    
    // 7. Finalize (Submit Selection)
    await clientPage.click('text=Send Selection');
    // Assuming there's a confirmation or success state (need to check if implemented)
    // For now, we just triggered it.

    // 8. Verify back in Studio Dashboard
    await page.reload();
    await expect(page.getByText('SELECTED')).toContainText('1');
  });
});
