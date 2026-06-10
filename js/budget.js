function onBudgetTypeChange(){
  const t=document.getElementById('b-type')?.value;
  const recArea=document.getElementById('b-recurrence-area');
  if(recArea)recArea.style.display=(t==='variable'||t==='income')?'block':'none';
  const recurSel=document.getElementById('b-recur');
  if(recurSel&&!recurSel.dataset.userChanged){
    recurSel.value=t==='income'?'always':'once';
    onBudgetRecurChange();
  }
  const hint=document.getElementById('b-type-hint');
  if(hint)hint.textContent='';
}
function onBudgetRecurChange(){
  const sel=document.getElementById('b-recur');
  const v=sel?.value;
  if(sel)sel.dataset.userChanged='1';
  const instArea=document.getElementById('b-installments-area');
  if(instArea)instArea.style.display=v==='installments'?'block':'none';
  const hint=document.getElementById('b-type-hint');
  if(hint)hint.textContent=v==='always'?'Aparece automaticamente em todos os meses':'';
}
function getBudgetVal(){
  const inp=document.getElementById('b-val');
  const fieldVal=(inp?.value||'').trim();
  const storedExpr=inp?.dataset?.rawExpr||'';
  const exprToEval=storedExpr||fieldVal;
  let val=NaN;
  if(hasOp(exprToEval)){val=evalExpr(exprToEval);}
  if(isNaN(val)){val=parseFloat(fieldVal.replace(',','.'));}
  if(isNaN(val)){val=parseFloat(fieldVal.replace('.','').replace(',','.'));}
  return val;
}
function getBudgetRawExpr(){
  const inp=document.getElementById('b-val');
  const storedExpr=inp?.dataset?.rawExpr||'';
  const fieldVal=(inp?.value||'').trim();
  const expr=storedExpr||(hasOp(fieldVal)?fieldVal:'');
  return expr||null;
}
function onBudgetValInput(){
  clearFieldError('b-val');
  const inp=document.getElementById('b-val');
  if(inp&&inp.dataset)inp.dataset.rawExpr='';
  const raw=inp?.value||'';
  const prev=document.getElementById('b-val-preview');
  if(!prev)return;
  if(hasOp(raw)){const r=evalExpr(raw);prev.textContent=isNaN(r)?'⚠ inválido':'= '+fmt(r);prev.style.color=isNaN(r)?'var(--red)':'var(--green)';}
  else prev.textContent='';
}
function onBudgetDelayedToggle(){
  const on=document.getElementById('b-delayed-toggle')?.checked;
  const cfg=document.getElementById('b-delayed-config');
  if(cfg)cfg.style.display=on?'block':'none';
}
function getBudgetDelayed(){
  const on=document.getElementById('b-delayed-toggle')?.checked;
  if(!on)return null;
  const toVal=document.getElementById('b-delayed-to')?.value||'';
  const parts=toVal.split('_');
  const tm=parseInt(parts[0]),ty=parseInt(parts[1]);
  // se nao tem select (novo item) ou valor invalido, retorna so o flag
  if(isNaN(tm))return{noDestino:true};
  return{to:{month:tm,year:ty}};
}
function onBudgetDueOffsetChange(){
  const day=parseInt(document.getElementById('b-day')?.value)||null;
  const offset=parseInt(document.getElementById('b-due-offset')?.value)||0;
  const prev=document.getElementById('b-due-preview');
  if(!prev)return;
  if(day){const rawM=curMonth+offset;const dm=(rawM%12+12)%12;const dy=curYear+Math.floor(rawM/12);prev.textContent='📅 '+String(Math.min(day,28)).padStart(2,'0')+'/'+MONTHS[dm].slice(0,3)+'/'+dy;}else{prev.textContent='';}
}
async function openBudgetValNumpad(){
  const valInp=document.getElementById('b-val');
  const cur=valInp?.dataset?.rawExpr||valInp?.value||'';
  const result=await openNumpad(cur);
  if(result!==null&&valInp){clearFieldError('b-val');
    if(hasOp(result)){
      const r=evalExpr(result);
      if(!isNaN(r)){
        valInp.dataset.rawExpr=result;
        valInp.value=result;
        const prev=document.getElementById('b-val-preview');
        if(prev){prev.textContent='= '+fmt(r);prev.style.color='var(--green)';}
      }
    }else{
      valInp.dataset.rawExpr='';
      valInp.value=result;
      const prev=document.getElementById('b-val-preview');
      if(prev)prev.textContent='';
    }
  }
}
async function showBudgetEditById(id){

  try{
    const all=await budgetAll();
    const item=all.find(x=>x.id===id);
    if(item)showBudgetAddModal(item);

  }catch(e){
    console.error('[showBudgetEditById]',e);
    toast('Erro ao abrir item','var(--red)');
  }
}
function showBudgetAddModal(item=null){
  const isEdit=!!item;
  openModal(`
    <div class="modal-title">${isEdit?'✏️ Editar item':'Novo item do orçamento'}</div>
    <div class="form-group">
      <label>Descrição</label>
      <input id="b-name" placeholder="Ex: Aluguel, Cartão, Streaming..." value="${isEdit?item.name.replace(/"/g,'&quot;'):''}" oninput="clearFieldError('b-name')">
      <div class="field-error-msg" id="b-name-err"></div>
    </div>
    <div class="form-group">
      <label>Valor esperado</label>
      <div class="row-flex">
        <input id="b-val" type="text" inputmode="decimal" placeholder="0,00" value="${isEdit?(item.rawExpr||item.value):''}" style="flex:1" oninput="onBudgetValInput()">
      <div class="field-error-msg" id="b-val-err"></div>
        <button type="button" onclick="openBudgetValNumpad()" class="btn-calc">📟</button>
      </div>
      <div id="b-val-preview" class="hint"></div>
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select id="b-type" onchange="onBudgetTypeChange()">
        <option value="income"${item?.type==='income'?' selected':''}>💵 Receita</option>
        <option value="fixed"${(!item||item?.type==='fixed')?' selected':''}>🏠 Despesa Fixa</option>
        <option value="variable"${item?.type==='variable'?' selected':''}>🛒 Variável</option>
      </select>
      <div id="b-type-hint" class="hint"></div>
    </div>
    <div class="form-group">
      <label>Vencimento <span class="label-muted">(opcional)</span></label>
      <div class="budget-due-grid">
        <div>
          <div class="label-sm">Dia</div>
          <input id="b-day" type="text" inputmode="numeric" placeholder="Ex: 10" value="${isEdit&&item.dueDay?item.dueDay:''}" style="text-align:center" oninput="onBudgetDueOffsetChange()">
        </div>
        <div>
          <div class="label-sm">Mês</div>
          <select id="b-due-offset" onchange="onBudgetDueOffsetChange()">
            <option value="0"${!isEdit||!item.dueMonthOffset?' selected':''}>${MONTHS[curMonth].slice(0,3)}/${String(curYear).slice(2)}</option>
            <option value="1"${isEdit&&item.dueMonthOffset===1?' selected':''}>${MONTHS[(curMonth+1)%12].slice(0,3)}/${String(curYear+Math.floor((curMonth+1)/12)).slice(2)}</option>
            <option value="2"${isEdit&&item.dueMonthOffset===2?' selected':''}>${MONTHS[(curMonth+2)%12].slice(0,3)}/${String(curYear+Math.floor((curMonth+2)/12)).slice(2)}</option>
          </select>
        </div>
        <div id="b-due-preview" class="hint-due"></div>
      </div>
    </div>
    <div id="b-recurrence-area" style="${(item?.type==='variable'||item?.type==='income')?'':'display:none'}">
      <div class="form-group">
        <label>Recorrência</label>
        <select id="b-recur" onchange="onBudgetRecurChange()">
          <option value="always" ${item?.type==='income'&&(!item?.recurrence||item?.recurrence==='always')?'selected':''}>Fixo (todo mês)</option>
          <option value="once" ${item?.recurrence==='once'||((!item?.recurrence||item?.recurrence==='always')&&item?.type!=='income')?'selected':''}>Único (só este mês)</option>
          <option value="installments" ${item?.recurrence==='installments'?'selected':''}>Parcelado (N meses)</option>
        </select>
      </div>
      <div id="b-installments-area" style="${item?.recurrence==='installments'?'':'display:none'}">
        <div class="form-grid">
          <div class="form-group">
            <label>Parcela atual</label>
            <input id="b-inst-cur" type="text" inputmode="numeric" placeholder="1" value="${isEdit&&item.installmentCur?item.installmentCur:'1'}">
          </div>
          <div class="form-group">
            <label>Total de parcelas</label>
            <input id="b-inst-total" type="text" inputmode="numeric" placeholder="Ex: 6" value="${isEdit&&item.installmentTotal?item.installmentTotal:''}">
          </div>
        </div>
        <div class="hint">Aparece como "descrição N/M" em cada mês</div>
      </div>
    </div>
    <div class="form-group">
      <label>Responsável <span class="label-muted">(opcional)</span></label>
      <div id="b-pessoa-chips" class="row-flex-wrap"></div>
    </div>
    <div class="form-group">
      <label>Observações <span class="label-muted">(opcional)</span></label>
      <textarea id="b-obs" placeholder="Detalhes...">${isEdit?item.obs||'':''}</textarea>
    </div>
    <div class="form-group" id="b-delayed-area">
      <label>Atrasado / Pendente <span class="label-muted">(opcional)</span></label>
      <div class="row-flex">
        <label class="toggle" style="flex-shrink:0">
          <input type="checkbox" id="b-delayed-toggle" onchange="onBudgetDelayedToggle()" ${isEdit&&item.delayed?'checked':''}>
          <div class="toggle-track"></div><div class="toggle-thumb"></div>
        </label>
        <span class="label-sm-green">⚠️ Marcar como atrasado</span>
      </div>
      ${isEdit?'<div id="b-delayed-config" style="'+(item.delayed?'display:block':'display:none')+';margin-top:10px">'+
        '<div class="label-sm">Mover para o período</div>'+
        '<select id="b-delayed-to" style="width:100%">'+
        (()=>{let o='';for(let i=-6;i<=12;i++){const rawM=curMonth+i;const m=(rawM%12+12)%12;const y=curYear+Math.floor(rawM/12);
        let sel=false;
        if(item.delayed&&item.budgetMonth!=null){
          const nx=(item.budgetYear||curYear)*12+item.budgetMonth+1;
          sel=(y*12+m===nx);
        }else sel=(i===1);
        o+='<option value="'+m+'_'+y+'" '+(sel?'selected':'')+'>'+MONTHS[m].slice(0,3)+'/'+y+'</option>';}return o;})()+'</select>'+
        '<div style="font-size:11px;color:var(--amber);margin-top:6px">ℹ️ Some do período atual e aparece no destino com badge de atraso.</div>'+
        '</div>':''}
    </div>
    <div class="form-group">
      <label>Subitens <span class="label-muted">(opcional)</span></label>
      <div class="row-end">
        <button type="button" class="btn btn-ghost btn-sm" onclick="addSubitem()">+ Subitem</button>
      </div>
      <div id="modal-b-subitems-area"></div>
      <div class="hint">O valor total será calculado automaticamente pelos subitens</div>
    </div>
    <div class="btn-row" style="margin-top:4px">
      <button class="btn btn-primary" style="flex:1" onclick="${isEdit?'saveBudgetEdit('+item.id+')':'saveBudgetItem()'}">
        ${isEdit?'Salvar':'Adicionar'}
      </button>
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    </div>`);
  setTimeout(()=>{
    renderPessoaChips('b-pessoa-chips',isEdit?item.pessoaId||null:null);
    if(isEdit){
      // Restore recurrence UI
      const recArea=document.getElementById('b-recurrence-area');
      if(recArea)recArea.style.display=(item.type==='variable'||item.type==='income')?'block':'none';
      const recurSel=document.getElementById('b-recur');
      if(recurSel)recurSel.value=item.recurrence||(item.type==='income'?'always':'once');
      onBudgetRecurChange();
      const instArea=document.getElementById('b-installments-area');
      if(instArea)instArea.style.display=item.recurrence==='installments'?'block':'none';
    }
    if(isEdit&&item.rawExpr){
      const inp=document.getElementById('b-val');
      if(inp){
        inp.dataset.rawExpr=item.rawExpr;
        const r=evalExpr(item.rawExpr);
        const prev=document.getElementById('b-val-preview');
        if(prev&&!isNaN(r)){prev.textContent='= '+fmt(r);prev.style.color='var(--green)';}
      }
    }
  },50);
  setTimeout(()=>{
    if(isEdit&&item.subitems?.length){
      // calcular elapsed para filtrar subitems ja encerrados
      const srs=item.subRepeatStart;
      const elap=srs?(curYear*12+curMonth-(srs.year*12+srs.month)):0;
      item.subitems.forEach(s=>{
        const rep=s.repeat||0;
        const skip=s.skip||[];
        if(rep>0&&elap>=rep)return; // ja acabou, nao restaura
        // repeatCap: se skip transformou o repeat em valor menor via repeatCap salvo
        // (nao ha repeatCap no banco, skip e repeat sao os campos canonicos)
        addSubitem(s.name,s.value,rep,s.sgid||'',skip);
        // mostrar indicador visual se tem skips ou repeatCap aplicado
        if(skip.length>0){
          const area=document.getElementById('modal-b-subitems-area');
          const rows=area?area.querySelectorAll('.subitem-row'):[];
          const lastRow=rows[rows.length-1];
          if(lastRow)lastRow.title='Pulado em: '+skip.map(e=>{
            const rawM=item.subRepeatStart.month+e;
            return MONTHS[(rawM%12+12)%12].slice(0,3)+'/'+(item.subRepeatStart.year+Math.floor(rawM/12));
          }).join(', ');
        }
      });
    }
    // marcar modal com id do item editado e se tem subRepeatStart
    const modal=document.getElementById('modal-content');
    if(isEdit&&modal){
      modal.dataset.editingId=String(item.id);
      if(item.subRepeatStart)modal.dataset.subRepeatStart=JSON.stringify(item.subRepeatStart);
      else delete modal.dataset.subRepeatStart;
    }
    // guardar periodo original e periodo atual do item no modal
    if(modal&&isEdit){
      // origMonth = periodo onde o item deveria estar sem atraso
      const origM=item.delayedFrom?item.delayedFrom.month:item.budgetMonth;
      const origY=item.delayedFrom?item.delayedFrom.year:item.budgetYear;
      if(origM!=null)modal.dataset.origMonth=String(origM);
      if(origY!=null)modal.dataset.origYear=String(origY);
    }
    if(isEdit&&item.delayed){
      const tog=document.getElementById('b-delayed-toggle');
      if(tog){tog.checked=true;onBudgetDelayedToggle();}
      if(item.delayedTo){
        const sel=document.getElementById('b-delayed-to');
        if(sel)sel.value=item.delayedTo.month+'_'+item.delayedTo.year;
      }
    }
  },50);
}
function getBudgetRecurrence(){
  const type=document.getElementById('b-type')?.value;
  if(type==='fixed')return{recurrence:'always',installmentCur:null,installmentTotal:null};
  const recur=document.getElementById('b-recur')?.value||'once';
  if(recur==='always')return{recurrence:'always',installmentCur:null,installmentTotal:null};
  if(recur==='installments'){
    return{
      recurrence:'installments',
      installmentCur:parseInt(document.getElementById('b-inst-cur')?.value)||1,
      installmentTotal:parseInt(document.getElementById('b-inst-total')?.value)||1
    };
  }
  return{recurrence:'once',installmentCur:null,installmentTotal:null};
}
async function saveBudgetItem(){

  try{
    const subitems=getRawSubitems();
    const name=document.getElementById('b-name')?.value.trim();
    const val=getBudgetVal();
    const type=document.getElementById('b-type')?.value;
    const dueDay=parseInt(document.getElementById('b-day')?.value)||null;
    const dueMonthOffset=parseInt(document.getElementById('b-due-offset')?.value)||0;
    const obs=document.getElementById('b-obs')?.value.trim()||'';
    const bPessoaId=getSelectedPessoa('b-pessoa-chips');
    const bRawExpr=getBudgetRawExpr();
    const{recurrence,installmentCur,installmentTotal}=getBudgetRecurrence();
    if(!name){setFieldError('b-name','Informe o nome');return}
      if(!val||isNaN(val)||val<=0){setFieldError('b-val','Informe um valor válido');return}
    if(recurrence==='installments'&&installmentTotal>1){
      // Create N installment items starting from installmentCur
          const bGroupId=Date.now()+'_'+Math.random().toString(36).slice(2,7);
      for(let i=installmentCur-1;i<installmentTotal;i++){
        const label=name+' '+(i+1)+'/'+installmentTotal;
        await budgetAdd({name:label,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
          pessoaId:bPessoaId,recurrence:'once',groupId:bGroupId,
          installmentCur:i+1,installmentTotal,
          budgetMonth:(curMonth+i-(installmentCur-1)+1200)%12,
          budgetYear:curYear+Math.floor((curMonth+i-(installmentCur-1))/12),
          createdAt:Date.now()});
      }
      toast(installmentTotal-installmentCur+1+' parcelas adicionadas!','var(--teal)');
    }else{
      // item fixo com subitems que tem repeat: salva 1 registro always com subitems raw
      const hasSubRepeat=subitems.some(s=>s.repeat>0);
      if(hasSubRepeat&&recurrence!=='installments'){
        await budgetAdd({name,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
          pessoaId:bPessoaId,recurrence:'always',
          subRepeatStart:{month:curMonth,year:curYear},
          budgetMonth:null,budgetYear:null,createdAt:Date.now()});
        toast('Item adicionado!','var(--teal)');
      }else{
        const isDelayedNew=document.getElementById('b-delayed-toggle')?.checked;
        await budgetAdd({name,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
          pessoaId:bPessoaId,
          recurrence:isDelayedNew?'once':recurrence,
          installmentCur:isDelayedNew?null:installmentCur,
          installmentTotal:isDelayedNew?null:installmentTotal,
          budgetMonth:(isDelayedNew||recurrence==='once')?curMonth:null,
          budgetYear:(isDelayedNew||recurrence==='once')?curYear:null,
          delayed:isDelayedNew?true:undefined,
          delayedFrom:isDelayedNew?{month:curMonth,year:curYear}:undefined,
          createdAt:Date.now()});
        toast(isDelayedNew?'Item adicionado como atrasado!':'Item adicionado!',isDelayedNew?'var(--amber)':'var(--teal)');
      }
    }
    closeModal();renderBudget();

  }catch(e){
    console.error('[saveBudgetItem]',e);
    toast('Erro ao salvar item','var(--red)');
  }
}
async function saveBudgetEdit(id){

  try{
    const subitems=getRawSubitems();
    const name=document.getElementById('b-name')?.value.trim();
    const val=getBudgetVal();
    const type=document.getElementById('b-type')?.value;
    const dueDay=parseInt(document.getElementById('b-day')?.value)||null;
    const dueMonthOffset=parseInt(document.getElementById('b-due-offset')?.value)||0;
    const obs=document.getElementById('b-obs')?.value.trim()||'';
    const bPessoaId=getSelectedPessoa('b-pessoa-chips');
    const bRawExpr=getBudgetRawExpr();
    const{recurrence,installmentCur,installmentTotal}=getBudgetRecurrence();
    if(!name){setFieldError('b-name','Informe o nome');return}
      if(!val||isNaN(val)||val<=0){setFieldError('b-val','Informe um valor válido');return}
    const all=await budgetAll();
    const existing=all.find(x=>x.id===id);
    if(!existing)return;
    if(recurrence==='installments'&&installmentTotal>1){
      // If converting from once/always to installments, ask for confirmation
      if(existing.recurrence!=='installments'){
        closeModal();
        showConfirm('Transformar em parcelas?','O item atual será removido e '+(installmentTotal-installmentCur+1)+' parcelas serão criadas a partir deste mês.',[
          {label:'Confirmar',cls:'btn-primary',action:async()=>{
            await budgetDel(id);
            const newBGroupId=Date.now()+'_'+Math.random().toString(36).slice(2,7);
            for(let i=installmentCur-1;i<installmentTotal;i++){
              const label=name.replace(/\s+\d+\/\d+$/,'').trim()+' '+(i+1)+'/'+installmentTotal;
              const mOffset=i-(installmentCur-1);
              const rawM=curMonth+mOffset;
              await budgetAdd({name:label,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
                pessoaId:bPessoaId,recurrence:'once',groupId:newBGroupId,
                installmentCur:i+1,installmentTotal,
                budgetMonth:(rawM%12+12)%12,
                budgetYear:curYear+Math.floor(rawM/12),
                createdAt:Date.now()});
            }
            toast(installmentTotal-installmentCur+1+' parcelas criadas!','var(--teal)');
            renderBudget();
          }},
          {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
        ]);
        return;
      }
      // Already installments - rebuild series (existing logic)
      await budgetDel(id);
      const newBGroupId=Date.now()+'_'+Math.random().toString(36).slice(2,7);
      for(let i=installmentCur-1;i<installmentTotal;i++){
        const label=name.replace(/\s+\d+\/\d+$/,'').trim()+' '+(i+1)+'/'+installmentTotal;
        const mOffset=i-(installmentCur-1);
        const rawM=curMonth+mOffset;
        await budgetAdd({name:label,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
          pessoaId:bPessoaId,recurrence:'once',groupId:newBGroupId,
          installmentCur:i+1,installmentTotal,
          budgetMonth:(rawM%12+12)%12,
          budgetYear:curYear+Math.floor(rawM/12),
          createdAt:Date.now()});
      }
      toast(installmentTotal-installmentCur+1+' parcelas criadas!','var(--teal)');
      closeModal();renderBudget();
    }else if(existing.groupId&&recurrence!=='installments'){
      // Part of a series - offer series edit
      const allBuds=await budgetAll();
      // future = same group, budgetMonth >= this item's budgetMonth
      const thisTotal=existing.budgetYear*12+existing.budgetMonth;
      const future=allBuds.filter(b=>b.groupId===existing.groupId&&
        b.id!==existing.id&&(b.budgetYear*12+b.budgetMonth)>thisTotal);
      if(future.length>0){
        closeModal();
        showConfirm('Editar parcela do orçamento','Esta parcela faz parte de uma série.',[
          {label:'Apenas esta',cls:'btn-ghost',action:async()=>{
            const dEd=getBudgetDelayed();
            if(dEd&&dEd.to){
              // mover para outro periodo
              const toM=dEd.to.month,toY=dEd.to.year;
              const fromM=existing.budgetMonth!=null?existing.budgetMonth:curMonth;
              const fromY=existing.budgetYear!=null?existing.budgetYear:curYear;
              await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,
                dueDay:existing.dueDay,dueMonthOffset:existing.dueMonthOffset,
                obs,subitems,pessoaId:bPessoaId,recurrence:'once',
                installmentCur:existing.installmentCur,installmentTotal:existing.installmentTotal,
                budgetMonth:toM,budgetYear:toY,
                delayed:true,delayedFrom:{month:fromM,year:fromY},delayedTo:{month:toM,year:toY}});
              toast('Parcela movida para '+MONTHS[toM].slice(0,3)+'/'+toY,'var(--amber)');
            }else if(existing.delayed&&!dEd){
              // desmarcar delayed: voltar ao periodo original
              const restM=existing.delayedFrom?existing.delayedFrom.month:existing.budgetMonth;
              const restY=existing.delayedFrom?existing.delayedFrom.year:existing.budgetYear;
              await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
                pessoaId:bPessoaId,recurrence:'once',
                installmentCur:existing.installmentCur,installmentTotal:existing.installmentTotal,
                budgetMonth:restM,budgetYear:restY,
                delayed:false,delayedFrom:null,delayedTo:null});
              toast('Parcela restaurada!','var(--teal)');
            }else{
              await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
                pessoaId:bPessoaId,recurrence:'once',
                budgetMonth:existing.budgetMonth,budgetYear:existing.budgetYear,
                delayed:false,delayedFrom:null,delayedTo:null});
              toast('Parcela atualizada!','var(--teal)');
            }
            closeModal();renderBudget();
          }},
          {label:'Esta e seguintes',cls:'btn-primary',action:async()=>{
            await budgetDel(existing.id);
            for(const b of future) await budgetDel(b.id);
            const newG=Date.now()+'_'+Math.random().toString(36).slice(2,7);
            const remaining=future.length+1;
            const startInst=existing.installmentCur||1;
            const totalInst=existing.installmentTotal||remaining;
            const baseName2=(name).replace(/\s+\d+\/\d+$/,'').trim();
            let rawM2=(existing.budgetYear*12+existing.budgetMonth)-(curYear*12+curMonth);
            const baseYM=existing.budgetYear*12+existing.budgetMonth;
            for(let i=0;i<remaining;i++){
              const ym2=baseYM+i;
              const bm=(ym2%12+12)%12;
              const by=Math.floor(ym2/12);
              const label2=baseName2+' '+(startInst+i)+'/'+totalInst;
              await budgetAdd({name:label2,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
                pessoaId:bPessoaId,recurrence:'once',groupId:newG,
                installmentCur:startInst+i,installmentTotal:totalInst,
                budgetMonth:bm,budgetYear:by,createdAt:Date.now()});
            }
            toast('Série atualizada!','var(--teal)');renderBudget();
          }},
          {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
        ]);
        return;
      }
      await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems,
        pessoaId:bPessoaId,recurrence:'once',
        budgetMonth:existing.budgetMonth,budgetYear:existing.budgetYear});
      toast('Item atualizado!','var(--teal)');
      closeModal();renderBudget();
    }else{
      // Para itens com subRepeatStart: mesclar subitems do DOM com os originais do banco
      // Os subitems que ja acabaram ficam no banco mas nao aparecem no DOM
      let finalSubitems=subitems;
      if(existing.subRepeatStart&&existing.subitems?.length){
        const srs=existing.subRepeatStart;
        const elap=(curYear*12+curMonth)-(srs.year*12+srs.month);
        // subitems do banco que ja acabaram (nao estao no DOM)
        const ended=existing.subitems.filter(s=>(s.repeat||0)>0&&elap>=(s.repeat||0));
        // subitems do DOM (ativos ou marcados com skip/repeatCap)
        finalSubitems=[...subitems,...ended];
      }
      const delayedEdit=getBudgetDelayed();
      if(delayedEdit){
        // from = onde o item esta agora (budgetMonth para once, curMonth para always)
        const fromM=existing.budgetMonth!=null?existing.budgetMonth:curMonth;
        const fromY=existing.budgetYear!=null?existing.budgetYear:curYear;
        // se nao tem destino (novo item ou toggle sem select): manter no periodo atual
        const toM=delayedEdit.to?delayedEdit.to.month:fromM;
        const toY=delayedEdit.to?delayedEdit.to.year:fromY;
        if(existing.delayed){
          // ja atrasado: apenas mover para novo destino, preservar delayedFrom original
          await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,
            dueDay:existing.dueDay,dueMonthOffset:existing.dueMonthOffset,
            obs,subitems:finalSubitems,
            pessoaId:bPessoaId,recurrence:'once',
            budgetMonth:toM,budgetYear:toY,
            delayed:true,
            delayedFrom:existing.delayedFrom||{month:fromM,year:fromY},
            delayedTo:{month:toM,year:toY}});
        }else if(recurrence==='always'){
          // fixo: skip no mes de origem + criar once no destino
          const delSkips=[...(existing.delayedSkipMonths||[]),{month:fromM,year:fromY}];
          await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems:finalSubitems,
            pessoaId:bPessoaId,recurrence:'always',delayedSkipMonths:delSkips});
          await budgetAdd({name,value:val,rawExpr:bRawExpr,type,
            dueDay:existing.dueDay,dueMonthOffset:existing.dueMonthOffset,
            obs,subitems:finalSubitems,
            pessoaId:bPessoaId,recurrence:'once',
            budgetMonth:toM,budgetYear:toY,
            delayed:true,delayedFrom:{month:fromM,year:fromY},delayedTo:{month:toM,year:toY},
            delayedFromId:existing.id,createdAt:Date.now()});
        }else{
          // once/parcelado: mover budgetMonth para destino
          await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,
            dueDay:existing.dueDay,dueMonthOffset:existing.dueMonthOffset,
            obs,subitems:finalSubitems,
            pessoaId:bPessoaId,recurrence:'once',installmentCur,installmentTotal,
            budgetMonth:toM,budgetYear:toY,
            delayed:true,delayedFrom:{month:fromM,year:fromY},delayedTo:{month:toM,year:toY}});
        }
        toast('Item movido para '+MONTHS[toM].slice(0,3)+'/'+toY,'var(--amber)');
      }else{
        // desmarcar: restaurar periodo original
        const modal2=document.getElementById('modal-content');
        const origM=modal2?.dataset.origMonth!=null?parseInt(modal2.dataset.origMonth):null;
        const origY=modal2?.dataset.origYear!=null?parseInt(modal2.dataset.origYear):null;
        const restoreM=origM!=null?origM:(existing.delayedFrom?existing.delayedFrom.month:existing.budgetMonth);
        const restoreY=origY!=null?origY:(existing.delayedFrom?existing.delayedFrom.year:existing.budgetYear);
        // item fixo: restaurar recurrence always e remover skips
        // item once/parcelado: mover de volta ao periodo original
        const wasAlways=existing.delayedFromId!=null; // era fixo (tinha clone criado)
        if(wasAlways){
          // restaurar original (always) sem o skip do mes que foi atrasado
          const allBuds2=await budgetAll();
          const origItem=allBuds2.find(b=>b.id===existing.delayedFromId);
          if(origItem){
            const fromM=existing.delayedFrom?.month;
            const skipsClean=(origItem.delayedSkipMonths||[]).filter(s=>!(s.month===fromM&&s.year===existing.delayedFrom?.year));
            await budgetPut({...origItem,delayedSkipMonths:skipsClean.length?skipsClean:null});
          }
          // deletar este clone atrasado
          await budgetDel(existing.id);
        }else{
          await budgetPut({...existing,name,value:val,rawExpr:bRawExpr,type,dueDay,dueMonthOffset,obs,subitems:finalSubitems,
            pessoaId:bPessoaId,recurrence:recurrence==='always'?'always':'once',installmentCur,installmentTotal,
            budgetMonth:restoreM!=null?restoreM:null,budgetYear:restoreY!=null?restoreY:null,
            delayed:false,delayedFrom:null,delayedTo:null,delayedSkipMonths:null});
        }
        toast('Item restaurado!','var(--teal)');
      }
      closeModal();renderBudget();
    }

  }catch(e){
    console.error('[saveBudgetEdit]',e);
    toast('Erro ao salvar item','var(--red)');
  }
}



