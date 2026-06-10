function entryFormHtml(t=null){
  const isEdit=!!t;
  const defDate=t?.date||todayISO();
  const defMonth=t!=null?t.month:curMonth;
  const defYear=t!=null?t.year:curYear;
  const defType=t?.type||'variable';
  const defObs=t?.obs||'';
  const defVal=isEdit?(t.rawExpr?String(t.rawExpr):String(t.value)):'';
  return`
    <div class="modal-title">${isEdit?'✏️ Editar lançamento':'Novo lançamento'}</div>
    <div class="form-group">
      <label>Descrição</label>
      <input id="f-name" placeholder="Ex: Aluguel, Salário, Netflix..." oninput="clearFieldError('f-name')" value="${isEdit?t.name.replace(/"/g,'&quot;'):''}">
      <div class="field-error-msg" id="f-name-err"></div>
    </div>
    <div class="form-group">
      <label>Valor</label>
      <div class="row-flex">
        <input id="f-val" type="text" inputmode="decimal" placeholder="0,00" value="${defVal}" style="flex:1" oninput="onValInput()">
      <div class="field-error-msg" id="f-val-err"></div>
        <button type="button" onclick="openValNumpad()" class="btn-calc" title="Calculadora">📟</button>
      </div>
      <div id="val-preview" class="hint"></div>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Tipo</label>
        <select id="f-type" onchange="onTypeChange()" ${(isEdit&&(t?.fromBudget||t?.fromCartao))?'disabled':''}>
          <option value="income"${defType==='income'?' selected':''}>💵 Receita</option>
          <option value="fixed"${defType==='fixed'?' selected':''}>🏠 Despesa Fixa</option>
          <option value="variable"${defType==='variable'?' selected':''}>🛒 Despesa Variável</option>
          ${(isEdit&&(t?.fromBudget||t?.fromCartao))?'<option value="credit" selected>💳 Fatura cartão</option>':''}
        </select>
      </div>
      <div class="form-group">
        <label>Vencimento <span class="label-muted">(opcional)</span></label>
        <div class="row-flex">
          <input id="f-date" type="date" value="${t?.date||''}" style="flex:1" onchange="toggleDateClear('f-date-clear',this.value)">
          <button type="button" id="f-date-clear" onclick="clearDate('f-date','f-date-clear')" class="btn-clear-date" style="display:${(t?.date)?'inline':'none'}" title="Limpar">✕</button>
        </div>
      </div>
    </div>
    <div class="form-grid" style="margin-top:-4px">
      <div class="form-group">
        <label>Pago em <span class="label-muted">(opcional)</span></label>
        <div class="row-flex">
          <input id="f-paid" type="date" value="${t?.paidDate||''}" style="flex:1" onchange="toggleDateClear('f-paid-clear',this.value)">
          <button type="button" id="f-paid-clear" onclick="clearDate('f-paid','f-paid-clear')" class="btn-clear-date" style="display:${(t?.paidDate)?'inline':'none'}" title="Limpar">✕</button>
        </div>
      </div>
      <div></div>
    </div>
    <div class="form-group">
      <label>Período (mês/ano em que entra no controle)</label>
      <div style="display:flex;gap:8px">
        <select id="f-month" style="flex:1">${MONTHS.map((m,i)=>`<option value="${i}"${i===defMonth?' selected':''}>${m}</option>`).join('')}</select>
        <input id="f-year" type="number" value="${defYear}" style="width:80px;flex-shrink:0" inputmode="numeric">
      </div>
    </div>

    <div class="form-group">
      <div class="row-between-mb">
        <label style="margin:0">Subitens</label>
        <button type="button" class="btn btn-ghost btn-sm" onclick="addSubitem()">+ Subitem</button>
      </div>
      <div id="subitems-area"></div>
      <div class="hint">O valor total será calculado automaticamente pelos subitens</div>
    </div>

    <div class="form-group" id="f-pessoa-group">
      <label>Responsável <span class="label-muted">(opcional)</span></label>
      <div id="f-pessoa-chips" class="row-flex-wrap"></div>
    </div>
    <div class="form-group">
      <label>Observações <span class="label-muted">(opcional)</span></label>
      <textarea id="f-obs" placeholder="Detalhes, itens agrupados...">${defObs}</textarea>
    </div>
    <div id="area-recur" style="${(defType==='credit'||(isEdit&&(t?.fromBudget||t?.fromCartao)))?'display:none':''}">
      <div class="form-group">
        <label>Repetição</label>
        <select id="f-recur" onchange="onRecurChange()">
          <option value="none">Apenas este período</option>
          <option value="monthly">Mensal — repetir N vezes</option>
        </select>
      </div>
      <div id="area-recur-count" style="display:none" class="form-group">
        <label>Quantas vezes repetir</label>
        <input id="f-recur-count" type="text" inputmode="numeric" pattern="[0-9]*" value="12" placeholder="12">
        <div class="hint">Inclui o período atual</div>
      </div>
    </div>
    <div id="area-parcela" style="display:none">
      <div class="form-grid">
        <div class="form-group"><label>Parcela atual</label><input id="f-pnum" type="number" value="1" min="1" inputmode="numeric" oninput="clearFieldError('f-pnum')">
      <div class="field-error-msg" id="f-pnum-err"></div></div>
        <div class="form-group"><label>Total de parcelas</label><input id="f-ptotal" type="number" value="1" min="1" inputmode="numeric"></div>
      </div>
    </div>
    <div class="btn-row" style="margin-top:4px">
      <button class="btn btn-primary" style="flex:1" onclick="${isEdit?`updateEntry(${t.id})`:'saveEntry()'}">${isEdit?'Salvar edição':'Salvar'}</button>
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    </div>`;
}

