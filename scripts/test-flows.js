const http = require('http')

let sessionCookie = ''

function request(method, path, body, callback) {
  const opts = {
    hostname: 'localhost',
    port: 3001,
    method: method,
    path: path,
    headers: {
      'Content-Type': 'application/json'
    }
  }
  
  if (sessionCookie) {
    opts.headers['Cookie'] = sessionCookie
  }
  
  const req = http.request(opts, (res) => {
    let data = ''
    res.on('data', (c) => data += c)
    res.on('end', () => {
      // Capture cookie
      const setCookie = res.headers['set-cookie']
      if (setCookie && !sessionCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie
        sessionCookie = cookieStr.split(';')[0]
      }
      try {
        const json = JSON.parse(data)
        callback(null, res.statusCode, json)
      } catch (e) {
        callback(null, res.statusCode, data)
      }
    })
  })
  
  if (body) {
    req.write(JSON.stringify(body))
  }
  req.end()
}

console.log('='.repeat(50))
console.log('🧪 TEST DES FLUX CRITIQUES')
console.log('='.repeat(50))

// 1. Login
request('POST', '/api/auth/login', { login: 'admin', motDePasse: 'Admin@123' }, (err, status, data) => {
  console.log(`\n1. LOGIN: ${status} ${status === 200 ? '✅' : '❌'}`)
  if (status === 200) console.log('   → Connexion réussie')
  
  // 2. Clients GET
  request('GET', '/api/clients', null, (err, status, data) => {
    console.log(`\n2. CLIENTS GET: ${status} ${status === 200 ? '✅' : '❌'}`)
    console.log(`   → ${data.length || 0} clients`)
    
    // 3. Clients POST
    request('POST', '/api/clients', { nom: 'Test Client ' + Date.now(), type: 'CASH' }, (err, status, data) => {
      console.log(`\n3. CLIENTS POST: ${status} ${status === 200 || status === 201 ? '✅' : '❌'}`)
      if (status !== 200 && status !== 201) console.log('   →', data.error)
      
      // 4. Fournisseurs GET
      request('GET', '/api/fournisseurs', null, (err, status, data) => {
        console.log(`\n4. FOURNISSEURS GET: ${status} ${status === 200 ? '✅' : '❌'}`)
        console.log(`   → ${data.length || 0} fournisseurs`)
        
        // 5. Fournisseurs POST
        request('POST', '/api/fournisseurs', { nom: 'Test Fournisseur ' + Date.now() }, (err, status, data) => {
          console.log(`\n5. FOURNISSEURS POST: ${status} ${status === 200 || status === 201 ? '✅' : '❌'}`)
          if (status !== 200 && status !== 201) console.log('   →', data.error)
          
          // 6. Produits GET
          request('GET', '/api/produits', null, (err, status, data) => {
            console.log(`\n6. PRODUITS GET: ${status} ${status === 200 ? '✅' : '❌'}`)
            console.log(`   → ${data.length || 0} produits`)
            
            // 7. Achats GET
            request('GET', '/api/achats', null, (err, status, data) => {
              console.log(`\n7. ACHATS GET: ${status} ${status === 200 ? '✅' : '❌'}`)
              console.log(`   → ${data.length || 0} achats`)
              
              // 8. Ventes GET
              request('GET', '/api/ventes', null, (err, status, data) => {
                console.log(`\n8. VENTES GET: ${status} ${status === 200 ? '✅' : '❌'}`)
                console.log(`   → ${data.length || 0} ventes`)
                
                // 9. Stock GET
                request('GET', '/api/stock', null, (err, status, data) => {
                  console.log(`\n9. STOCK GET: ${status} ${status === 200 ? '✅' : '❌'}`)
                  console.log(`   → ${data.length || 0} lignes de stock`)
                  
                  // 10. Test authorization - Try to access another entity's data
                  request('GET', '/api/clients/99999', null, (err, status, data) => {
                    console.log(`\n10. AUTH TEST (client inexistant): ${status} ${status === 404 ? '✅' : '⚠️'}`)
                    console.log('   → Réponse:', data.error || 'OK')
                    
                    console.log('\n' + '='.repeat(50))
                    console.log('🏁 TESTS TERMINÉS')
                    console.log('='.repeat(50))
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})