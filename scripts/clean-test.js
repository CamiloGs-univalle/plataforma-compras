const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('../serviceAccountKey.json');
if(!getApps().length) initializeApp({credential: cert(sa)});
const db = getFirestore();
const ids = ["zJaOnxSiOAA4DMcyQlgn","CwFrjykCJrL6gjVeXxI4","ero2lyGh6LKNpCRH4OfB","pnG51MHPKTWYEM7QR4Gj","IKGOOV4AxlFhsT0OhuLG","fFHMf5IMYo2EIPkVuzwX","bMUOLSfKQ5bnTYyZqXnl","Gn3LGw8gpd49itpjtH8G","646SLWv3r2Wxd8r135hk","iVLa0rQQiWabDFeAa4JO"];
(async()=>{
  let ok=0, fail=0;
  for(const id of ids){
    try{
      const ref = db.collection('solicitudes').doc(id);
      const snap = await ref.get();
      if(!snap.exists){ console.log(` - ${id} no existe`); continue; }
      // borrar subcolecciones notas
      const notas = await ref.collection('notas').get();
      for(const d of notas.docs) await d.ref.delete();
      await ref.delete();
      console.log(` ✓ borrada #${snap.data().numero} ${id}`);
      ok++;
    }catch(e){ console.log(` x ${id} error`,e.message); fail++; }
  }
  // también borrar cualquier solicitud con numero >=16 que sea de prueba (por si quedaron otras)
  const q = await db.collection('solicitudes').where('numero','>=',16).get();
  for(const d of q.docs){
    if(ids.includes(d.id)) continue;
    const data=d.data();
    // solo si parece prueba (email @siamo.com con demo o test)
    if(String(data.observaciones||'').includes('prueba automatizada')){
      const notas = await d.ref.collection('notas').get();
      for(const n of notas.docs) await n.ref.delete();
      await d.ref.delete();
      console.log(` ✓ extra borrada #${data.numero} ${d.id}`);
      ok++;
    }
  }
  console.log(`\nListo: ${ok} borradas, ${fail} fallos`);
  process.exit(0);
})();