function onValInput(){
  clearFieldError('f-val');
  const inp=document.getElementById('f-val');
  const raw=inp?.value||'';
  if(inp&&inp.dataset)inp.dataset.rawExpr='';
  const prev=document.getElementById('val-preview');
  if(!prev)return;
  if(hasOp(raw)){
    const r=evalExpr(raw);
    prev.textContent=isNaN(r)?'⚠ Expressão inválida':'= '+fmt(r);
    prev.style.color=isNaN(r)?'var(--red)':'var(--green)';
  }else{prev.textContent=''}
}
function clearDate(inputId,btnId){
  const inp=document.getElementById(inputId);
  if(inp)inp.value='';
  const btn=document.getElementById(btnId);
  if(btn)btn.style.display='none';
}
function toggleDateClear(btnId,val){
  const btn=document.getElementById(btnId);
  if(btn)btn.style.display=val?'inline':'none';
}
async function openValNumpad(){
  const valInp=document.getElementById('f-val');
  const cur=valInp?.dataset.rawExpr||valInp?.value||'';
  const result=await openNumpad(cur);
  if(result!==null&&valInp){clearFieldError('f-val');
    if(hasOp(result)){
      const r=evalExpr(result);
      if(!isNaN(r)){
        valInp.dataset.rawExpr=result;
        valInp.value=result;
        const prev=document.getElementById('val-preview');
        if(prev){prev.textContent='= '+fmt(r);prev.style.color='var(--green)';}
      }
    }else{
      valInp.dataset.rawExpr='';
      valInp.value=result;
      const prev=document.getElementById('val-preview');
      if(prev)prev.textContent='';
    }
  }
}

function onTypeChange(){
  const t=document.getElementById('f-type').value;
  document.getElementById('area-parcela').style.display='none';
  document.getElementById('area-recur').style.display=t==='credit'?'none':'block';
}
function onRecurChange(){
  const v=document.getElementById('f-recur')?.value;
  const el=document.getElementById('area-recur-count');
  if(el)el.style.display=v==='monthly'?'block':'none';
}

function showAddModal(){openModal(entryFormHtml());setTimeout(()=>renderPessoaChips('f-pessoa-chips',null),50);}
function showEditModal(id){dbAll().then(all=>{
  const t=all.find(x=>x.id===id);
  if(!t)return;
  openModal(entryFormHtml(t));
  setTimeout(()=>{
    const inp=document.getElementById('f-val');
    if(inp&&t.rawExpr){
      inp.dataset.rawExpr=t.rawExpr;
      const r=evalExpr(t.rawExpr);
      const prev=document.getElementById('val-preview');
      if(prev&&!isNaN(r)){prev.textContent='= '+fmt(r);prev.style.color='var(--green)';}
    }
    if(t.subitems?.length){
      t.subitems.forEach(s=>addSubitem(s.name,s.value,s.repeat||0,s.sgid||'',s.skip||[]));
      updateSubitemsTotal();
    }
    renderPessoaChips('f-pessoa-chips',t.pessoaId||null);
  },50);
})}


