const CARD_COLORS=['#7b2d8b','#e07b00','#0070cc','#00a86b','#c0392b','#0097a7','#d4380d','#6d3fdc','#1565c0','#00796b','#ad1457','#f57c00'];
const CARD_COLOR_NAMES=['Midnight','Navy','Ocean','Purple','Charcoal','Forest','Violet','Crimson'];

function getFaturaMonth(dateISO, cartao){
  // Determine which fatura a gasto belongs to, based on cartao.fechamento
  // Day >= fechamento -> next month's fatura; day < fechamento -> current month's fatura
  if(!dateISO||!cartao)return null;
  const d=new Date(dateISO+'T12:00:00');
  const day=d.getDate();
  let fatMonth=d.getMonth();
  let fatYear=d.getFullYear();
  if(day>=cartao.fechamento){
    fatMonth++;
    if(fatMonth>11){fatMonth=0;fatYear++;}
  }
  return{month:fatMonth,year:fatYear};
}

function getFaturaVencimento(fatYear,fatMonth,cartao){
  // Returns ISO date of vencimento for a given fatura month/year
  if(!cartao)return null;
  const day=Math.min(cartao.vencimento,28);
  return fatYear+'-'+String(fatMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
}

function getCurrentFatura(cartao){
  // Returns {month,year} of the "current" fatura (based on today)
  const today=new Date();
  const day=today.getDate();
  let m=today.getMonth(),y=today.getFullYear();
  if(day>=cartao.fechamento){m++;if(m>11){m=0;y++;}}
  return{month:m,year:y};
}

async function getCartaoFaturaGastos(cartaoId, fatMonth, fatYear){
  const all=await gastosAll();
  const cartoes=await cartoesAll();
  const cartao=cartoes.find(c=>c.id===cartaoId);
  if(!cartao)return[];
  return all.filter(g=>{
    if(g.cartaoId!==cartaoId)return false;
    const fm=getFaturaMonth(g.date,cartao);
    if(!fm)return false;
    if(fm.month===fatMonth&&fm.year===fatYear)return true;
    if(g.subRepeatStart&&g.subitems?.length){
      const activeSubs=getActiveSubitems(g.subitems,g.subRepeatStart.month,g.subRepeatStart.year,fatMonth,fatYear);
      return activeSubs.length>0;
    }
    return false;
  }).map(g=>{
    const res=gastoValueForFatura(g,fatMonth,fatYear);
    if(!res)return null;
    return{...g,value:res.value,subitems:res.subitems};
  }).filter(Boolean);
}

async function getCartaoFaturaTotal(cartaoId, fatMonth, fatYear){
  const gastos=await getCartaoFaturaGastos(cartaoId,fatMonth,fatYear);
  return gastos.reduce((s,g)=>s+g.value,0);
}

function showAddCartaoModal(cartao=null){
  const isEdit=!!cartao;
  const defColor=cartao?.color||CARD_COLORS[0];
  openModal(`
    <div class="modal-title">${isEdit?'✏️ Editar cartão':'Novo cartão'}</div>
    <div class="form-group">
      <label>Nome do cartão</label>
      <input id="cc-name" placeholder="Ex: Nubank, Itaú, Inter..." value="${isEdit?cartao.name.replace(/"/g,'&quot;'):''}">
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label>Dia fechamento</label>
        <input id="cc-fech" type="text" inputmode="numeric" placeholder="Ex: 15" value="${isEdit?cartao.fechamento:''}">
      </div>
      <div class="form-group">
        <label>Dia vencimento</label>
        <input id="cc-venc" type="text" inputmode="numeric" placeholder="Ex: 22" value="${isEdit?cartao.vencimento:''}">
      </div>
    </div>
    <div class="form-group">
      <label>Limite <span style="font-weight:400;color:var(--text3)">(opcional)</span></label>
      <input id="cc-limite" type="text" inputmode="decimal" placeholder="Ex: 5000" value="${isEdit&&cartao.limite?cartao.limite:''}">
    </div>
    <div class="form-group">
      <label>Responsável <span style="font-weight:400;color:var(--text3)">(opcional)</span></label>
      <div id="cc-pessoa-chips" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px"></div>
    </div>
    <div class="form-group">
      <label>Cor</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        ${CARD_COLORS.map((c,i)=>'<div class="color-swatch'+(c===defColor?' selected':'')+'" style="background:'+c+';width:32px;height:20px;border-radius:4px" data-color="'+c+'" onclick="selectPessoaColor(this.dataset.color)"></div>').join('')}
      </div>
      <input type="hidden" id="p-color" value="${defColor}">
    </div>
    <div class="btn-row" style="margin-top:4px">
      <button class="btn btn-primary" style="flex:1" onclick="${isEdit?'saveCartaoEdit('+cartao.id+')':'saveCartao()'}">Salvar</button>
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    </div>`);
  setTimeout(()=>renderPessoaChips('cc-pessoa-chips',cartao?.pessoaId||null),50);
}

async function saveCartao(){
  const name=document.getElementById('cc-name')?.value.trim();
  const fechamento=parseInt(document.getElementById('cc-fech')?.value)||0;
  const vencimento=parseInt(document.getElementById('cc-venc')?.value)||0;
  const color=document.getElementById('p-color')?.value||CARD_COLORS[0];
  const pessoaId=getSelectedPessoa('cc-pessoa-chips');
  const limite=parseFloat(document.getElementById('cc-limite')?.value)||null;
  if(!name||!fechamento||!vencimento||fechamento<1||fechamento>31||vencimento<1||vencimento>31){
    toast('Preencha nome e dias válidos!','var(--red)');return;
  }
  await cartoesAdd({name,fechamento,vencimento,color,pessoaId,limite,createdAt:Date.now()});
  toast('Cartão adicionado!','var(--blue)');
  closeModal();renderCards();refreshBudgetCartoes();
}

async function saveCartaoEdit(id){
  const name=document.getElementById('cc-name')?.value.trim();
  const fechamento=parseInt(document.getElementById('cc-fech')?.value)||0;
  const vencimento=parseInt(document.getElementById('cc-venc')?.value)||0;
  const color=document.getElementById('p-color')?.value||CARD_COLORS[0];
  const pessoaId=getSelectedPessoa('cc-pessoa-chips');
  const limite=parseFloat(document.getElementById('cc-limite')?.value)||null;
  if(!name||!fechamento||!vencimento){toast('Preencha todos os campos!','var(--red)');return;}
  const all=await cartoesAll();
  const existing=all.find(c=>c.id===id);
  if(!existing)return;
  await cartoesPut({...existing,name,fechamento,vencimento,color,pessoaId,limite});
  toast('Cartão atualizado!','var(--blue)');
  closeModal();renderCards();refreshBudgetCartoes();
}

async function deleteCartao(id){
  if(!confirm('Remover este cartão e todos os gastos associados?'))return;
  // delete all gastos for this card
  const all=await gastosAll();
  for(const g of all.filter(g=>g.cartaoId===id))await gastosDel(g.id);
  const allRec=await recorrentesAll();
  for(const r of allRec.filter(r=>r.cartaoId===id))await recorrentesDel(r.id);
  await cartoesDel(id);
  toast('Cartão removido','var(--red)');
  renderCards();refreshBudgetCartoes();
}

function showAddGastoModal(cartaoId, cartao, gasto=null){
  const isEdit=!!gasto;
  openModal(`
    <div class="modal-title">${isEdit?'✏️ Editar gasto':'Novo gasto — '+cartao.name}</div>
    <div class="form-group">
      <label>Descrição</label>
      <input id="cg-name" placeholder="Ex: Supermercado, Restaurante..." value="${isEdit?gasto.name.replace(/"/g,'&quot;'):''}">
    </div>
    <div class="form-group">
      <label>Valor</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="cg-val" type="text" inputmode="decimal" placeholder="0,00" value="${isEdit?(gasto.rawExpr||gasto.value):''}" style="flex:1" oninput="onCgValInput()">
        <button type="button" onclick="openGastoNumpad()" class="btn-calc" title="Calculadora">📟</button>
      </div>
      <div id="cg-val-preview" style="font-size:12px;min-height:16px;margin-top:4px;font-family:var(--mono)"></div>
    </div>
    <div class="form-group">
      <label>Data do gasto</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input id="cg-date" type="date" value="${isEdit?gasto.date:todayISO()}" style="flex:1" onchange="updateFaturaPreview()">
        <button type="button" onclick="clearDate('cg-date','cg-date-clear');updateFaturaPreview()" id="cg-date-clear" class="btn-clear-date" style="display:${isEdit&&gasto.date?'inline':'none'}" title="Limpar">✕</button>
      </div>
    </div>
    <div id="cg-fatura-preview" style="font-size:12px;color:var(--blue);margin-top:-6px;margin-bottom:10px;min-height:16px"></div>
    <div class="form-group">
      <label>Parcelas <span style="font-weight:400;color:var(--text3)">(opcional)</span></label>
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
        <label class="toggle" style="flex-shrink:0">
          <input type="checkbox" id="cg-parcela-toggle" onchange="toggleGastoParcela(this.checked)" ${isEdit&&gasto.totalParcelas>1?'checked':''}>
          <div class="toggle-track"></div><div class="toggle-thumb"></div>
        </label>
        <span style="font-size:13px;color:var(--text2)">Parcelar compra</span>
      </div>
      <div id="cg-parcela-area" style="${isEdit&&gasto.totalParcelas>1?'display:block':'display:none'};margin-top:10px">
        <div class="form-grid">
          <div class="form-group"><label>Parcela atual</label>
            <input id="cg-pnum" type="text" inputmode="numeric" placeholder="1" value="${isEdit&&gasto.parcela?gasto.parcela:'1'}">
          </div>
          <div class="form-group"><label>Total de parcelas</label>
            <input id="cg-ptotal" type="text" inputmode="numeric" placeholder="Ex: 12" value="${isEdit&&gasto.totalParcelas?gasto.totalParcelas:''}">
          </div>
        </div>
        <div class="hint">Valor informado = valor de cada parcela</div>
      </div>
    </div>
    <div class="form-group">
      <label>Observações <span style="font-weight:400;color:var(--text3)">(opcional)</span></label>
      <textarea id="cg-obs" placeholder="Detalhes...">${isEdit?gasto.obs||'':''}</textarea>
    </div>
    <div class="form-group">
      <label>Subitens <span style="font-weight:400;color:var(--text3)">(opcional)</span></label>
      <div id="cg-subitems-area"></div>
      <button type="button" onclick="addGastoSubitem()" style="margin-top:6px;background:none;border:1px dashed var(--border);color:var(--text3);border-radius:var(--radius-sm);padding:6px 12px;font-size:13px;cursor:pointer;width:100%">+ subitem</button>
    </div>
    <input type="hidden" id="cg-cartao-id" value="${cartaoId}">
    <div class="btn-row" style="margin-top:4px">
      <button class="btn btn-primary" style="flex:1" onclick="${isEdit?'saveGastoEdit('+gasto.id+')':'saveGasto()'}">Salvar</button>
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    </div>`);
  setTimeout(()=>{
    updateFaturaPreview(cartao);
    if(isEdit&&gasto.rawExpr){
      const inp=document.getElementById('cg-val');
      if(inp){
        inp.dataset.rawExpr=gasto.rawExpr;
        const r=evalExpr(gasto.rawExpr);
        const prev=document.getElementById('cg-val-preview');
        if(prev&&!isNaN(r)){prev.textContent='= '+fmt(r);prev.style.color='var(--green)';}
      }
    }
    // marcar modal para removeGastoSubitem
    const mc=document.getElementById('modal-content');
    if(isEdit&&mc){
      mc.dataset.editingGastoId=String(gasto.id);
      if(gasto.subRepeatStart)mc.dataset.subRepeatStart=JSON.stringify(gasto.subRepeatStart);
      else delete mc.dataset.subRepeatStart;
    }
    // restaurar subitems ao editar
    if(isEdit&&gasto.subitems?.length){
      const srs=gasto.subRepeatStart;
      const fatM=getFaturaMonth(gasto.date,cartao);
      const defaultM=srs?srs.month:(fatM?fatM.month:curMonth);
      const defaultY=srs?srs.year:(fatM?fatM.year:curYear);
      gasto.subitems.forEach(s=>{
        const rep=s.repeat||0;
        // usar start individual ou defaultStart (subRepeatStart do gasto)
        const sM=s.startMonth!=null?s.startMonth:defaultM;
        const sY=s.startYear!=null?s.startYear:defaultY;
        const elap=(curYear*12+curMonth)-(sY*12+sM);
        if(rep>0&&elap>=rep)return; // ja acabou
        if(elap<0)return; // ainda nao comecou neste mes
        const skipArr=s.skip||[];
        if(skipArr.includes(elap))return; // pulado neste mes
        addGastoSubitem(s.name,s.value,rep,s.sgid||'',s.skip||[],sM,sY);
      });
    }
  },50);
}

async function updateFaturaPreview(cartaoObj){
  const prev=document.getElementById('cg-fatura-preview');
  if(!prev)return;
  const dateVal=document.getElementById('cg-date')?.value;
  const cartaoId=parseInt(document.getElementById('cg-cartao-id')?.value);
  if(!dateVal){prev.textContent='';return;}
  let cartao=cartaoObj;
  if(!cartao){const all=await cartoesAll();cartao=all.find(c=>c.id===cartaoId);}
  if(!cartao){prev.textContent='';return;}
  const fm=getFaturaMonth(dateVal,cartao);
  if(!fm){prev.textContent='';return;}
  prev.textContent='→ Fatura de '+MONTHS[fm.month]+'/'+fm.year;
}

async function openGastoNumpad(){
  const valInp=document.getElementById('cg-val');
  const cur=valInp?.dataset?.rawExpr||valInp?.value||'';
  const result=await openNumpad(cur);
  if(result!==null&&valInp){
    if(hasOp(result)){
      const r=evalExpr(result);
      if(!isNaN(r)){
        valInp.dataset.rawExpr=result;
        valInp.value=result;
        const prev=document.getElementById('cg-val-preview');
        if(prev){prev.textContent='= '+fmt(r);prev.style.color='var(--green)';}
      }
    }else{
      valInp.dataset.rawExpr='';
      valInp.value=result;
      const prev=document.getElementById('cg-val-preview');
      if(prev)prev.textContent='';
    }
  }
}

function onCgValInput(){
  const inp=document.getElementById('cg-val');
  if(inp&&inp.dataset)inp.dataset.rawExpr='';
  const raw=inp?.value||'';
  const prev=document.getElementById('cg-val-preview');
  if(!prev)return;
  if(hasOp(raw)){const r=evalExpr(raw);prev.textContent=isNaN(r)?'⚠ inválido':'= '+fmt(r);prev.style.color=isNaN(r)?'var(--red)':'var(--green)';}
  else prev.textContent='';
}
function getGastoVal(){
  const inp=document.getElementById('cg-val');
  const fieldVal=(inp?.value||'').trim();
  const storedExpr=inp?.dataset?.rawExpr||'';
  const exprToEval=storedExpr||fieldVal;
  let val=NaN;
  if(hasOp(exprToEval))val=evalExpr(exprToEval);
  if(isNaN(val))val=parseFloat(fieldVal.replace(',','.'));
  if(isNaN(val))val=parseFloat(fieldVal.replace('.','').replace(',','.'));
  return val;
}


function toggleGastoParcela(checked){
  const area=document.getElementById('cg-parcela-area');
  if(area)area.style.display=checked?'block':'none';
}
function addGastoSubitem(name='',value='',repeat=1,sgid='',skip=[],startMonth=null,startYear=null){
  const area=document.getElementById('cg-subitems-area');
  if(!area)return;
  const row=document.createElement('div');
  row.className='subitem-row';
  const hasRepeat=repeat>0;
  const sid=hasRepeat?(sgid||Date.now().toString(36)+Math.random().toString(36).slice(2,5)):'';
  if(sid)row.dataset.sgid=sid;
  if(skip&&skip.length)row.dataset.skip=JSON.stringify(skip);
  if(startMonth!=null)row.dataset.startMonth=String(startMonth);
  if(startYear!=null)row.dataset.startYear=String(startYear);
  row.innerHTML=`
    <input class="sub-name" placeholder="Nome" value="${name}">
    <input class="sub-value" type="number" step="0.01" placeholder="0,00" value="${value}" oninput="updateGastoSubtotal()">
    <button type="button" class="subitem-repeat${hasRepeat?' active':''}" title="N meses" onclick="toggleGastoSubitemRepeat(this)">⟳</button>
    <input class="sub-repeat" type="number" min="1" max="99" placeholder="N" value="${hasRepeat?repeat:''}" oninput="updateGastoSubtotal()" style="${hasRepeat?'':'display:none'}">
    <button type="button" class="subitem-remove" onclick="removeGastoSubitem(this)">✕</button>
  `;
  area.appendChild(row);
  updateGastoSubtotal();
}
function toggleGastoSubitemRepeat(btn){
  const row=btn.parentElement;
  const inp=row.querySelector('.sub-repeat');
  const active=btn.classList.toggle('active');
  inp.style.display=active?'block':'none';
  if(!active){inp.value='';delete row.dataset.sgid;updateGastoSubtotal();}
  else{if(!row.dataset.sgid)row.dataset.sgid=Date.now().toString(36)+Math.random().toString(36).slice(2,5);inp.value='2';inp.focus();updateGastoSubtotal();}
}
function removeGastoSubitem(btn){
  const row=btn.parentElement;
  const sgid=row.dataset.sgid||'';
  const modal=document.getElementById('modal-content');
  const hasRepeatCtx=modal&&modal.dataset.subRepeatStart&&modal.dataset.editingGastoId;
  const repVal=parseInt(row.querySelector('.sub-repeat')?.value)||1;
  if(!sgid||!hasRepeatCtx||repVal<=1){
    const nm=row.querySelector('.sub-name').value.trim()||'este subitem';
    showConfirm('Remover subitem','Remover "'+nm+'"?',[
      {label:'Remover',cls:'btn-danger',action:()=>{row.remove();updateGastoSubtotal();}},
      {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
    ]);
    return;
  }
  const srs=JSON.parse(modal.dataset.subRepeatStart);
  // usar start individual do subitem se disponivel
  const rowSM=row.dataset.startMonth!=null?parseInt(row.dataset.startMonth):srs.month;
  const rowSY=row.dataset.startYear!=null?parseInt(row.dataset.startYear):srs.year;
  const elapsed=(curYear*12+curMonth)-(rowSY*12+rowSM);
  const name=row.querySelector('.sub-name').value.trim()||'este subitem';
  const rep=parseInt(row.querySelector('.sub-repeat')?.value)||0;
  const remaining=Math.max(0,rep-elapsed);
  const remainMsg=remaining>0?remaining+' mês(es) restante(s).':'Expira neste mês.';
  showConfirm('Remover subitem','"'+name+'" — '+remainMsg,[
    {label:'Só este mês',cls:'btn-ghost',action:()=>{
      const skips=row.dataset.skip?JSON.parse(row.dataset.skip):[];
      skips.push(elapsed);
      row.dataset.skip=JSON.stringify(skips);
      row.style.opacity='0.5';
      updateGastoSubtotal();
    }},
    {label:'Este e seguintes',cls:'btn-ghost',action:()=>{
      row.dataset.repeatCap=String(elapsed);
      row.style.opacity='0.5';
      btn.disabled=true;
      updateGastoSubtotal();
    }},
    {label:'Todos os meses',cls:'btn-danger',action:()=>{
      row.remove();updateGastoSubtotal();
    }},
    {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
  ]);
}
function updateGastoSubtotal(){
  const area=document.getElementById('cg-subitems-area');
  if(!area)return;
  const rows=[...area.querySelectorAll('.subitem-row')];
  const total=rows.reduce((s,r)=>s+(parseFloat(r.querySelector('.sub-value')?.value)||0),0);
  if(rows.length>0&&total>0){const v=document.getElementById('cg-val');if(v&&!v.dataset.rawExpr)v.value=total.toFixed(2);}
}
function getRawGastoSubitems(){
  const area=document.getElementById('cg-subitems-area');
  if(!area)return[];
  return[...area.querySelectorAll('.subitem-row')].map(r=>{
    const name=r.querySelector('.sub-name').value.trim();
    const value=parseFloat(r.querySelector('.sub-value').value)||0;
    if(!name||value<=0)return null;
    const repeatInp=r.querySelector('.sub-repeat');
    const repeatActive=repeatInp&&repeatInp.style.display!=='none';
    let repeat=repeatActive?Math.max(1,parseInt(repeatInp.value)||1):1; // 1=unico (so esta fatura)
    const sgid=r.dataset.sgid||'';
    if(r.dataset.repeatCap!=null)repeat=parseInt(r.dataset.repeatCap)||1;
    const skip=r.dataset.skip?JSON.parse(r.dataset.skip):[];
    const startMonth=r.dataset.startMonth!=null?parseInt(r.dataset.startMonth):null;
    const startYear=r.dataset.startYear!=null?parseInt(r.dataset.startYear):null;
    const hasStart=startMonth!=null&&startYear!=null;
    // repeat sempre > 0 nos gastos (1=unico, N=N meses)
    const base=skip.length?{name,value,repeat,sgid,skip}:{name,value,repeat,sgid};
    return hasStart?{...base,startMonth,startYear}:base;
  }).filter(Boolean);
}
async function saveGasto(){
  const name=document.getElementById('cg-name')?.value.trim();
  const val=getGastoVal();
  const date=document.getElementById('cg-date')?.value||todayISO();
  const obs=document.getElementById('cg-obs')?.value.trim()||'';
  const cartaoId=parseInt(document.getElementById('cg-cartao-id')?.value);
  if(!name||!val||isNaN(val)||val<=0){toast('Preencha nome e valor!','var(--red)');return;}
  const cgRawExpr=(()=>{const inp=document.getElementById('cg-val');return inp?.dataset?.rawExpr||(hasOp(inp?.value||'')?inp.value:null);})();
  const parcelado=document.getElementById('cg-parcela-toggle')?.checked;
  const pnum=parseInt(document.getElementById('cg-pnum')?.value)||1;
  const ptotal=parseInt(document.getElementById('cg-ptotal')?.value)||1;
  const allCartoes=await cartoesAll();
  const cartaoObj=allCartoes.find(c=>c.id===cartaoId)||{fechamento:1,vencimento:1};
  if(parcelado&&ptotal>1){
    if(pnum>ptotal){toast('Parcela atual > total!','var(--red)');return;}
    let d=date;
    const groupId=Date.now()+'_'+Math.random().toString(36).slice(2,7);
    for(let i=pnum-1;i<ptotal;i++){
      const label=name+' '+(i+1)+'/'+ptotal;
      await gastosAdd({name:label,value:val,rawExpr:cgRawExpr,date:d,obs,cartaoId,
        parcela:i+1,totalParcelas:ptotal,groupId,createdAt:Date.now()});
      const nd=addMonths(d,1);if(nd)d=nd;
    }
    toast((ptotal-pnum+1)+' parcelas adicionadas!','var(--purple)');
  }else{
    const gsubs=getRawGastoSubitems();
    const hasSubRep=gsubs.length>0;
    const fatM=getFaturaMonth(date,cartaoObj);
    const srs=hasSubRep&&fatM?{month:fatM.month,year:fatM.year}:null;
    const gval=gsubs.length?gsubs.reduce((t,s)=>t+s.value,0):val;
    await gastosAdd({name,value:gval,rawExpr:cgRawExpr,date,obs,cartaoId,
      subitems:gsubs.length?gsubs:undefined,
      subRepeatStart:srs||undefined,
      createdAt:Date.now()});
    toast('Gasto adicionado!');
  }
  closeModal();renderCards();refreshBudgetCartoes();
}

async function saveGastoEdit(id){
  const name=document.getElementById('cg-name')?.value.trim();
  const val=getGastoVal();
  const date=document.getElementById('cg-date')?.value||todayISO();
  const obs=document.getElementById('cg-obs')?.value.trim()||'';
  if(!name||!val||isNaN(val)||val<=0){toast('Preencha nome e valor!','var(--red)');return;}
  const cgRawExpr=(()=>{const inp=document.getElementById('cg-val');return inp?.dataset?.rawExpr||(hasOp(inp?.value||'')?inp.value:null);})();
  const parcelado=document.getElementById('cg-parcela-toggle')?.checked;
  const pnum=parseInt(document.getElementById('cg-pnum')?.value)||1;
  const ptotal=parseInt(document.getElementById('cg-ptotal')?.value)||1;
  const all=await gastosAll();
  const existing=all.find(g=>g.id===id);
  if(!existing)return;
  const allCartoesEdit=await cartoesAll();
  const cartaoEdit=allCartoesEdit.find(c=>c.id===existing.cartaoId)||{fechamento:1,vencimento:1};
  // If has groupId (series), offer to update this + following
  if(existing.groupId){
    const future=all.filter(g=>g.groupId===existing.groupId&&
      (g.date||'')>=(existing.date||'')&&g.id!==existing.id);
    if(future.length>0){
      closeModal();
      showConfirm('Editar gasto parcelado','Este gasto faz parte de uma série de parcelas.',[
        {label:'Apenas esta parcela',cls:'btn-ghost',action:async()=>{
          await gastosPut({...existing,name,value:val,rawExpr:cgRawExpr,date,obs,
            parcela:parcelado?pnum:existing.parcela,
            totalParcelas:parcelado?ptotal:existing.totalParcelas});
          toast('Parcela atualizada!');renderCards();refreshBudgetCartoes();
        }},
        {label:'Esta e seguintes',cls:'btn-primary',action:async()=>{
          // Delete this and future, recreate series from this parcela forward
          await gastosDel(id);
          for(const g of future)await gastosDel(g.id);
          const newGroupId=Date.now()+'_'+Math.random().toString(36).slice(2,7);
          const remaining=parcelado?ptotal-pnum+1:existing.totalParcelas-(existing.parcela||1)+1;
          const startParcela=parcelado?pnum:(existing.parcela||1);
          const newTotal=parcelado?ptotal:existing.totalParcelas;
          // Strip any existing "N/M" suffix from name before relabeling
          const baseName=name.replace(/\s+\d+\/\d+$/, '').trim();
          let d=date;
          for(let i=0;i<remaining;i++){
            const label=baseName+' '+(startParcela+i)+'/'+(newTotal||remaining);
            await gastosAdd({name:label,value:val,rawExpr:cgRawExpr,date:d,obs,
              cartaoId:existing.cartaoId,parcela:startParcela+i,
              totalParcelas:newTotal||remaining,groupId:newGroupId,createdAt:Date.now()});
            const nd=addMonths(d,1);if(nd)d=nd;
          }
          toast('Série atualizada!','var(--teal)');renderCards();refreshBudgetCartoes();
        }},
        {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
      ]);
      return;
    }
  }
  // Single gasto (no series or no future)
  const gsubs2Raw=getRawGastoSubitems();
  const hasSubRep2=gsubs2Raw.length>0;
  const faturaEditAtual={month:curMonth,year:curYear};
  const defaultStart=existing.subRepeatStart||faturaEditAtual;
  // 1. Resolver start de cada subitem do DOM
  const bankBySgid=new Map((existing.subitems||[]).filter(s=>s.sgid).map(s=>[s.sgid,s]));
  const bankByKey=new Map((existing.subitems||[]).map(s=>[(s.name||'')+'|'+(s.value||0),s]));
  const gsubs2=gsubs2Raw.map(s=>{
    const bankSub=(s.sgid&&bankBySgid.get(s.sgid))||bankByKey.get((s.name||'')+'|'+(s.value||0));
    if(bankSub){
      const sM=bankSub.startMonth!=null?bankSub.startMonth:defaultStart.month;
      const sY=bankSub.startYear!=null?bankSub.startYear:defaultStart.year;
      return{...s,startMonth:sM,startYear:sY};
    }
    if(s.repeat>0)return{...s,startMonth:faturaEditAtual.month,startYear:faturaEditAtual.year};
    return s;
  });
  // 2. Subitems encerrados do banco (repeat>0 e expirado pelo seu start individual)
  // nao incluir os que ja estao no DOM (evita duplicata)
  const domSgids=new Set(gsubs2.map(s=>s.sgid).filter(Boolean));
  const domKeys=new Set(gsubs2.map(s=>(s.name||'')+'|'+(s.value||0)));
  const ended=(existing.subitems||[]).filter(s=>{
    const sRep=s.repeat||1; // subitems antigos sem repeat tratados como repeat=1
    if(sRep===0)return false;
    if(s.sgid&&domSgids.has(s.sgid))return false; // ja no DOM
    if(domKeys.has((s.name||'')+'|'+(s.value||0)))return false; // ja no DOM por chave
    const sM=s.startMonth!=null?s.startMonth:defaultStart.month;
    const sY=s.startYear!=null?s.startYear:defaultStart.year;
    const elap=(curYear*12+curMonth)-(sY*12+sM);
    return elap>=sRep; // expirado
  });
  const finalGsubs=[...gsubs2,...ended];
  // 3. subRepeatStart = start mais antigo
  const srs2=(()=>{
    if(!hasSubRep2)return null;
    const candidates=finalGsubs.filter(s=>s.startMonth!=null).map(s=>({month:s.startMonth,year:s.startYear}));
    if(existing.subRepeatStart)candidates.push(existing.subRepeatStart);
    if(!candidates.length)return faturaEditAtual;
    return candidates.reduce((min,c)=>c.year*12+c.month<min.year*12+min.month?c:min);
  })();
  const activeNow=srs2?getActiveSubitems(finalGsubs,srs2.month,srs2.year,curMonth,curYear):finalGsubs;
  const gval2=activeNow.length?activeNow.reduce((t,s)=>t+s.value,0):val;
  await gastosPut({...existing,name,value:gval2,rawExpr:cgRawExpr,date,obs,
    subitems:finalGsubs.length?finalGsubs:undefined,
    subRepeatStart:srs2||existing.subRepeatStart||undefined,
    parcela:parcelado?pnum:existing.parcela||null,
    totalParcelas:parcelado?ptotal:existing.totalParcelas||null});
  toast('Gasto atualizado!');
  closeModal();renderCards();refreshBudgetCartoes();
}

async function deleteGasto(id){
  const all=await gastosAll();
  const item=all.find(g=>g.id===id);
  if(!item){await gastosDel(id);renderCards();refreshBudgetCartoes();return;}
  if(item.groupId){
    const future=all.filter(g=>g.groupId===item.groupId&&(g.date||'')>=(item.date||'')&&g.id!==item.id);
    if(future.length>0){
      showConfirm('Remover parcela','Este gasto faz parte de uma série.',[
        {label:'Remover só esta',cls:'btn-ghost',action:async()=>{
          await gastosDel(id);toast('Parcela removida','var(--red)');
          renderCards();refreshBudgetCartoes();
        }},
        {label:'Esta e seguintes ('+( future.length+1)+')',cls:'btn-danger',action:async()=>{
          await gastosDel(id);
          for(const g of future)await gastosDel(g.id);
          toast('Parcelas removidas','var(--red)');renderCards();refreshBudgetCartoes();
        }},
        {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
      ]);
      return;
    }
  }
  if(!confirm('Remover este gasto?'))return;
  await gastosDel(id);toast('Gasto removido','var(--red)');
  renderCards();refreshBudgetCartoes();
}

async function editGasto(cartaoId, gastoId){
  const cartoes=await cartoesAll();
  const gastos=await gastosAll();
  const cartao=cartoes.find(c=>c.id===cartaoId);
  const gasto=gastos.find(g=>g.id===gastoId);
  if(cartao&&gasto)showAddGastoModal(cartaoId,cartao,gasto);
}
async function editCartao(cartaoId){
  const cartoes=await cartoesAll();
  const cartao=cartoes.find(c=>c.id===cartaoId);
  if(cartao)showAddCartaoModal(cartao);
}

function showAddRecorrenteModal(cartaoId, recorrente){
  const isEdit=!!recorrente;
  const r=recorrente||{};
  openModal(`
    <div class="modal-title">${isEdit?'Editar':'Nova'} Recorrência</div>
    <div class="form-group">
      <label>Nome</label>
      <input id="cr-name" placeholder="Ex: Assinaturas" value="${r.name||''}">
    </div>
    <div class="form-group">
      <label>Valor <span style="font-weight:400;color:var(--text3)">(calculado pelos subitens se preenchidos)</span></label>
      <input id="cr-val" type="number" step="0.01" placeholder="0,00" value="${r.value||''}">
    </div>
    <div class="form-group">
      <label>Subitens</label>
      <div id="cr-subitems-area"></div>
      <button type="button" onclick="addCrSubitem()" style="margin-top:6px;background:none;border:1px dashed var(--border);color:var(--text3);border-radius:var(--radius-sm);padding:6px 12px;font-size:13px;cursor:pointer;width:100%">+ subitem</button>
    </div>
    <div class="form-group">
      <label>Observação</label>
      <input id="cr-obs" placeholder="Opcional" value="${r.obs||''}">
    </div>
    <input type="hidden" id="cr-cartao-id" value="${cartaoId}">
    <div class="btn-row" style="margin-top:4px">
      <button class="btn btn-primary" style="flex:1" onclick="">${isEdit?'Salvar':'Adicionar'}</button>
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
    </div>`);
  setTimeout(()=>{
    if(isEdit&&r.subitems?.length)r.subitems.forEach(s=>addCrSubitem(s.name,s.value));
    const saveBtn=document.querySelector('#modal-content .btn-primary');
    if(saveBtn)saveBtn.onclick=isEdit?()=>saveRecorrenteEdit(r.id):saveRecorrente;
  },50);
}
function addCrSubitem(name='',value=''){
  const area=document.getElementById('cr-subitems-area');
  if(!area)return;
  const row=document.createElement('div');
  row.className='subitem-row';
  row.innerHTML=`
    <input class="sub-name" placeholder="Nome" value="${name}">
    <input class="sub-value" type="number" step="0.01" placeholder="0,00" value="${value}" oninput="updateCrSubtotal()">
    <button type="button" class="subitem-repeat" style="visibility:hidden"></button>
    <input class="sub-repeat" style="display:none">
    <button type="button" class="subitem-remove" onclick="this.parentElement.remove();updateCrSubtotal()">✕</button>
  `;
  area.appendChild(row);
  updateCrSubtotal();
}
function updateCrSubtotal(){
  const area=document.getElementById('cr-subitems-area');
  if(!area)return;
  const total=[...area.querySelectorAll('.subitem-row')].reduce((s,r)=>s+(parseFloat(r.querySelector('.sub-value')?.value)||0),0);
  if(total>0){const v=document.getElementById('cr-val');if(v)v.value=total.toFixed(2);}
}
function getCrSubitems(){
  const area=document.getElementById('cr-subitems-area');
  if(!area)return[];
  return[...area.querySelectorAll('.subitem-row')].map(r=>{
    const name=r.querySelector('.sub-name').value.trim();
    const value=parseFloat(r.querySelector('.sub-value').value)||0;
    return name&&value>0?{name,value}:null;
  }).filter(Boolean);
}
async function saveRecorrente(){
  const cartaoId=parseInt(document.getElementById('cr-cartao-id')?.value);
  const name=document.getElementById('cr-name')?.value.trim();
  const subitems=getCrSubitems();
  const value=subitems.length?subitems.reduce((t,s)=>t+s.value,0):parseFloat(document.getElementById('cr-val')?.value)||0;
  const obs=document.getElementById('cr-obs')?.value.trim()||'';
  if(!name||value<=0){toast('Preencha nome e valor!','var(--red)');return;}
  await recorrentesAdd({cartaoId,name,value,subitems,obs,createdAt:Date.now()});
  toast('Recorrência adicionada!','var(--teal)');
  closeModal();renderCards();
}
async function saveRecorrenteEdit(id){
  const name=document.getElementById('cr-name')?.value.trim();
  const subitems=getCrSubitems();
  const value=subitems.length?subitems.reduce((t,s)=>t+s.value,0):parseFloat(document.getElementById('cr-val')?.value)||0;
  const obs=document.getElementById('cr-obs')?.value.trim()||'';
  if(!name||value<=0){toast('Preencha nome e valor!','var(--red)');return;}
  const all=await recorrentesAll();
  const existing=all.find(r=>r.id===id);
  if(!existing)return;
  await recorrentesPut({...existing,name,value,subitems,obs});
  toast('Atualizado!','var(--teal)');
  closeModal();renderCards();
}
async function editRecorrente(id){
  const all=await recorrentesAll();
  const rec=all.find(r=>r.id===id);
  if(rec)showAddRecorrenteModal(rec.cartaoId,rec);
}
async function deleteRecorrente(id){
  showConfirm('Remover recorrência','Será removida de todas as faturas futuras.',[
    {label:'Remover',cls:'btn-danger',action:async()=>{
      await recorrentesDel(id);
      toast('Removida','var(--red)');
      renderCards();
    }},
    {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
  ]);
}
// Retorna valor do gasto para a fatura indicada, considerando subRepeatStart
function gastoValueForFatura(gasto, fatMonth, fatYear){
  if(!gasto.subRepeatStart||!gasto.subitems?.length)return{value:gasto.value,subitems:gasto.subitems||[]};
  const srs=gasto.subRepeatStart;
  const activeSubs=getActiveSubitems(gasto.subitems,srs.month,srs.year,fatMonth,fatYear);
  if(!activeSubs.length)return null; // nenhum subitem ativo = gasto some
  return{value:activeSubs.reduce((t,s)=>t+s.value,0),subitems:activeSubs};
}
// Calcula total usado no limite: fatura atual + todas as faturas futuras com gastos
async function calcLimiteUsado(cartao, allGastos){
  const hojeKey=curYear*100+curMonth;
  let total=0;
  const gastosDoCarta=allGastos.filter(g=>g.cartaoId===cartao.id);
  // usar um Set para evitar contar o mesmo gasto+fatura duas vezes
  const seen=new Set();
  for(const g of gastosDoCarta){
    const fm=getFaturaMonth(g.date,cartao);
    if(!fm)continue;
    if(!g.subRepeatStart||!g.subitems?.length){
      // gasto simples: conta so na fatura original
      const key=fm.year*100+fm.month;
      if(key<hojeKey)continue;
      const res=gastoValueForFatura(g,fm.month,fm.year);
      if(res)total+=res.value;
    }else{
      // gasto com subRepeatStart: calcular maxRepeat e iterar sobre faturas futuras
      const srs=g.subRepeatStart;
      const maxRep=g.subitems.reduce((m,s)=>Math.max(m,s.repeat||1),1);
      for(let i=0;i<maxRep;i++){
        const rawM=srs.month+i;
        const fatM=(rawM%12+12)%12;
        const fatY=srs.year+Math.floor(rawM/12);
        const key=fatY*100+fatM;
        if(key<hojeKey)continue;
        const seenKey=g.id+'_'+key;
        if(seen.has(seenKey))continue;
        seen.add(seenKey);
        const res=gastoValueForFatura(g,fatM,fatY);
        if(res)total+=res.value;
      }
    }
  }
  // somar recorrentes do cartao (aparecem em todas as faturas futuras)
  const allRec=await recorrentesAll();
  for(const rec of allRec.filter(r=>r.cartaoId===cartao.id))total+=rec.value;
  return total;
}
async function renderCards(){
  const cartoes=await cartoesAll();
  const pessoas=await pessoasAll();
  const pessoaMap=Object.fromEntries(pessoas.map(p=>[p.id,p]));
  const allGastos=await gastosAll();
  const el=document.getElementById('cards-list');
  if(!el)return;
  if(!cartoes.length){
    el.innerHTML='<div class="empty"><div class="empty-icon">💳</div>Nenhum cartão cadastrado.<br>Toque em <strong>+ Cartão</strong> para começar.</div>';
    return;
  }
  let html='';
  for(const cartao of cartoes){
    // Show fatura for the selected period
    const fatura={month:curMonth,year:curYear};
    const gastosFaturaRaw=allGastos.filter(g=>{
      if(g.cartaoId!==cartao.id)return false;
      const fm=getFaturaMonth(g.date,cartao);
      if(!fm)return false;
      // gasto da fatura exata
      if(fm.month===fatura.month&&fm.year===fatura.year)return true;
      // gasto com subRepeatStart: aparece em faturas futuras se ainda tem subitems ativos
      if(g.subRepeatStart&&g.subitems?.length){
        const activeSubs=getActiveSubitems(g.subitems,g.subRepeatStart.month,g.subRepeatStart.year,fatura.month,fatura.year);
        return activeSubs.length>0;
      }
      return false;
    });
    // aplicar subRepeatStart: calcular valor/subitems ativos para esta fatura
    const gastosFatura=gastosFaturaRaw.map(g=>{
      const res=gastoValueForFatura(g,fatura.month,fatura.year);
      if(!res)return null;
      return{...g,value:res.value,_activeSubs:res.subitems};
    }).filter(Boolean);
    const total=gastosFatura.reduce((s,g)=>s+g.value,0);
    const allRecorrentes2=await recorrentesAll();
    const recDoCartao2=allRecorrentes2.filter(r=>r.cartaoId===cartao.id);
    const totalRec2=recDoCartao2.reduce((s,r)=>s+r.value,0);
    const totalComRec=total+totalRec2;
    const limiteUsado=cartao.limite?await calcLimiteUsado(cartao,allGastos):null;
    const limitePct=cartao.limite?Math.min(100,limiteUsado/cartao.limite*100):0;
    const limiteColor=limitePct>=90?'var(--red)':limitePct>=70?'var(--amber)':'var(--green)';
    const pessoa=cartao.pessoaId?pessoaMap[cartao.pessoaId]:null;
    html+=`<div class="card-item">
      <div class="card-header">
        <div class="card-logo" style="background:${cartao.color}">${cartao.name.substring(0,3).toUpperCase()}</div>
        <div style="flex:1">
          <div class="card-name">${cartao.name}</div>
          <div class="card-dates">Fecha dia ${cartao.fechamento} · Vence dia ${cartao.vencimento} · Fatura ${MONTHS[fatura.month].substring(0,3)}/${fatura.year}</div>
          ${pessoa?'<div style="margin-top:3px">'+personAvatarHtml(pessoa,14)+' <span style="font-size:11px;color:var(--text3)">'+pessoa.nome+'</span></div>':''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="tx-btn edit" onclick="editCartao(${cartao.id})">✏️</button>
          <button class="tx-btn del" onclick="deleteCartao(${cartao.id})">✕</button>
        </div>
      </div>
      <div class="card-total${totalComRec===0?' zero':''}">${totalComRec===0?'R$ 0,00':'-'+fmt(totalComRec)}</div>
      ${cartao.limite?'<div style="margin-top:6px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text3);margin-bottom:4px">'+
        '<span>Usado: '+fmt(limiteUsado)+' / '+fmt(cartao.limite)+'</span>'+
        '<span style="color:'+limiteColor+';font-weight:600">Disponível: '+(cartao.limite-limiteUsado<0?'-':'')+fmt(Math.abs(cartao.limite-limiteUsado))+'</span>'+
        '</div>'+
        '<div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">'+
        '<div style="height:100%;border-radius:3px;background:'+limiteColor+';transition:width .4s;width:'+limitePct+'%"></div>'+
        '</div>'+
        (limitePct>=90?'<div style="font-size:11px;color:var(--red);margin-top:3px">⚠️ Próximo do limite</div>':'')+
        '</div>':''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;margin-bottom:8px">
        <div style="display:flex;gap:6px;align-items:center">
          <span style="font-size:12px;color:var(--text3)">${gastosFatura.length} gasto(s)</span>
          ${recDoCartao2.length===0?'<button class="btn btn-ghost btn-sm" onclick="showAddRecorrenteModal('+cartao.id+')">+ Recorrência</button>':''}
        </div>
        <button class="btn btn-primary btn-sm" onclick="showAddGastoModal(${cartao.id},${JSON.stringify(cartao).replace(/"/g,'&quot;')})">+ Gasto</button>
      </div>
      ${recDoCartao2.length?'<div style="margin-top:12px;margin-bottom:6px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<span style="font-size:12px;font-weight:600;color:var(--text2)">🔄 Recorrências</span>'+
        '<button class="btn btn-ghost btn-sm" onclick="showAddRecorrenteModal('+cartao.id+')">+ Nova</button>'+
        '</div>'+
        recDoCartao2.map(r=>{
          const subHtmlR=r.subitems&&r.subitems.length?renderSubitemsHtml(r.subitems):'';
          return '<div class="card-gasto-item card-gasto-col" style="border-left:3px solid var(--teal)">'+
            '<div style="display:flex;align-items:center;gap:10px">'+
            '<div class="card-gasto-info">'+
            '<div class="card-gasto-name">'+r.name+'</div>'+
            (r.obs?'<div class="card-gasto-meta"><span>💬 '+r.obs+'</span></div>':'')+
            '</div>'+
            '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'+
            '<div class="card-gasto-val">-'+fmt(r.value)+'</div>'+
            '<button class="tx-btn edit" onclick="editRecorrente('+r.id+')">✏️</button>'+
            '<button class="tx-btn del" onclick="deleteRecorrente('+r.id+')">✕</button>'+
            '</div></div>'+
            (subHtmlR?'<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">'+subHtmlR+'</div>':'')+
            '</div>';
        }).join('')+
        '</div>':''}\r\n      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;margin-bottom:4px">
        <span style="font-size:12px;color:var(--text3)">🛒 Gastos da fatura (${gastosFatura.length})</span>
      </div>
      ${gastosFatura.length?gastosFatura.sort((a,b)=>(b.date||'')>(a.date||'')?-1:1).map(g=>{
        const subHtml=g._activeSubs&&g._activeSubs.length?renderSubitemsHtml(g._activeSubs):'';
        return '<div class="card-gasto-item card-gasto-col">'+
          '<div style="display:flex;align-items:center;gap:10px">'+
          '<div class="card-gasto-info">'+
          '<div class="card-gasto-name">'+g.name+'</div>'+
          '<div class="card-gasto-meta">'+
          (g.date?'<span>📅 '+fmtDate(g.date)+'</span>':'')+
          (g.obs?'<span>💬 '+g.obs+'</span>':'')+
          '</div></div>'+
          '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'+
          '<div class="card-gasto-val">-'+fmt(g.value)+'</div>'+
          '<button class="tx-btn edit" onclick="editGasto('+cartao.id+','+g.id+')">✏️</button>'+
          '<button class="tx-btn del" onclick="deleteGasto('+g.id+')">✕</button>'+
          '</div></div>'+
          (subHtml?'<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">'+subHtml+'</div>':'')+
          '</div>';
      }).join(''):''}
    </div>`;
  }
  el.innerHTML=html;
}

async function refreshBudgetCartoes(){
  // Called whenever gastos change - updates budget virtual items
  // Budget page re-renders if active
  const p=document.querySelector('.page.active');
  if(p&&p.id==='page-budget')renderBudget();
}

async function getCartaoBudgetItems(targetMonth, targetYear){
  const tm = (targetMonth !== undefined) ? targetMonth : curMonth;
  const ty = (targetYear !== undefined) ? targetYear : curYear;
  const cartoes = await cartoesAll();
  const allGastos = await gastosAll();
  const pessoas = await pessoasAll();
  const pessoaMap = Object.fromEntries(pessoas.map(p=>[p.id,p]));
  const result = [];
  for(const cartao of cartoes){
    // Get gastos whose fatura period is tm/ty (inclui subRepeatStart ativos)
    const gastosFatura = allGastos.filter(g=>{
      if(g.cartaoId !== cartao.id) return false;
      const fm = getFaturaMonth(g.date, cartao);
      if(!fm) return false;
      if(fm.month === tm && fm.year === ty) return true;
      // gasto com subRepeatStart: incluir se tem subitems ativos neste mes
      if(g.subRepeatStart && g.subitems?.length){
        const activeSubs=getActiveSubitems(g.subitems,g.subRepeatStart.month,g.subRepeatStart.year,tm,ty);
        return activeSubs.length>0;
      }
      return false;
    });
    // aplicar subRepeatStart nos gastos da fatura
    const gastosAtivos=gastosFatura.map(g=>{
      const res=gastoValueForFatura(g,tm,ty);
      if(!res)return null;
      return{...g,value:res.value};
    }).filter(Boolean);
    const allRecorrentes=await recorrentesAll();
    const recDoCartao=allRecorrentes.filter(r=>r.cartaoId===cartao.id);
    const totalGastos=gastosAtivos.reduce((s,g)=>s+g.value,0);
    const totalRec=recDoCartao.reduce((s,r)=>s+r.value,0);
    const total=totalGastos+totalRec;
    const vencDate = getFaturaVencimento(ty, tm, cartao);
    const obsLines = [...gastosAtivos,...recDoCartao].map(g=>g.name+(g.value?' ('+fmt(g.value)+')':'')).join(', ');
    const pessoa = cartao.pessoaId ? pessoaMap[cartao.pessoaId] : null;
    result.push({
      _isCartao: true,
      _cartaoId: cartao.id,
      _cartao: cartao,
      _gastos: [...gastosAtivos,...recDoCartao.map(r=>({...r,_isRecorrente:true}))],
      _pessoa: pessoa,
      id: 'cartao_'+cartao.id,
      name: cartao.name,
      value: total,
      type: 'credit',
      dueDay: cartao.vencimento,
      dueDate: vencDate,
      obs: obsLines,
      pessoaId: cartao.pessoaId,
      faturaMonth: tm,
      faturaYear: ty,
    });
  }
  return result.filter(r=>r.value>0);
}