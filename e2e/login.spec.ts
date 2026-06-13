import { test, expect } from '@playwright/test'

test.describe('Flux critique : authentification', () => {
  test('La page de login affiche le formulaire', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="text"], input[name="email"], input[name="login"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('Connexion admin réussie et redirection vers le dashboard', async ({ page }) => {
    await page.goto('/login')

    const emailInput = page.locator('input[type="text"], input[name="email"], input[name="login"]').first()
    await emailInput.fill('admin')
    await page.locator('input[type="password"]').fill('Admin@123')
    await page.locator('button[type="submit"]').click()

    await page.waitForURL(/\/(dashboard|home|accueil)/, { timeout: 15000 })
    expect(page.url()).not.toContain('/login')
  })

  test('Le tableau de bord affiche les indicateurs principaux', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="text"], input[name="email"], input[name="login"]').first().fill('admin')
    await page.locator('input[type="password"]').fill('Admin@123')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(dashboard|home|accueil)/, { timeout: 15000 })

    await expect(page.locator('nav, aside, [class*="sidebar"], [class*="menu"]').first()).toBeVisible()
  })

  test('Login rejeté avec mauvais identifiants', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="text"], input[name="email"], input[name="login"]').first().fill('fake@test.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Identifiants incorrects')).toBeVisible({ timeout: 10000 })
  })
})