function addSubitem(name='',value='',repeat=1,sgid='',skip=[]){
  const area=document.getElementById('modal-b-subitems-area')||document.getElementById('b-subitems-area')||document.getElementById('subitems-area');
  if(!area)return;
  const row=document.createElement('div');
  row.className='subitem-row';
  const hasRepeat=repeat>0;
  // gerar sgid se tem repeat e nao foi passado
  const sid=hasRepeat?(sgid||Date.now().toString(36)+Math.random().toString(36).slice(2,5)):'';
  if(sid)row.dataset.sgid=sid;
  if(skip&&skip.length)row.dataset.skip=JSON.stringify(skip);
  row.innerHTML=`
    <input class="sub-name" placeholder="Nome do subitem" value="${name}">
    <input class="sub-value" type="number" step="0.01" placeholder="0,00" value="${value}" oninput="updateSubitemsTotal()">
    <button type="button" class="subitem-repeat${hasRepeat?' active':''}" title="N vezes" onclick="toggleSubitemRepeat(this)">⟳</button>
    <input class="sub-repeat" type="number" min="1" max="99" placeholder="N" value="${hasRepeat?repeat:''}" oninput="updateSubitemsTotal()" style="${hasRepeat?'':'display:none'}">
    <button type="button" class="subitem-remove" onclick="removeSubitem(this)">✕</button>
  `;
  area.appendChild(row);
  updateSubitemsTotal();
}
function toggleSubitemRepeat(btn){
  const row=btn.parentElement;
  const inp=row.querySelector('.sub-repeat');
  const active=btn.classList.toggle('active');
  inp.style.display=active?'block':'none';
  if(!active){
    inp.value='';
    delete row.dataset.sgid;
    updateSubitemsTotal();
  }else{
    if(!row.dataset.sgid)row.dataset.sgid=Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    inp.value='2';inp.focus();updateSubitemsTotal();
  }
}

