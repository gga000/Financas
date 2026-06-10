/* ── DB ── */
function openDB(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('financas_pwa_v2',5);
    r.onupgradeneeded=e=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains('tx')){
        const s=d.createObjectStore('tx',{keyPath:'id',autoIncrement:true});
        s.createIndex('ym','ym');
      }
      if(!d.objectStoreNames.contains('budget')){
        d.createObjectStore('budget',{keyPath:'id',autoIncrement:true});
      }
      if(!d.objectStoreNames.contains('budgetDone')){
        d.createObjectStore('budgetDone',{keyPath:'key'});
      }
      if(!d.objectStoreNames.contains('pessoas')){
        d.createObjectStore('pessoas',{keyPath:'id',autoIncrement:true});
      }
      if(!d.objectStoreNames.contains('cartoes')){
        d.createObjectStore('cartoes',{keyPath:'id',autoIncrement:true});
      }
      if(!d.objectStoreNames.contains('gastos')){
        const gs=d.createObjectStore('gastos',{keyPath:'id',autoIncrement:true});
        gs.createIndex('cartaoId','cartaoId');
      }
      if(!d.objectStoreNames.contains('recorrentes')){
        const rc=d.createObjectStore('recorrentes',{keyPath:'id',autoIncrement:true});
        rc.createIndex('cartaoId','cartaoId');
      }
    };
    r.onsuccess=e=>res(e.target.result);
    r.onerror=()=>rej(r.error);
  });
}

/* helpers de cache por store */
function _cacheRead(store){
  return _dbCache[store]?Promise.resolve(_dbCache[store]):null;
}
function _cacheWrite(store,data){
  _dbCache[store]=data;
  return data;
}

