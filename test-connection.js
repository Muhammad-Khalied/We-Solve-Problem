const mongoose = require('mongoose');

const uri1 = "mongodb://muhammad:123456Mm@ac-shgp1ej-shard-00-00.5s6iucq.mongodb.net:27017,ac-shgp1ej-shard-00-01.5s6iucq.mongodb.net:27017,ac-shgp1ej-shard-00-02.5s6iucq.mongodb.net:27017/?tls=true&authSource=admin&replicaSet=atlas-bqj5n4-shard-0&appName=Cluster0";
const uri2 = "mongodb+srv://muhammad:123456Mm@cluster0.5s6iucq.mongodb.net/?appName=Cluster0";

async function testConnection(label, uri, options = {}) {
  console.log(`\n--- Testing: ${label} ---`);
  
  const conn = mongoose.createConnection();
  try {
    await conn.openUri(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      ...options
    });
    console.log('✅ SUCCESS! Connected to:', conn.host);
    await conn.close();
  } catch (err) {
    console.log('❌ FAILED:', err.message);
    if (err.reason) {
      const servers = err.reason?.servers;
      if (servers) {
        for (const [addr, desc] of servers) {
          console.log(`   Server ${addr}: ${desc.error?.message || 'unknown error'}`);
        }
      }
    }
    try { await conn.close(); } catch {}
  }
}

(async () => {
  console.log('Node.js version:', process.version);
  console.log('Mongoose version:', mongoose.version);
  
  await testConnection('Direct', uri1);
  await testConnection('SRV', uri2);

  process.exit(0);
})();
