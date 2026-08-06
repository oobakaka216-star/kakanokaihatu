const { test, expect } = require('@playwright/test');

test.describe('配信海外視聴者マップ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ページが正常に読み込まれる', async ({ page }) => {
    await expect(page).toHaveTitle(/配信 海外視聴者マップ/);
    await expect(page.locator('h1')).toContainText('配信 海外視聴者マップ');
  });

  test('地図が表示される', async ({ page }) => {
    await expect(page.locator('#map')).toBeVisible();
  });

  test('サイドバーが表示される', async ({ page }) => {
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('.panel-header').first()).toContainText('コメントFeed');
  });

  test('フッターの入力欄が表示される', async ({ page }) => {
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#country')).toBeVisible();
    await expect(page.locator('#save')).toBeVisible();
    await expect(page.locator('#clear')).toBeVisible();
  });

  test('視聴者を追加できる', async ({ page }) => {
    await page.fill('#name', 'テストユーザー');
    await page.fill('#country', '日本');
    await page.click('#map');
    await page.click('#save');

    await expect(page.locator('#viewer-list')).toContainText('テストユーザー', { timeout: 10000 });
  });

  test('全削除ボタンが機能する', async ({ page }) => {
    await page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.click('#clear');
    await expect(page.locator('#viewer-list')).toContainText('視聴者がいません。', { timeout: 10000 });
  });
});