/* ── TX ── */
const dbAll=()=>{
  const hit=_cacheRead('tx');if(hit)return hit;
  return new Promise(res=>{const t=db.transaction('tx','readonly');t.objectStore('tx').getAll().onsuccess=e=>res(_cacheWrite('tx',e.target.result||[]))});
};
const dbAdd=item=>new Promise((res,rej)=>{invalidateCache('tx');const t=db.transaction('tx','readwrite');const r=t.objectStore('tx').add(item);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const dbPut=item=>new Promise((res,rej)=>{invalidateCache('tx');const t=db.transaction('tx','readwrite');const r=t.objectStore('tx').put(item);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const dbDel=id=>new Promise(res=>{invalidateCache('tx');const t=db.transaction('tx','readwrite');t.objectStore('tx').delete(id).onsuccess=()=>res()});
const dbClear=()=>new Promise(res=>{invalidateCache('tx');const t=db.transaction('tx','readwrite');t.objectStore('tx').clear().onsuccess=()=>res()});

/* ── BUDGET ── */
const budgetAll=()=>{
  const hit=_cacheRead('budget');if(hit)return hit;
  return new Promise(res=>{const t=db.transaction('budget','readonly');t.objectStore('budget').getAll().onsuccess=e=>res(_cacheWrite('budget',e.target.result||[]))});
};
const budgetAdd=item=>new Promise((res,rej)=>{invalidateCache('budget');const t=db.transaction('budget','readwrite');const r=t.objectStore('budget').add(item);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const budgetPut=item=>new Promise((res,rej)=>{invalidateCache('budget');const t=db.transaction('budget','readwrite');const r=t.objectStore('budget').put(item);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const budgetDel=id=>new Promise(res=>{invalidateCache('budget');const t=db.transaction('budget','readwrite');t.objectStore('budget').delete(id).onsuccess=()=>res()});

/* ── PESSOAS ── */
const pessoasAll=()=>{
  const hit=_cacheRead('pessoas');if(hit)return hit;
  return new Promise(res=>{const t=db.transaction('pessoas','readonly');t.objectStore('pessoas').getAll().onsuccess=e=>res(_cacheWrite('pessoas',e.target.result||[]))});
};
const pessoasAdd=item=>new Promise((res,rej)=>{invalidateCache('pessoas');const t=db.transaction('pessoas','readwrite');const r=t.objectStore('pessoas').add(item);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const pessoasPut=item=>new Promise((res,rej)=>{invalidateCache('pessoas');const t=db.transaction('pessoas','readwrite');const r=t.objectStore('pessoas').put(item);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const pessoasDel=id=>new Promise(res=>{invalidateCache('pessoas');const t=db.transaction('pessoas','readwrite');t.objectStore('pessoas').delete(id).onsuccess=()=>res()});

/* ── CARTÕES DB ── */
const cartoesAll=()=>{
  const hit=_cacheRead('cartoes');if(hit)return hit;
  return new Promise(res=>{const t=db.transaction('cartoes','readonly');t.objectStore('cartoes').getAll().onsuccess=e=>res(_cacheWrite('cartoes',e.target.result||[]))});
};
const cartoesAdd=item=>new Promise((res,rej)=>{invalidateCache('cartoes');const t=db.transaction('cartoes','readwrite');const r=t.objectStore('cartoes').add(item);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const cartoesPut=item=>new Promise((res,rej)=>{invalidateCache('cartoes');const t=db.transaction('cartoes','readwrite');const r=t.objectStore('cartoes').put(item);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const cartoesDel=id=>new Promise(res=>{invalidateCache('cartoes');const t=db.transaction('cartoes','readwrite');t.objectStore('cartoes').delete(id).onsuccess=()=>res()});

const gastosAll=()=>{
  const hit=_cacheRead('gastos');if(hit)return hit;
  return new Promise(res=>{const t=db.transaction('gastos','readonly');t.objectStore('gastos').getAll().onsuccess=e=>res(_cacheWrite('gastos',e.target.result||[]))});
};
const gastosAdd=item=>new Promise((res,rej)=>{invalidateCache('gastos');const t=db.transaction('gastos','readwrite');const r=t.objectStore('gastos').add(item);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const gastosPut=item=>new Promise((res,rej)=>{invalidateCache('gastos');const t=db.transaction('gastos','readwrite');const r=t.objectStore('gastos').put(item);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const gastosDel=id=>new Promise(res=>{invalidateCache('gastos');const t=db.transaction('gastos','readwrite');t.objectStore('gastos').delete(id).onsuccess=()=>res()});

const recorrentesAll=()=>{
  const hit=_cacheRead('recorrentes');if(hit)return hit;
  return new Promise(res=>{const t=db.transaction('recorrentes','readonly');t.objectStore('recorrentes').getAll().onsuccess=e=>res(_cacheWrite('recorrentes',e.target.result||[]))});
};
const recorrentesAdd=item=>new Promise((res,rej)=>{invalidateCache('recorrentes');const t=db.transaction('recorrentes','readwrite');const r=t.objectStore('recorrentes').add(item);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const recorrentesPut=item=>new Promise((res,rej)=>{invalidateCache('recorrentes');const t=db.transaction('recorrentes','readwrite');const r=t.objectStore('recorrentes').put(item);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)});
const recorrentesDel=id=>new Promise(res=>{invalidateCache('recorrentes');const t=db.transaction('recorrentes','readwrite');t.objectStore('recorrentes').delete(id).onsuccess=()=>res()});

/* ── BUDGET DONE ── */
function doneKey(budgetId,y,m){return`${budgetId}_${y}${String(m+1).padStart(2,'0')}`}

const _budgetDoneAll=()=>{
  const hit=_cacheRead('budgetDone');if(hit)return hit;
  return new Promise(res=>{const t=db.transaction('budgetDone','readonly');t.objectStore('budgetDone').getAll().onsuccess=e=>res(_cacheWrite('budgetDone',e.target.result||[]))});
};
const doneGet=async key=>{
  try{const all=await _budgetDoneAll();return all.find(r=>r.key===key)||null;}
  catch{return null;}
};
const donePut=rec=>new Promise(res=>{invalidateCache('budgetDone');const t=db.transaction('budgetDone','readwrite');t.objectStore('budgetDone').put(rec).onsuccess=()=>res()});
const doneDel=key=>new Promise(res=>{invalidateCache('budgetDone');const t=db.transaction('budgetDone','readwrite');t.objectStore('budgetDone').delete(key).onsuccess=()=>res()});
const doneAllForMonth=async(y,m)=>{
  const prefix=`_${y}${String(m+1).padStart(2,'0')}`;
  const all=await _budgetDoneAll();
  return all.filter(r=>r.key.endsWith(prefix));
};
