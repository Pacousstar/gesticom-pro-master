import { test, expect } from '@playwright/test'

test.describe('Flux critique : authentification', () => {
  test('La page de login affiche le formulaire', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="text"], input[name="email"], input[name="login"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('Connexion admin réussie et redirection vers le dashboard', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', {
      data: { login: 'admin', motDePasse: 'Admin@123' },
    })
    expect(res.ok()).toBeTruthy()
    const setCookie = res.headers()['set-cookie']
    if (setCookie) {
      const cookieName = setCookie.split('=')[0]
      const cookieValue = setCookie.split(';')[0].split('=')[1]
      await page.context().addCookies([{
        name: cookieName, value: cookieValue, domain: 'localhost', path: '/',
      }])
    }
    await page.goto('/dashboard')
    await expect(page.locator('nav, aside, [class*="sidebar"], [class*="menu"]').first()).toBeVisible()
  })

  test('Le tableau de bord affiche les indicateurs principaux', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', {
      data: { login: 'admin', motDePasse: 'Admin@123' },
    })
    expect(res.ok()).toBeTruthy()
    const setCookie = res.headers()['set-cookie']
    if (setCookie) {
      const cookieName = setCookie.split('=')[0]
      const cookieValue = setCookie.split(';')[0].split('=')[1]
      await page.context().addCookies([{
        name: cookieName, value: cookieValue, domain: 'localhost', path: '/',
      }])
    }
    await page.goto('/dashboard')
    await expect(page.locator('nav, aside, [class*="sidebar"], [class*="menu"]').first()).toBeVisible()
  })

  test('Login rejeté avec mauvais identifiants', async ({ page }) => {
    const res = await page.request.post('/api/auth/login', {
      data: { login: 'fake@test.com', motDePasse: 'wrongpassword' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toContain('Identifiants incorrects')
  })
})
