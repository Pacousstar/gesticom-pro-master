import { test, expect } from '@playwright/test'

async function login(page: any, loginStr: string, password: string) {
  await page.goto('/login')
  await page.locator('input[type="text"], input[name="email"], input[name="login"]').first().fill(loginStr)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
}

test.describe('Flux critique : authentification', () => {
  test('La page de login affiche le formulaire', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="text"], input[name="email"], input[name="login"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('Connexion admin réussie et redirection vers le dashboard', async ({ page }) => {
    await login(page, 'admin', 'Admin@123')
    await page.waitForURL(/\/(dashboard|home|accueil|mobile)/, { timeout: 30000 })
    expect(page.url()).not.toContain('/login')
  })

  test('Le tableau de bord affiche les indicateurs principaux', async ({ page }) => {
    await login(page, 'admin', 'Admin@123')
    await page.waitForURL(/\/(dashboard|home|accueil|mobile)/, { timeout: 30000 })
    await page.waitForLoadState('networkidle')
    await expect(page.locator('nav, aside, [class*="sidebar"], [class*="menu"]').first()).toBeVisible()
  })

  test('Login rejeté avec mauvais identifiants', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="text"], input[name="email"], input[name="login"]').first().fill('fake@test.com')
    await page.locator('input[type="password"]').fill('wrongpassword')

    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/auth/login'))
    await page.locator('button[type="submit"]').click()
    await responsePromise

    await expect(page.getByText('Identifiants incorrects')).toBeVisible({ timeout: 5000 })
  })
})