function removeSubitem(btn){
  const row=btn.parentElement;
  const sgid=row.dataset.sgid||'';
  // Se nao tem sgid ou nao esta editando item com subRepeatStart: remove direto
  const modal=document.getElementById('modal-content');
  const hasRepeatCtx=modal&&modal.dataset.subRepeatStart&&modal.dataset.editingId;
  if(!sgid||!hasRepeatCtx){row.remove();updateSubitemsTotal();return;}
  const srs=JSON.parse(modal.dataset.subRepeatStart);
  const elapsed=(curYear*12+curMonth)-(srs.year*12+srs.month);
  const name=row.querySelector('.sub-name').value.trim()||'este subitem';
  const repeatInp=row.querySelector('.sub-repeat');
  const rep=parseInt(repeatInp?.value)||0;
  const remaining=rep-elapsed;
  showConfirm('Remover subitem','"'+name+'" — '+remaining+' mês(es) restante(s).',[
    {label:'Só este mês',cls:'btn-ghost',action:()=>{
      const skips=row.dataset.skip?JSON.parse(row.dataset.skip):[];
      skips.push(elapsed);
      row.dataset.skip=JSON.stringify(skips);
      row.style.opacity='0.5';
      updateSubitemsTotal();
    }},
    {label:'Este e seguintes',cls:'btn-ghost',action:()=>{
      row.dataset.repeatCap=String(elapsed);
      row.style.opacity='0.5';
      btn.disabled=true;
      updateSubitemsTotal();
    }},
    {label:'Todos os meses',cls:'btn-danger',action:()=>{
      row.remove();updateSubitemsTotal();
    }},
    {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
  ]);
}

function getSubitems(){
  const area=document.getElementById('modal-b-subitems-area')||document.getElementById('b-subitems-area')||document.getElementById('subitems-area');
  const rows=area?[...area.querySelectorAll('.subitem-row')]:[...document.querySelectorAll('.subitem-row')];
  return rows.map(r=>{
    const name=r.querySelector('.sub-name').value.trim();
    const value=parseFloat(r.querySelector('.sub-value').value)||0;
    if(!name||value<=0)return null;
    const repeatInp=r.querySelector('.sub-repeat');
    const repeat=repeatInp&&repeatInp.style.display!=='none'?Math.max(1,parseInt(repeatInp.value)||1):0;
    return {name:repeat>1?name+' 1/'+repeat:name,value};
  }).filter(Boolean);
}
function getRawSubitems(){
  const area=document.getElementById('modal-b-subitems-area')||document.getElementById('b-subitems-area')||document.getElementById('subitems-area');
  const rows=area?[...area.querySelectorAll('.subitem-row')]:[...document.querySelectorAll('.subitem-row')];
  return rows.map(r=>{
    const name=r.querySelector('.sub-name').value.trim();
    const value=parseFloat(r.querySelector('.sub-value').value)||0;
    if(!name||value<=0)return null;
    const repeatInp=r.querySelector('.sub-repeat');
    const repeatActive=repeatInp&&repeatInp.style.display!=='none';
    let repeat=repeatActive?Math.max(1,parseInt(repeatInp.value)||1):0;
    const sgid=r.dataset.sgid||'';
    if(r.dataset.repeatCap!=null)repeat=parseInt(r.dataset.repeatCap)||0;
    const skip=r.dataset.skip?JSON.parse(r.dataset.skip):[];
    if(repeat>0)return skip.length?{name,value,repeat,sgid,skip}:{name,value,repeat,sgid};
    return{name,value};
  }).filter(Boolean);
}

// Retorna os subitems ativos para um dado mes/ano, com label 'Nome X/N' quando repeat
function getActiveSubitems(subitems, startMonth, startYear, curM, curY){
  if(!subitems||!subitems.length)return[];
  const result=[];
  subitems.forEach(s=>{
    // subitem pode ter start proprio (adicionado em mes diferente)
    const sM=s.startMonth!=null?s.startMonth:startMonth;
    const sY=s.startYear!=null?s.startYear:startYear;
    const elapsed=(curY*12+curM)-(sY*12+sM);
    const rep=s.repeat; // 0/undefined=fixo, N>=1=limitado
    const skip=s.skip||[];
    if(!rep){
      if(!skip.includes(elapsed))result.push({name:s.name,value:s.value});
    } else if(elapsed>=0&&elapsed<rep){
      if(!skip.includes(elapsed)){
        result.push({name:s.name+' '+(elapsed+1)+'/'+rep,value:s.value});
      }
    }
  });
  return result;
}
function updateSubitemsTotal(){
  const subs=getSubitems();
  const total=subs.reduce((s,i)=>s+i.value,0);
  const valInp=document.getElementById('f-val')||document.getElementById('b-val');
  if(!valInp)return;
  const calcBtn=valInp.parentElement?.querySelector('button[title="Calculadora"]');
  if(subs.length){
    valInp.value=String(total.toFixed(2)).replace('.',',');
    if(valInp.dataset)valInp.dataset.rawExpr='';
    valInp.readOnly=true;
    valInp.style.opacity='.7';
    if(calcBtn){calcBtn.disabled=true;calcBtn.style.opacity='.3';calcBtn.style.cursor='not-allowed';}
    const prev=document.getElementById('val-preview')||document.getElementById('b-val-preview');
    if(prev)prev.textContent='';
  }else{
    valInp.readOnly=false;
    valInp.style.opacity='1';
    if(calcBtn){calcBtn.disabled=false;calcBtn.style.opacity='1';calcBtn.style.cursor='pointer';}
  }
}

function getFormValues(){
  const name=document.getElementById('f-name').value.trim();
  const valInp=document.getElementById('f-val');
  const fieldVal=(valInp?.value||'').trim();
  const storedExpr=valInp?.dataset?.rawExpr||'';
  const exprToEval=storedExpr||fieldVal;
  let val=NaN, rawExpr=null;
  if(hasOp(exprToEval)){
    val=evalExpr(exprToEval);
    if(!isNaN(val))rawExpr=exprToEval;
  }
  if(isNaN(val)){val=parseFloat(fieldVal.replace(',','.'));}
  if(isNaN(val)){val=parseFloat(fieldVal.replace('.','').replace(',','.'));}
  const type=document.getElementById('f-type').value;
  const date=document.getElementById('f-date')?.value||'';
  const paidDate=document.getElementById('f-paid')?.value||'';
  const month=parseInt(document.getElementById('f-month').value);
  const year=parseInt(document.getElementById('f-year').value);
  const obs=document.getElementById('f-obs')?.value.trim()||'';
  const subitems=getRawSubitems();
  const pessoaId=getSelectedPessoa('f-pessoa-chips');
  return{name,val,rawExpr,type,date,paidDate,month,year,obs,subitems,pessoaId};
}

async function saveEntry(){

  try{
    const{name,val,rawExpr,type,date,paidDate,month,year,obs,subitems,pessoaId}=getFormValues();
    if(!name){setFieldError('f-name','Informe o nome');return}
      if(!val||isNaN(val)||val<=0){setFieldError('f-val','Informe um valor válido');return}
    const groupId=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    if(type==='credit'){
      const pnum=parseInt(document.getElementById('f-pnum').value)||1;
      const ptotal=parseInt(document.getElementById('f-ptotal').value)||1;
      if(pnum>ptotal){setFieldError('f-pnum','Parcela atual maior que o total');return}
      let m=month,y=year,d=date;
      for(let i=pnum-1;i<ptotal;i++){
        await dbAdd({name:`${name} ${i+1}/${ptotal}`,value:val,rawExpr,type,month:m,year:y,ym:ym(y,m),date:d,paidDate,obs,subitems,pessoaId,groupId,createdAt:Date.now()});
        if(d){const nd=addMonths(d,1);if(nd)d=nd;}m++;if(m>11){m=0;y++}
      }
      toast(`${ptotal-pnum+1} parcela(s) salva(s)!`,'var(--purple)');
    } else if(document.getElementById('f-recur')?.value==='monthly'){
      const countRaw=document.getElementById('f-recur-count')?.value||'12';const count=Math.max(1,parseInt(countRaw.trim())||12);
      let m=month,y=year,d=date;
      for(let i=0;i<count;i++){
        await dbAdd({name,value:val,rawExpr,type,month:m,year:y,ym:ym(y,m),date:d,paidDate,obs,subitems,pessoaId,groupId,recurring:true,createdAt:Date.now()});
        if(d){const nd=addMonths(d,1);if(nd)d=nd;}m++;if(m>11){m=0;y++}
      }
      toast(`Lançamento fixo — ${count} ${count===1?'mês':'meses'}!`,'var(--teal)');
    } else {
      // item com subitems que tem repeat: salva 1 registro com subitems raw
      const rawSubs=getRawSubitems();
      const hasSubRepeat=rawSubs.some(s=>s.repeat>0);
      if(hasSubRepeat){
        await dbAdd({name,value:val,rawExpr,type,month,year,ym:ym(year,month),date,paidDate,obs,
          subitems:rawSubs,pessoaId,
          subRepeatStart:{month,year},
          createdAt:Date.now()});
        toast('Lançamento salvo!');
      }else{
        await dbAdd({name,value:val,rawExpr,type,month,year,ym:ym(year,month),date,paidDate,obs,subitems,pessoaId,createdAt:Date.now()});
        toast('Lançamento salvo!');
      }
    }
    closeModal();renderAll();

  }catch(e){
    console.error('[saveEntry]',e);
    toast('Erro ao salvar lançamento','var(--red)');
  }
}

async function updateEntry(id){

  try{
    const{name,val,rawExpr,type,date,paidDate,month,year,obs,subitems,pessoaId}=getFormValues();
    if(!name){setFieldError('f-name','Informe o nome');return}
      if(!val||isNaN(val)||val<=0){setFieldError('f-val','Informe um valor válido');return}
    const all=await dbAll();
    const existing=all.find(x=>x.id===id);
    if(!existing)return;

    const recurVal=document.getElementById('f-recur')?.value;
    const isNewRecur=recurVal==='monthly';
    const hasGroup=!!existing.groupId;

    if(isNewRecur){
      const countRaw=document.getElementById('f-recur-count')?.value||'12';const count=Math.max(1,parseInt(countRaw.trim())||12);
      if(hasGroup){
        const sameGroup=all.filter(x=>x.groupId===existing.groupId&&ym(x.year,x.month)>=ym(existing.year,existing.month));
        for(const x of sameGroup)await dbDel(x.id);
      } else {
        await dbDel(id);
      }
      const newGroupId=Date.now()+'_'+Math.random().toString(36).slice(2,7);
      let m=month,y=year,d=date;
      for(let i=0;i<count;i++){
        await dbAdd({name,value:val,rawExpr,type,month:m,year:y,ym:ym(y,m),date:d,paidDate,obs,subitems,pessoaId,groupId:newGroupId,recurring:true,createdAt:Date.now()});
        if(d){const nd=addMonths(d,1);if(nd)d=nd;}m++;if(m>11){m=0;y++}
      }
      toast(`Série de ${count} meses criada!`,'var(--teal)');
      closeModal();renderAll();
      return;
    }

    if(hasGroup){
      const futureInGroup=all.filter(x=>x.groupId===existing.groupId&&ym(x.year,x.month)>ym(existing.year,existing.month));
      if(futureInGroup.length>0){
        closeModal();
        showConfirm('Editar lançamento','Este lançamento faz parte de uma série. O que deseja atualizar?',[
          {label:'Apenas este período',cls:'btn-ghost',action:async()=>{await dbPut({...existing,name,value:val,rawExpr,type,date,paidDate,month,year,ym:ym(year,month),obs,subitems,pessoaId});toast('Lançamento atualizado!','var(--green)');renderAll()}},
          {label:'Este e todos os seguintes',cls:'btn-primary',action:async()=>{
            const toUpdate=[existing,...futureInGroup].sort((a,b)=>ym(a.year,a.month)-ym(b.year,b.month));
            let m=month,y=year,d=date;
            for(const x of toUpdate){
              await dbPut({...x,name,value:val,rawExpr,type,month:m,year:y,ym:ym(y,m),date:d,paidDate,obs,subitems,pessoaId});
              if(d){const nd=addMonths(d,1);if(nd)d=nd;}m++;if(m>11){m=0;y++}
            }
            toast('Série atualizada!','var(--green)');renderAll();
          }},
          {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
        ]);
        return;
      }
    }
    await dbPut({...existing,name,value:val,rawExpr,type,date,paidDate,month,year,ym:ym(year,month),obs,subitems,pessoaId});
    toast('Lançamento atualizado!','var(--green)');
    closeModal();renderAll();

  }catch(e){
    console.error('[updateEntry]',e);
    toast('Erro ao salvar lançamento','var(--red)');
  }
}

async function deleteTx(id){

  try{
    const all=await dbAll();
    const item=all.find(x=>x.id===id);
    if(!item){await dbDel(id);renderAll();return}
    if(item.groupId){
      const future=all.filter(x=>x.groupId===item.groupId&&ym(x.year,x.month)>ym(item.year,item.month));
      if(future.length>0){
        showConfirm('Remover lançamento','Este lançamento faz parte de uma série.',[
          {label:'Remover só este',cls:'btn-ghost',action:async()=>{await dbDel(id);toast('Removido','var(--red)');renderAll()}},
          {label:`Remover este + ${future.length} seguinte(s)`,cls:'btn-danger',action:async()=>{
            await dbDel(id);
            for(const x of future)await dbDel(x.id);
            toast(`${future.length+1} lançamentos removidos`,'var(--red)');renderAll();
          }},
          {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
        ]);
        return;
      }
    }
    if(!confirm('Remover este lançamento?'))return;
    await dbDel(id);toast('Removido','var(--red)');renderAll();

  }catch(e){
    console.error('[deleteTx]',e);
    toast('Erro ao remover lançamento','var(--red)');
  }
}

function txCard(t){
  const income=t.type==='income';
  return`<div class="tx-item">
    <div class="tx-icon ${t.type}">${ICONS[t.type]||'💰'}</div>
    <div class="tx-info">
      <div class="tx-name">${t.name}</div>
      <div class="tx-meta">
        <span>${CAT_LABELS[t.type]||''}</span>
        ${t.recurring||t.groupId?'<span class="badge badge-blue">série</span>':''}
        ${t.date?`<span>📅 Venc. ${fmtDate(t.date)}</span>`:''}
        ${t.paidDate?`<span style="color:var(--green)">✅ Pago ${fmtDate(t.paidDate)}</span>`:''}
        ${t._pessoa?`<span class="person-tag">${personAvatarHtml(t._pessoa,14)} ${t._pessoa.nome}</span>`:''}
      </div>
      ${t.obs?`<div class="tx-obs">💬 ${t.obs}</div>`:''}
      ${renderSubitemsHtml(t.subitems)}
    </div>
    <div class="tx-right">
      <div class="tx-val ${income?'income':'expense'}">${income?'+':'-'}${fmt(t.value)}</div>
      <div class="tx-actions">
        <button class="tx-btn edit" onclick="showEditModal(${t.id})">✏️</button>
        <button class="tx-btn del" onclick="deleteTx(${t.id})">✕</button>
      </div>
    </div>
  </div>`;
}

function _fmtUpdateDate(ts){
  const d=new Date(parseInt(ts));
  const dia=String(d.getDate()).padStart(2,'0');
  const mes=String(d.getMonth()+1).padStart(2,'0');
  const ano=d.getFullYear();
  const h=String(d.getHours()).padStart(2,'0');
  const m=String(d.getMinutes()).padStart(2,'0');
  return dia+'/'+mes+'/'+ano+' às '+h+':'+m;
}
function loadLastUpdate(){
  const el=document.getElementById('last-update-label');
  if(!el)return;
  const history=JSON.parse(localStorage.getItem('lastUpdateHistory')||'[]');
  const ts=history.length?history[history.length-1]:null;
  if(!ts){el.textContent='🕐 Nunca atualizado';return;}
  el.textContent='🕐 Atualizado em '+_fmtUpdateDate(ts);
}
function _doMarkLastUpdate(){
  const history=JSON.parse(localStorage.getItem('lastUpdateHistory')||'[]');
  history.push(Date.now());
  if(history.length>20)history.splice(0,history.length-20);
  localStorage.setItem('lastUpdateHistory',JSON.stringify(history));
  localStorage.setItem('lastUpdate',String(history[history.length-1]));
  loadLastUpdate();
  toast('Marcado como atualizado!','var(--teal)');
}
function markLastUpdate(){
  showConfirm('Marcar como atualizado?','Registra o momento atual no histórico de atualizações.',[
    {label:'Confirmar',cls:'btn-primary',action:()=>_doMarkLastUpdate()},
    {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
  ]);
}

function clearUpdateHistory(){
  showConfirm('Limpar histórico?','Todo o histórico de atualizações será removido.',[
    {label:'Limpar',cls:'btn-danger',action:()=>{
      localStorage.removeItem('lastUpdateHistory');
      localStorage.removeItem('lastUpdate');
      loadLastUpdate();
      closeModal();
    }},
    {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
  ]);
}
function showUpdateHistory(){
  const history=JSON.parse(localStorage.getItem('lastUpdateHistory')||'[]');
  if(!history.length){toast('Nenhum registro de atualização','var(--amber)');return;}
  const rows=history.slice().reverse().map((ts,i)=>{
    const label=i===0?'<span style="font-size:10px;color:var(--teal);margin-left:6px">mais recente</span>':'';
    return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">'+_fmtUpdateDate(ts)+label+'</div>';
  }).join('');
  openModal(
    '<div class="modal-title">🕐 Histórico de atualizações</div>'+
    '<div style="max-height:320px;overflow-y:auto">'+rows+'</div>'+
    '<div style="margin-top:12px;display:flex;gap:8px">'+
    '<button class="btn btn-ghost" style="flex:1" onclick="clearUpdateHistory()">Limpar histórico</button>'+
    '<button class="btn btn-primary" style="flex:1" onclick="closeModal()">Fechar</button>'+
    '</div>'
  );
}

async function renderDash(){

  try{
    loadLastUpdate();
    updateMonthLabels();
    const all=await dbAll();
    const pessoas=await pessoasAll();
    const pessoaMap=Object.fromEntries(pessoas.map(p=>[p.id,p]));
    // Apply pessoa filter to ALL calculations if active
    const{rows:allRows}=calcMonth(all,curYear,curMonth);
    const filteredRows=pessoaFilter?allRows.filter(t=>t.pessoaId===pessoaFilter):allRows;
    const income=filteredRows.filter(t=>t.type==='income').reduce((s,t)=>s+t.value,0);
    const expense=filteredRows.filter(t=>t.type!=='income'&&t.type!=='credit').reduce((s,t)=>s+t.value,0);
    const credit=filteredRows.filter(t=>t.type==='credit').reduce((s,t)=>s+t.value,0);
    const balance=income-expense-credit;
    const rows=filteredRows;
    const fixed=rows.filter(t=>t.type==='fixed').reduce((s,t)=>s+t.value,0);
    const variable=rows.filter(t=>t.type==='variable').reduce((s,t)=>s+t.value,0);
    const totalOut=expense+credit;
    const pct=income>0?Math.min(100,Math.round(totalOut/income*100)):0;
    const barColor=pct<60?'var(--green)':pct<85?'var(--amber)':'var(--red)';
    document.getElementById('summary-cards').innerHTML=`
      <div class="stat-card"><div class="stat-icon">💵</div><div class="stat-label">Receitas</div><div class="stat-value green">${fmt(income)}</div></div>
      <div class="stat-card"><div class="stat-icon">📤</div><div class="stat-label">Despesas</div><div class="stat-value red">${fmt(expense)}</div></div>
      <div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-label">Saldo</div><div class="stat-value ${balance>=0?'green':'red'}">${balance>=0?'+':'-'}${fmt(balance)}</div></div>
      <div class="stat-card"><div class="stat-icon">💳</div><div class="stat-label">Cartão</div><div class="stat-value amber">${fmt(credit)}</div></div>
    `;
    document.getElementById('prog-area').innerHTML=`
      <div class="row-meta-wrap">
        <span>🏠 ${fmt(fixed)}</span><span>🛒 ${fmt(variable)}</span><span>💳 ${fmt(credit)}</span>
      </div>
      <div class="prog-bar"><div class="prog-fill" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="prog-labels"><span>${pct}% comprometido</span><span style="color:${barColor};font-weight:500">${pct<60?'✓ Saudável':pct<85?'⚠ Atenção':'✗ Alto'}</span></div>
    `;
    const enrichedRows=rows.map(t=>{
      const base={...t,_pessoa:t.pessoaId?pessoaMap[t.pessoaId]:null};
      if(t.subRepeatStart&&t.subitems&&t.subitems.length){
        const activeSubs=getActiveSubitems(t.subitems,t.subRepeatStart.month,t.subRepeatStart.year,t.month,t.year);
        return {...base,subitems:activeSubs,value:activeSubs.length?activeSubs.reduce((s,x)=>s+x.value,0):t.value};
      }
      return base;
    });
    const recent=[...enrichedRows].sort((a,b)=>(b.date||'')>(a.date||'')?1:(b.date||'')<(a.date||'')?-1:b.id-a.id).slice(0,6);
    // pessoa summary card
    const pessoaSummaryEl=document.getElementById('pessoa-summary');
    const pessoaSummaryCard=document.getElementById('pessoa-summary-card');
    if(pessoaSummaryEl&&pessoas.length>1){
      const summaryHtml=pessoas.map(p=>{
        const pRows=allRows.filter(t=>t.pessoaId===p.id);
        const pInc=pRows.filter(t=>t.type==='income').reduce((s,t)=>s+t.value,0);
        const pExp=pRows.filter(t=>t.type!=='income'&&t.type!=='credit').reduce((s,t)=>s+t.value,0);
        const pCred=pRows.filter(t=>t.type==='credit').reduce((s,t)=>s+t.value,0);
        const pBal=pInc-pExp-pCred;
        return`<div style='display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)'>
          ${personAvatarHtml(p,28)}
          <div style='flex:1'><div style='font-size:13px;font-weight:500'>${p.nome}</div><div style='font-size:11px;color:var(--text3)'>${fmt(pInc)} entrada · ${fmt(pExp+pCred)} saída</div></div>
          <div style='font-family:var(--mono);font-size:13px;font-weight:600;color:${pBal>=0?'var(--green)':'var(--red)'}'>${pBal>=0?'+':'-'}${fmt(pBal)}</div>
        </div>`;
      }).join('');
      pessoaSummaryEl.innerHTML=summaryHtml;
      if(pessoaSummaryCard)pessoaSummaryCard.style.display='block';
    }else{
      if(pessoaSummaryCard)pessoaSummaryCard.style.display='none';
    }
    document.getElementById('recent-list').innerHTML=recent.length
      ?recent.map(txCard).join('')
      :`<div class="empty"><div class="empty-icon">📊</div>Nenhum lançamento em ${MONTHS[curMonth]}.<br>Toque em <strong>+ Novo</strong> para começar.</div>`;

  }catch(e){
    console.error('[renderDash]',e);
    toast('Erro ao carregar dashboard','var(--red)');
  }
}

function filterTx(f,btn){
  txFilter=f;
  document.querySelectorAll('#tx-tabs .tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');renderTx();
}
async function renderTx(){

  try{
    updateMonthLabels();
    const all=await dbAll();
    const pessoas=await pessoasAll();
    const pessoaMap=Object.fromEntries(pessoas.map(p=>[p.id,p]));
    let rows=all.filter(t=>t.year===curYear&&t.month===curMonth);
    if(pessoaFilter)rows=rows.filter(t=>t.pessoaId===pessoaFilter);
    rows=rows.map(t=>{
      const base={...t,_pessoa:t.pessoaId?pessoaMap[t.pessoaId]:null};
      if(t.subRepeatStart&&t.subitems&&t.subitems.length){
        const activeSubs=getActiveSubitems(t.subitems,t.subRepeatStart.month,t.subRepeatStart.year,t.month,t.year);
        return {...base,subitems:activeSubs,value:activeSubs.length?activeSubs.reduce((s,x)=>s+x.value,0):t.value};
      }
      return base;
    });
    const filtered=txFilter==='all'?rows:rows.filter(t=>t.type===txFilter);
    const sorted=[...filtered].sort((a,b)=>(b.date||'')>(a.date||'')?1:(b.date||'')<(a.date||'')?-1:b.id-a.id);
    document.getElementById('tx-list').innerHTML=sorted.length
      ?sorted.map(txCard).join('')
      :`<div class="empty"><div class="empty-icon">🗂️</div>Nenhum lançamento${txFilter!=='all'?' nesta categoria':''}<br>em ${MONTHS[curMonth]}.</div>`;

  }catch(e){
    console.error('[renderTx]',e);
    toast('Erro ao carregar lançamentos','var(--red)');
  }
}