async function exportData(){
  const all=await dbAll();
  const buds=await budgetAll();
  if(!all.length&&!buds.length){toast('Nenhum dado para exportar','var(--amber)');return}
  const pessoas=await pessoasAll();
  const cartoes=await cartoesAll();
  const gastos=await gastosAll();
  const budgetDoneAll=await new Promise(res=>{const t=db.transaction('budgetDone','readonly');t.objectStore('budgetDone').getAll().onsuccess=e=>res(e.target.result||[])});
  const recorrentes=await recorrentesAll();
  const json=JSON.stringify({version:6,exportedAt:new Date().toISOString(),data:all,budget:buds,pessoas,cartoes,gastos,recorrentes,budgetDone:budgetDoneAll},null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const d=new Date();
  a.href=url;a.download=`financas_backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.json`;
  a.click();URL.revokeObjectURL(url);
  toast(`${all.length} lançamentos exportados!`,'var(--green)');
}
function importData(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      const obj=JSON.parse(ev.target.result);
      const items=obj.data||obj;
      if(!Array.isArray(items)){toast('Arquivo inválido','var(--red)');return}
      const budgetItems=obj.budget||[];
      const pessoaItems=obj.pessoas||[];
      const total=items.length+(budgetItems.length||0)+(pessoaItems.length||0);
      if(!confirm(`Importar ${total} registros? Os dados atuais serão mantidos.`))return;
      let count=0;
      const cartaoItems=obj.cartoes||[];
      const gastoItems=obj.gastos||[];
      // Import pessoas first, build oldId->newId map for remapping
      const pessoaIdMap={};
      for(const item of pessoaItems){
        const{id:oldId,...rest}=item;
        if(!rest.nome||!rest.color)continue;
        const newId=await pessoasAdd(rest);
        if(oldId&&newId)pessoaIdMap[oldId]=newId;
        count++;
      }
      // Import tx items, remapping pessoaId
      for(const item of items){
        const{id,...rest}=item;
        if(!rest.name||!rest.value||!rest.type)continue;
        if(!rest.ym)rest.ym=ym(rest.year,rest.month);
        if(rest.pessoaId&&pessoaIdMap[rest.pessoaId])rest.pessoaId=pessoaIdMap[rest.pessoaId];
        await dbAdd(rest);count++;
      }
      // Import budget items, remapping pessoaId, build budgetIdMap
      const budgetIdMap={};
      for(const item of budgetItems){
        const{id:oldBudgetId,...rest}=item;
        if(!rest.name||!rest.value||!rest.type)continue;
        if(rest.pessoaId&&pessoaIdMap[rest.pessoaId])rest.pessoaId=pessoaIdMap[rest.pessoaId];
        const newBudgetId=await budgetAdd(rest);
        if(oldBudgetId&&newBudgetId)budgetIdMap[oldBudgetId]=newBudgetId;
        count++;
      }
      // Import cartoes, build cartaoIdMap
      const cartaoIdMap={};
      for(const item of cartaoItems){
        const{id:oldId,...rest}=item;
        if(!rest.name)continue;
        if(rest.pessoaId&&pessoaIdMap[rest.pessoaId])rest.pessoaId=pessoaIdMap[rest.pessoaId];
        const newId=await cartoesAdd(rest);
        if(oldId&&newId)cartaoIdMap[oldId]=newId;
        count++;
      }
      // Import gastos, remapping cartaoId
      for(const item of gastoItems){
        const{id,...rest}=item;
        if(!rest.name||!rest.value)continue;
        if(rest.cartaoId&&cartaoIdMap[rest.cartaoId])rest.cartaoId=cartaoIdMap[rest.cartaoId];
        await gastosAdd(rest);count++;
      }
      // Import recorrentes, remapping cartaoId
      const recorrenteItems=obj.recorrentes||[];
      for(const item of recorrenteItems){
        const{id,...rest}=item;
        if(!rest.name||!rest.cartaoId)continue;
        if(cartaoIdMap[rest.cartaoId])rest.cartaoId=cartaoIdMap[rest.cartaoId];
        await recorrentesAdd(rest);count++;
      }
      // Import budgetDone por ultimo (precisa budgetIdMap e cartaoIdMap prontos)
      const budgetDoneItems=obj.budgetDone||[];
      for(const item of budgetDoneItems){
        if(!item.key||!item.budgetId)continue;
        const isCartao=String(item.budgetId).startsWith('cartao_');
        if(isCartao){
          // key: cartao_3_202506 -> cartao_NEWID_202506
          const parts=String(item.budgetId).split('_'); // ['cartao','3']
          const oldCartaoId=parseInt(parts[1]);
          const newCartaoId=cartaoIdMap[oldCartaoId];
          if(!newCartaoId)continue;
          const newBudgetId='cartao_'+newCartaoId;
          const yyyymm=item.key.split('_').slice(2).join('_');
          const newKey=newBudgetId+'_'+yyyymm;
          await new Promise(res=>{
            const t=db.transaction('budgetDone','readwrite');
            t.objectStore('budgetDone').put({key:newKey,budgetId:newBudgetId,txId:null,doneAt:item.doneAt||Date.now()}).onsuccess=()=>res();
          });
        }else{
          // budget item normal
          const newBudgetId=budgetIdMap[item.budgetId];
          if(!newBudgetId)continue;
          const yyyymm=item.key.split('_').slice(1).join('_');
          const newKey=newBudgetId+'_'+yyyymm;
          await new Promise(res=>{
            const t=db.transaction('budgetDone','readwrite');
            t.objectStore('budgetDone').put({key:newKey,budgetId:newBudgetId,txId:null,doneAt:item.doneAt||Date.now()}).onsuccess=()=>res();
          });
        }
        count++;
      }
      toast(`${count} registros importados!`,'var(--green)');
      renderAll();renderBudget();renderCards();renderPersonFilterBars();renderPessoasConfig();
    }catch(e){console.error(e);toast('Erro ao ler arquivo','var(--red)')}
  };
  reader.readAsText(file);e.target.value='';
}
async function clearAll(){
  if(!confirm('Apagar TODOS os dados? (Lançamentos, orçamento e pessoas)\nEsta ação não pode ser desfeita.'))return;
  await dbClear();
  // clear budget, budgetDone
  await new Promise(res=>{const t=db.transaction('budget','readwrite');t.objectStore('budget').clear().onsuccess=()=>res()});
  await new Promise(res=>{const t=db.transaction('budgetDone','readwrite');t.objectStore('budgetDone').clear().onsuccess=()=>res()});
  await new Promise(res=>{const t=db.transaction('pessoas','readwrite');t.objectStore('pessoas').clear().onsuccess=()=>res()});
  await new Promise(res=>{const t=db.transaction('cartoes','readwrite');t.objectStore('cartoes').clear().onsuccess=()=>res()});
  await new Promise(res=>{const t=db.transaction('gastos','readwrite');t.objectStore('gastos').clear().onsuccess=()=>res()});
  await new Promise(res=>{const t=db.transaction('recorrentes','readwrite');t.objectStore('recorrentes').clear().onsuccess=()=>res()});
  pessoaFilter=null;
  toast('Todos os dados apagados','var(--red)');
  renderAll();
  renderBudget();
  renderCards();
  renderPessoasConfig();
  renderPersonFilterBars();
}

function renderCfg(){
  const tog=document.getElementById('toggle-dark');
  if(tog)tog.checked=!document.body.classList.contains('light');
  renderPessoasConfig();
}