async function toggleBudgetDone(budgetId){
  // verificar se já está marcado (desmarcar não precisa confirmar)
  const key=doneKey(budgetId,curYear,curMonth);
  const existing=await doneGet(key);
  if(existing){
    // já marcado — desmarcar sem confirmar
    return _toggleBudgetDoneInternal(budgetId);
  }
  // vai marcar — pedir confirmação
  showConfirm('Marcar como realizado?','Será criado um lançamento financeiro referente a este item.',[
    {label:'Confirmar',cls:'btn-primary',action:()=>_toggleBudgetDoneInternal(budgetId)},
    {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
  ]);
}
async function _toggleBudgetDoneInternal(budgetId){

  try{
    // Handle cartao virtual items (string ids like 'cartao_3')
    if(typeof budgetId==='string'&&budgetId.startsWith('cartao_')){
      const cartaoId=parseInt(budgetId.replace('cartao_',''));
      const key=doneKey(budgetId,curYear,curMonth);
      const existing=await doneGet(key);
      if(existing){
        if(existing.txId)await dbDel(existing.txId);
        await doneDel(key);
        toast('Marcação desfeita','var(--amber)');
      }else{
        const cartoes=await cartoesAll();
        const cartao=cartoes.find(c=>c.id===cartaoId);
        if(!cartao)return;
        const gastosFatura=await getCartaoFaturaGastos(cartaoId,curMonth,curYear);
        const allRec2=await recorrentesAll();
        const recFatura=allRec2.filter(r=>r.cartaoId===cartaoId);
        const total=(gastosFatura.reduce((s,g)=>s+g.value,0))+(recFatura.reduce((s,r)=>s+r.value,0));
        const vencDate=getFaturaVencimento(curYear,curMonth,cartao);
        const obsLines=[...gastosFatura,...recFatura].map(g=>g.name+(g.value?' ('+fmt(g.value)+')':'')).join(', ');
        const txSubitems=[...gastosFatura,...recFatura].map(g=>({name:g.name,value:g.value}));
        const txId=await dbAdd({
          name:'Fatura '+cartao.name,value:total,type:'credit',
          month:curMonth,year:curYear,ym:ym(curYear,curMonth),
          date:vencDate,obs:'',subitems:txSubitems,
          pessoaId:cartao.pessoaId||null,
          fromBudget:true,fromCartao:cartaoId,createdAt:Date.now()
        });
        await donePut({key,budgetId,txId,doneAt:Date.now()});
        toast('Fatura lançada! ✅','var(--green)');
      }
      renderBudget();
      return;
    }
    // Normal manual budget items
    const id=typeof budgetId==='string'?parseInt(budgetId):budgetId;
    const key=doneKey(id,curYear,curMonth);
    const existing=await doneGet(key);
    if(existing){
      if(existing.txId)await dbDel(existing.txId);
      await doneDel(key);
      toast('Marcação desfeita','var(--amber)');
    }else{
      const buds=await budgetAll();
      const item=buds.find(x=>x.id===id);
      if(!item)return;
      const day=item.dueDay||1;
      const offset=item.dueMonthOffset||0;
      const rawDueMonth=curMonth+offset;
      const dueYear=curYear+Math.floor(rawDueMonth/12);
      const dueMonth=(rawDueMonth%12+12)%12;
      const dateStr=dueYear+'-'+String(dueMonth+1).padStart(2,'0')+'-'+String(Math.min(day,28)).padStart(2,'0');
      // calcular subitems e valor ativos para este mes
      let txSubs=item.subitems||[];
      let txVal=item.value;
      if(item.subRepeatStart&&txSubs.length){
        txSubs=getActiveSubitems(txSubs,item.subRepeatStart.month,item.subRepeatStart.year,curMonth,curYear);
        if(txSubs.length)txVal=txSubs.reduce((t,s)=>t+s.value,0);
      }
      const txId=await dbAdd({
        name:item.name,value:txVal,rawExpr:item.rawExpr||null,
        subitems:txSubs,type:item.type,
        month:curMonth,year:curYear,ym:ym(curYear,curMonth),
        date:dateStr,obs:item.obs||'',pessoaId:item.pessoaId||null,
        fromBudget:true,createdAt:Date.now()
      });
      await donePut({key,budgetId:id,txId,doneAt:Date.now()});
      toast('Lançamento registrado! ✅','var(--green)');
    }
    renderBudget();
    const p=document.querySelector('.page.active');
    if(p&&(p.id==='page-dash'||p.id==='page-tx'))renderAll();

  }catch(e){
    console.error('[toggleBudgetDone]',e);
    toast('Erro ao marcar item','var(--red)');
  }
}

async function deleteBudgetItem(id){

  try{
    const allBuds=await budgetAll();
    const item=allBuds.find(b=>b.id===id);
    // se item delayed com clone (delayedFromId), limpar skip do original ao deletar
    if(item&&item.delayed&&item.delayedFromId){
      const origItem=allBuds.find(b=>b.id===item.delayedFromId);
      if(origItem&&origItem.delayedSkipMonths?.length){
        const fromM=item.delayedFrom?.month,fromY=item.delayedFrom?.year;
        const skipsClean=origItem.delayedSkipMonths.filter(s=>!(s.month===fromM&&s.year===fromY));
        await budgetPut({...origItem,delayedSkipMonths:skipsClean.length?skipsClean:null});
      }
    }
    async function delOne(bid){
      await budgetDel(bid);
      await new Promise(res=>{
        const t=db.transaction('budgetDone','readwrite');
        const store=t.objectStore('budgetDone');
        store.getAll().onsuccess=e=>{
          (e.target.result||[]).filter(r=>r.budgetId===bid).forEach(r=>store.delete(r.key));
          res();
        };
      });
    }
    const isSeries=item&&(item.groupId||(item.installmentTotal>1&&item.recurrence==='once'));
    if(isSeries){
      const thisTotal=item.budgetYear*12+item.budgetMonth;
      const allInGroup=item.groupId
        ?allBuds.filter(b=>b.groupId===item.groupId&&b.id!==id)
        :allBuds.filter(b=>b.id!==id&&b.installmentTotal===item.installmentTotal&&b.recurrence==='once'&&b.pessoaId===item.pessoaId&&b.name.replace(/\s+\d+\/\d+$/,'')===item.name.replace(/\s+\d+\/\d+$/,''));
      const future=allInGroup.filter(b=>(b.budgetYear*12+b.budgetMonth)>thisTotal);
      const instLabel=item.installmentCur&&item.installmentTotal?' ('+item.installmentCur+'/'+item.installmentTotal+')':'';
      const futureCount=future.length+1;
      const totalCount=allInGroup.length+1;
      showConfirm('Remover parcela do orçamento','Esta parcela'+instLabel+' faz parte de uma série de '+totalCount+'.',[
        {label:'Só esta parcela',cls:'btn-ghost',action:async()=>{
          await delOne(id);toast('Parcela removida','var(--red)');renderBudget();
        }},
        ...(future.length>0?[{label:'Esta e as seguintes ('+futureCount+')',cls:'btn-ghost',action:async()=>{
          await delOne(id);
          for(const b of future)await delOne(b.id);
          toast(futureCount+' parcelas removidas','var(--red)');renderBudget();
        }}]:[]),
        {label:'Todas as parcelas ('+totalCount+')',cls:'btn-danger',action:async()=>{
          await delOne(id);
          for(const b of allInGroup)await delOne(b.id);
          toast('Série removida ('+totalCount+' parcelas)','var(--red)');renderBudget();
        }},
        {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
      ]);
      return;
    }
    showConfirm('Remover item do orçamento','Os lançamentos já realizados serão mantidos.',[
      {label:'Remover',cls:'btn-danger',action:async()=>{
        await delOne(id);toast('Item removido','var(--red)');renderBudget();
      }},
      {label:'Cancelar',cls:'btn-ghost',action:()=>{}}
    ]);

  }catch(e){
    console.error('[deleteBudgetItem]',e);
    toast('Erro ao remover item','var(--red)');
  }
}

async function renderBudget(){
  try{
  const allBudgetItems=await budgetAll();
  // Filter manual items by recurrence logic
  const manualItemsBeforePessoa=allBudgetItems.filter(item=>{
    const rec=item.recurrence||'always';
    if(rec==='always'){
      if(item.delayedSkipMonths?.some(s=>s.month===curMonth&&s.year===curYear))return false;
      return true;
    }
    if(rec==='once'){
      // Show only in specific month - use budgetMonth/budgetYear if set
      if(item.budgetMonth!=null&&item.budgetYear!=null){
        // Normalize budgetMonth for multi-month offsets
        const totalMonths=item.budgetYear*12+item.budgetMonth;
        const curTotalMonths=curYear*12+curMonth;
        return totalMonths===curTotalMonths;
      }
      return true; // backward compat: no month stored, always show
    }
    if(rec==='installments'){
      if(item.budgetMonth!=null&&item.budgetYear!=null){
        const totalMonths=item.budgetYear*12+item.budgetMonth;
        const curTotalMonths=curYear*12+curMonth;
        return totalMonths===curTotalMonths;
      }
      return true;
    }
    return true;
  });
  // Apply pessoa filter to manual items
  const manualItems=pessoaFilter?manualItemsBeforePessoa.filter(item=>item.pessoaId===pessoaFilter):manualItemsBeforePessoa;
  // Add cartao virtual items safely (cartoes store may not exist yet)
  let cartaoForMonth=[];
  try{
    const cartaoVirtualItems=await getCartaoBudgetItems(curMonth,curYear);
    cartaoForMonth=cartaoVirtualItems.filter(ci=>{
      if(ci.faturaMonth!==curMonth||ci.faturaYear!==curYear)return false;
      if(pessoaFilter&&ci.pessoaId!==pessoaFilter)return false;
      return true;
    });
  }catch(e){console.warn('Cartoes store not ready:',e);}
  const items=[...manualItems,...cartaoForMonth];
  const doneList=await doneAllForMonth(curYear,curMonth);
  const doneIds=new Set(doneList.map(d=>d.budgetId));
  const listEl=document.getElementById('budget-list');
  if(!items.length){
    document.getElementById('budget-summary-card').style.display='none';
    listEl.innerHTML=`<div class="empty"><div class="empty-icon">📋</div>Nenhum item no orçamento.<br>Toque em <strong>+ Item</strong> para começar.</div>`;
    return;
  }
  const pessoasBud=await pessoasAll();
  const pessoaMapBud=Object.fromEntries(pessoasBud.map(p=>[p.id,p]));
  const enrichedItems=items.map(i=>{
    const base={...i,_pessoa:i._pessoa||(i.pessoaId?pessoaMapBud[i.pessoaId]:null)};
    if(i.subRepeatStart&&i.subitems&&i.subitems.length){
      const activeSubs=getActiveSubitems(i.subitems,i.subRepeatStart.month,i.subRepeatStart.year,curMonth,curYear);
      const activeVal=activeSubs.length?activeSubs.reduce((t,s)=>t+s.value,0):i.value;
      return {...base,subitems:activeSubs,value:activeVal};
    }
    return base;
  });
  const incomeItems=enrichedItems.filter(i=>i.type==='income');
  const expenseItems=enrichedItems.filter(i=>i.type!=='income');
  const totalIncome=incomeItems.reduce((s,i)=>s+i.value,0);
  const totalExpense=expenseItems.reduce((s,i)=>s+i.value,0);
  const doneIncome=incomeItems.filter(i=>doneIds.has(i.id)).reduce((s,i)=>s+i.value,0);
  const doneExpense=expenseItems.filter(i=>doneIds.has(i.id)).reduce((s,i)=>s+i.value,0);
  const doneCount=doneIds.size;
  const pctAll=items.length>0?Math.round(doneCount/items.length*100):0;
  document.getElementById('budget-summary-card').style.display='block';
  document.getElementById('budget-progress-fill').style.width=pctAll+'%';
  document.getElementById('budget-progress-fill').style.background=pctAll<50?'var(--amber)':pctAll<100?'var(--blue)':'var(--green)';
  const doneSaldo=doneIncome-doneExpense;
  const totalSaldo=totalIncome-totalExpense;
  const saldoColor=doneSaldo>=0?'var(--green)':'var(--red)';
  const totalSaldoColor=totalSaldo>=0?'var(--green)':'var(--red)';
  document.getElementById('budget-summary-text').innerHTML=
    `<div class="budget-summary-col">
      <span style="color:var(--text2)">${doneCount}/${items.length} realizados</span>
      <span style="color:var(--green)">💵 ${fmt(doneIncome)} <span style="color:var(--text3)">/ ${fmt(totalIncome)}</span></span>
      <span style="color:var(--red)">📤 ${fmt(doneExpense)} <span style="color:var(--text3)">/ ${fmt(totalExpense)}</span></span>
      <span style="color:${saldoColor}">⚖️ ${doneSaldo>=0?'+':'-'}${fmt(Math.abs(doneSaldo))} <span style="color:${totalSaldoColor}">/ ${totalSaldo>=0?'+':'-'}${fmt(Math.abs(totalSaldo))}</span></span>
    </div>`;
  const sorted=[...enrichedItems].sort((a,b)=>{
    const ad=doneIds.has(a.id)?1:0,bd=doneIds.has(b.id)?1:0;
    if(ad!==bd)return ad-bd;
    return((a.dueMonthOffset||0)*100+(a.dueDay||99))-((b.dueMonthOffset||0)*100+(b.dueDay||99));
  });
  listEl.innerHTML=sorted.map(item=>{
    if(item._isCartao){
      const done=doneIds.has(item.id);
      const pessoa=item._pessoa;
      return`<div class="budget-item${done?' done':''}">
        <div class="budget-check${done?' checked':''}" onclick="toggleBudgetDone('${item.id}')">${done?'✓':''}</div>
        <div class="budget-info">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="card-logo" style="background:${item._cartao.color};height:20px;width:32px;font-size:10px;border-radius:4px">${item.name.substring(0,3).toUpperCase()}</div>
            <div class="budget-name">${item.name}</div>
          </div>
          <div class="budget-meta">
            <span style="white-space:nowrap">💳 Fatura cartão</span>
            ${item.dueDay?'<span style="color:var(--blue);font-size:10px">📅 '+String(item.dueDay).padStart(2,'0')+(item.dueMonthOffset?'/'+MONTHS[(curMonth+item.dueMonthOffset)%12].slice(0,3):'')+'</span>':''}
            ${done?'<span class="color-green-nowrap">✅ Realizado</span>':''}
            ${pessoa?'<span class="person-tag" style="white-space:nowrap">'+personAvatarHtml(pessoa,14)+' '+pessoa.nome+'</span>':''}
            ${item._gastos&&item._gastos.length?renderSubitemsHtml(item._gastos.map(g=>({name:g.name,value:g.value}))):''}
          </div>
        </div>
        <div class="budget-right">
          <div class="budget-val" style="color:var(--red)">-${fmt(item.value)}</div>
          <button class="tx-btn edit" style="margin-top:3px" onclick="showPage('cards',document.querySelector('.nav-btn:nth-child(3)'))">ver</button>
        </div>
      </div>`;
    }
    const done=doneIds.has(item.id);
    const income=item.type==='income';
    return`<div class="budget-item${done?' done':''}">
      <div class="budget-check${done?' checked':''}" onclick="toggleBudgetDone(${item.id})">${done?'✓':''}</div>
      <div class="budget-info">
        <div class="budget-name">${item.name}</div>
        <div class="budget-meta">
          <span class="budget-meta-row">
            ${CAT_LABELS[item.type]||''}
            ${item.delayed?'<span class="badge" style="background:var(--amber-bg);color:var(--amber)">⚠️ Atrasado</span>':''}
            ${!item.delayed&&(item.recurrence==='always'||item.type==='fixed'||item.type==='income')?'<span class="badge badge-blue">fixo</span>':''}
            ${item.installmentCur&&item.installmentTotal&&!item.subRepeatStart?'<span class="badge badge-amber">'+item.installmentCur+'/'+item.installmentTotal+'</span>':''}
            ${item.dueDay?'<span style="color:var(--blue);font-size:10px">📅 '+String(item.dueDay).padStart(2,'0')+(item.dueMonthOffset?'/'+MONTHS[(curMonth+item.dueMonthOffset)%12].slice(0,3):'')+'</span>':''}
          </span>
          ${done?'<span class="color-green-nowrap">✅ Realizado</span>':''}
          ${item._pessoa?`<span class="person-tag" style="white-space:nowrap">${personAvatarHtml(item._pessoa,14)} ${item._pessoa.nome}</span>`:''}
          ${item.obs?`<div class="tx-obs" style="font-size:11px;color:var(--text2);margin-top:3px">💬 ${item.obs}</div>`:''}
        </div>
        ${item.subitems&&item.subitems.length?renderSubitemsHtml(item.subitems):''}
      </div>
      <div class="budget-right">
        <div class="budget-val" style="${income?'color:var(--green)':'color:var(--text2)'}">
          ${income?'+':'-'}${fmt(item.value)}
        </div>
        <div class="budget-actions">
          <button class="tx-btn edit" onclick="showBudgetEditById(${item.id})">✏️</button>
          <button class="tx-btn del" onclick="deleteBudgetItem(${item.id})">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
  }catch(err){console.error('renderBudget error:',err);}
}