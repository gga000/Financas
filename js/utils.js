function ym(y,m){return y*100+m}
function fmt(v){return'R$ '+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function todayISO(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fmtDate(iso){if(!iso)return'';const[y,m,d]=iso.split('-');return`${d}/${m}/${y}`}
function addMonths(isoDate,n){
  const base=isoDate?new Date(isoDate+'T12:00:00'):null;
  if(!base||isNaN(base)){return '';}
  base.setMonth(base.getMonth()+n);
  return base.toISOString().slice(0,10);
}
function stepMonth(isoDate,y,m){
  if(!isoDate)return '';
  return addMonths(isoDate,1);
}
function toast(msg,c){
  const t=document.getElementById('toast');
  t.textContent=msg;if(c)t.style.borderColor=c;
  t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2600);
}
function calcMonth(all,y,m){
  const rows=all.filter(t=>t.year===y&&t.month===m);
  const income=rows.filter(t=>t.type==='income').reduce((s,t)=>s+t.value,0);
  // credit shown separately in cartao card, excluded from expense to avoid double count
  const expense=rows.filter(t=>t.type!=='income'&&t.type!=='credit').reduce((s,t)=>s+t.value,0);
  const credit=rows.filter(t=>t.type==='credit').reduce((s,t)=>s+t.value,0);
  return{income,expense,credit,balance:income-expense-credit,rows};
}

function evalExpr(raw){
  const clean=String(raw).replace(/,/g,'.').replace(/[^0-9+\-*/().]/g,'');
  if(!clean||clean==='')return NaN;
  try{const r=Function('"use strict";return('+clean+')')();return isFinite(r)?Math.round(r*100)/100:NaN}catch{return NaN}
}
function hasOp(s){return/[+\-*/]/.test(s)}

function showConfirm(title,msg,buttons){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  const btns=document.getElementById('confirm-btns');
  btns.innerHTML='';
  buttons.forEach(b=>{
    const el=document.createElement('button');
    el.className='btn '+(b.cls||'btn-ghost');
    el.textContent=b.label;
    el.onclick=()=>{document.getElementById('confirm-overlay').classList.remove('open');b.action()};
    btns.appendChild(el);
  });
  document.getElementById('confirm-overlay').classList.add('open');
}


function openNumpad(initialVal){
  return new Promise(resolve=>{
    _numpadResolve=resolve;
    _numpadExpr=initialVal!=null?String(initialVal):'';
    _renderNumpad();
    document.getElementById('numpad-overlay').classList.add('open');
  });
}
function closeNumpad(confirm){
  document.getElementById('numpad-overlay').classList.remove('open');
  if(_numpadResolve){
    _numpadResolve(confirm?_numpadExpr:null);
    _numpadResolve=null;
  }
}
function _renderNumpad(){
  const disp=document.getElementById('numpad-display');
  const prev=document.getElementById('numpad-preview');
  disp.textContent=_numpadExpr||'0';
  if(hasOp(_numpadExpr)){
    const r=evalExpr(_numpadExpr);
    prev.textContent=isNaN(r)?'⚠ inválido':'= '+fmt(r);
    prev.style.color=isNaN(r)?'var(--red)':'var(--green)';
  }else{prev.textContent=''}
}
function nkNum(ch){
  if(ch===','&&(_numpadExpr.includes(','))){
    const parts=_numpadExpr.split(/[+\-*/]/);
    if(parts[parts.length-1].includes(','))return;
  }
  _numpadExpr+=ch;_renderNumpad();
}
function nkOp(op){
  if(op==='('){
    const open=(_numpadExpr.match(/\(/g)||[]).length;
    const close=(_numpadExpr.match(/\)/g)||[]).length;
    _numpadExpr+=open>close?')':'(';
  }else{
    if(_numpadExpr===''&&op==='-')_numpadExpr='-';
    else _numpadExpr+=op;
  }
  _renderNumpad();
}
function nkDel(){
  _numpadExpr=_numpadExpr.slice(0,-1);_renderNumpad();
}

function handleOverlayClick(e){if(e.target===document.getElementById('modal-overlay'))closeModal()}
function closeModal(){
  document.getElementById('modal-overlay').classList.remove('open');
  const mc=document.getElementById('modal-content');
  if(mc){delete mc.dataset.editingId;delete mc.dataset.subRepeatStart;
  delete mc.dataset.origMonth;delete mc.dataset.origYear;
  delete mc.dataset.curBudgetMonth;delete mc.dataset.curBudgetYear;
  delete mc.dataset.editingGastoId;}
}
function openModal(html){document.getElementById('modal-content').innerHTML=html;document.getElementById('modal-overlay').classList.add('open')}

function renderSubitemsHtml(subitems){
  if(!subitems||!subitems.length)return '';
  var rows=subitems.map(function(s){
    // escape simples para evitar quebra de HTML
    var safeName=s.name.replace(/[&<>]/g,function(m){if(m==='&')return'&amp;';if(m==='<')return'&lt;';if(m==='>')return'&gt;';return m;});
    return '<div class="tx-subitem"><span>'+safeName+'</span><span style="font-family:var(--mono)">'+fmt(s.value)+'</span></div>';
  }).join('');
  return '<div class="tx-subtoggle" onclick="toggleSubitems(this)">▼ '+subitems.length+' subitens</div>'
    +'<div class="tx-subitems">'+rows+'</div>';
}

/* toggle melhorado: busca o próximo irmão com a classe correta */
function toggleSubitems(el){
  var target=el.nextElementSibling;
  while(target && !target.classList.contains('tx-subitems')) target=target.nextElementSibling;
  if(target){
    target.classList.toggle('open');
    var novoTexto=target.classList.contains('open') ? '▲ ' + el.textContent.slice(2) : '▼ ' + el.textContent.slice(2);
    el.textContent=novoTexto;
  }
}
function setFieldError(id, msg){
  const el=document.getElementById(id);
  if(el){el.classList.add('field-invalid');}
  const err=document.getElementById(id+'-err');
  if(err){err.textContent=msg;err.classList.add('visible');}
}
function clearFieldError(id){
  const el=document.getElementById(id);
  if(el){el.classList.remove('field-invalid');}
  const err=document.getElementById(id+'-err');
  if(err){err.textContent='';err.classList.remove('visible');}
}
function clearAllFieldErrors(){
  document.querySelectorAll('.field-invalid').forEach(el=>el.classList.remove('field-invalid'));
  document.querySelectorAll('.field-error-msg.visible').forEach(el=>{el.textContent='';el.classList.remove('visible');});
}
