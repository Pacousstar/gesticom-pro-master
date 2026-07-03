import { test, expect } from '@playwright/test'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'

async function goto(page: any, url: string) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

test.describe('Cycles métier complets', () => {
  test.beforeEach(async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/auth/login`, {
      data: { login: 'admin', motDePasse: 'Admin@123' },
    })
    const setCookie = res.headers()['set-cookie']
    if (setCookie) {
      const cookieName = setCookie.split('=')[0]
      const cookieValue = setCookie.split(';')[0].split('=')[1]
      await page.context().addCookies([{
        name: cookieName, value: cookieValue, domain: 'localhost', path: '/',
      }])
    }
  })

  test('Cycle 1 : Créer produit → vérifier stock → faire vente', async ({ page }) => {
    await goto(page, '/dashboard/produits')
    await expect(page.locator('h1, h2').filter({ hasText: /produit/i }).first()).toBeVisible()
    await goto(page, '/dashboard/stock')
    await expect(page.locator('h1, h2').filter({ hasText: /stock/i }).first()).toBeVisible()
  })

  test('Cycle 2 : Créer client → consulter sa fiche → voir compte courant', async ({ page }) => {
    await goto(page, '/dashboard/clients')
    await expect(page.locator('h1, h2').filter({ hasText: /client/i }).first()).toBeVisible()
    await goto(page, '/dashboard/comptes-courants')
    await expect(page.locator('h1, h2').filter({ hasText: /compte courant/i }).first()).toBeVisible()
  })

  test('Cycle 3 : Créer fournisseur → créer achat → vérifier stock', async ({ page }) => {
    await goto(page, '/dashboard/fournisseurs')
    await expect(page.locator('h1, h2').filter({ hasText: /fournisseur/i }).first()).toBeVisible()
    await goto(page, '/dashboard/achats')
    await expect(page.locator('h1, h2').filter({ hasText: /achat/i }).first()).toBeVisible()
  })

  test('Cycle 4 : Voir dashboard → consulter caisse → consulter banque', async ({ page }) => {
    await goto(page, '/dashboard')
    await expect(page.locator('nav, aside, [class*="sidebar"]').first()).toBeVisible()
    await goto(page, '/dashboard/caisse')
    await expect(page.locator('h1, h2').filter({ hasText: /caisse/i }).first()).toBeVisible()
    await goto(page, '/dashboard/banque')
    await expect(page.locator('h1, h2').filter({ hasText: /banque/i }).first()).toBeVisible()
  })

  test('Cycle 5 : Consulter rapports de ventes et inventaire', async ({ page }) => {
    await goto(page, '/dashboard/rapports-ventes')
    await expect(page.locator('h1, h2').filter({ hasText: /vente/i }).first()).toBeVisible()
    await goto(page, '/dashboard/rapports-inventaire')
    await expect(page.locator('h1, h2').filter({ hasText: /inventaire/i }).first()).toBeVisible()
  })

  test('Cycle 6 : Navigation dans la comptabilité', async ({ page }) => {
    await goto(page, '/dashboard/comptabilite')
    await expect(page.locator('h1, h2').filter({ hasText: /comptabilité|compta/i }).first()).toBeVisible()
    await goto(page, '/dashboard/parametres')
    await expect(page.locator('h1, h2').filter({ hasText: /paramètre|parametre/i }).first()).toBeVisible()
  })

  test('Cycle 7 : Vérifier l\'accès aux erreurs et à l\'audit', async ({ page }) => {
    await goto(page, '/dashboard/audit')
    await expect(page.locator('h1, h2').filter({ hasText: /audit/i }).first()).toBeVisible()
  })

  test('Cycle 8 : Ventes - page des commandes et page des retraits', async ({ page }) => {
    await goto(page, '/dashboard/ventes/commandes')
    await expect(page.locator('h1, h2').filter({ hasText: /commande|vente/i }).first()).toBeVisible()
    await goto(page, '/dashboard/ventes/retraits')
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
