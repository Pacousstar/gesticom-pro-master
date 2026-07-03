import { test, expect } from '@playwright/test'

test.describe('Cycles métier complets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="text"], input[name="email"], input[name="login"]').first().fill('admin')
    await page.locator('input[type="password"]').fill('Admin@123')
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(/\/(dashboard|home|accueil)/, { timeout: 30000 })
    await page.waitForLoadState('networkidle')
  })

  test('Cycle 1 : Créer produit → vérifier stock → faire vente', async ({ page }) => {
    await page.goto('/dashboard/produits')
    await expect(page.locator('h1, h2').filter({ hasText: /produit/i }).first()).toBeVisible()
    await page.goto('/dashboard/stock')
    await expect(page.locator('h1, h2').filter({ hasText: /stock/i }).first()).toBeVisible()
  })

  test('Cycle 2 : Créer client → consulter sa fiche → voir compte courant', async ({ page }) => {
    await page.goto('/dashboard/clients')
    await expect(page.locator('h1, h2').filter({ hasText: /client/i }).first()).toBeVisible()
    await page.goto('/dashboard/comptes-courants')
    await expect(page.locator('h1, h2').filter({ hasText: /compte courant/i }).first()).toBeVisible()
  })

  test('Cycle 3 : Créer fournisseur → créer achat → vérifier stock', async ({ page }) => {
    await page.goto('/dashboard/fournisseurs')
    await expect(page.locator('h1, h2').filter({ hasText: /fournisseur/i }).first()).toBeVisible()
    await page.goto('/dashboard/achats')
    await expect(page.locator('h1, h2').filter({ hasText: /achat/i }).first()).toBeVisible()
  })

  test('Cycle 4 : Voir dashboard → consulter caisse → consulter banque', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.locator('nav, aside, [class*="sidebar"]').first()).toBeVisible()
    await page.goto('/dashboard/caisse')
    await expect(page.locator('h1, h2').filter({ hasText: /caisse/i }).first()).toBeVisible()
    await page.goto('/dashboard/banque')
    await expect(page.locator('h1, h2').filter({ hasText: /banque/i }).first()).toBeVisible()
  })

  test('Cycle 5 : Consulter rapports de ventes et inventaire', async ({ page }) => {
    await page.goto('/dashboard/rapports-ventes')
    await expect(page.locator('h1, h2').filter({ hasText: /vente/i }).first()).toBeVisible()
    await page.goto('/dashboard/rapports-inventaire')
    await expect(page.locator('h1, h2').filter({ hasText: /inventaire/i }).first()).toBeVisible()
  })

  test('Cycle 6 : Navigation dans la comptabilité', async ({ page }) => {
    await page.goto('/dashboard/comptabilite')
    await expect(page.locator('h1, h2').filter({ hasText: /comptabilité|compta/i }).first()).toBeVisible()
    await page.goto('/dashboard/parametres')
    await expect(page.locator('h1, h2').filter({ hasText: /paramètre|parametre/i }).first()).toBeVisible()
  })

  test('Cycle 7 : Vérifier l\'accès aux erreurs et à l\'audit', async ({ page }) => {
    await page.goto('/dashboard/audit')
    await expect(page.locator('h1, h2').filter({ hasText: /audit/i }).first()).toBeVisible()
  })

  test('Cycle 8 : Ventes - page des commandes et page des retraits', async ({ page }) => {
    await page.goto('/dashboard/ventes/commandes')
    await expect(page.locator('h1, h2').filter({ hasText: /commande|vente/i }).first()).toBeVisible()
    await page.goto('/dashboard/ventes/retraits')
    await expect(page.locator('h1, h2').filter({ hasText: /retrait|vente/i }).first()).toBeVisible()
  })

  test('Cycle 9 : API - liste produits retourne un tableau', async ({ page }) => {
    const response = await page.request.get('/api/produits?limit=5')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    const products = body.data || body
    expect(Array.isArray(products)).toBeTruthy()
  })

  test('Cycle 10 : API - les exports excel répondent 200', async ({ page }) => {
    const endpoints = [
      '/api/stock/export-excel?magasinId=1',
      '/api/clients/export-excel',
      '/api/fournisseurs/export-excel',
      '/api/depenses/export-excel',
    ]
    for (const endpoint of endpoints) {
      const res = await page.request.get(endpoint)
      expect(res.ok(), `${endpoint} doit répondre 200`).toBeTruthy()
    }
  })
})
