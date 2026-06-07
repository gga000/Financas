function setupManifest(){
  const m={name:'Finanças Pessoais',short_name:'Finanças',start_url:location.href,display:'standalone',background_color:'#0d0f1a',theme_color:'#0d0f1a',icons:[{src:'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%235b8eff%22/><text y=%22.9em%22 font-size=%2270%22 x=%2212%22>💰</text></svg>',sizes:'192x192',type:'image/svg+xml'}]};
  const blob=new Blob([JSON.stringify(m)],{type:'application/json'});
  document.getElementById('pwa-manifest').href=URL.createObjectURL(blob);
}
setupManifest();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.getElementById('install-banner').classList.add('show')});
window.addEventListener('appinstalled',()=>{document.getElementById('install-banner').classList.remove('show');toast('App instalado! 🎉','var(--green)');deferredInstall=null});
function installPWA(){if(deferredInstall){deferredInstall.prompt();deferredInstall.userChoice.then(()=>deferredInstall=null)}}

if('serviceWorker' in navigator){
  const base=location.pathname.replace(/\/[^/]*$/,'/');
  navigator.serviceWorker.register(base+'sw.js',{scope:base})
    .then(reg=>{
      reg.addEventListener('updatefound',()=>{
        const sw=reg.installing;
        sw.addEventListener('statechange',()=>{
          if(sw.state==='installed'&&navigator.serviceWorker.controller)
            toast('Nova versão disponível — recarregue','var(--amber)');
        });
      });
    }).catch(e=>console.warn('[SW]',e));
}

function applyTheme(dark){
  document.body.classList.toggle('light',!dark);
  document.getElementById('meta-theme').content=dark?'#0d0f1a':'#f5f6fa';
  localStorage.setItem('theme',dark?'dark':'light');
  const tog=document.getElementById('toggle-dark');
  if(tog)tog.checked=dark;
}
function toggleTheme(dark){applyTheme(dark)}

function showPageCfg(){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-cfg').classList.add('active');
  document.body.classList.add('cfg-open');
  renderCfg();
}
function closeCfg(){
  document.body.classList.remove('cfg-open');
  showPage('dash',document.querySelector('.nav-btn'));
}
function showPage(id,btn){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='dash')renderDash();
  else if(id==='tx')renderTx();
  else if(id==='cards')renderCards();
  else if(id==='proj')renderProj();
  else if(id==='budget')renderBudget();
  else if(id==='cfg')renderCfg();
}
function changeMonth(d){
  curMonth+=d;if(curMonth<0){curMonth=11;curYear--}if(curMonth>11){curMonth=0;curYear++}
  renderAll();
}
// changeBudgetMonth replaced by changeMonth
function updateMonthLabels(){
  const txt=MONTHS[curMonth].substring(0,3)+' '+curYear;
  ['dash','tx','cards','budget'].forEach(id=>{const el=document.getElementById('month-label-'+id);if(el)el.textContent=txt});
  const ml=document.getElementById('tx-month-label');
  if(ml)ml.textContent=MONTHS[curMonth]+' de '+curYear;
}

async function renderAll(){

  try{
    updateMonthLabels();
    const p=document.querySelector('.page.active');
    if(!p)return;
    if(p.id==='page-dash')renderDash();
    else if(p.id==='page-tx')renderTx();
    else if(p.id==='page-cards')renderCards();
    else if(p.id==='page-proj')renderProj();
    else if(p.id==='page-budget')renderBudget();

  }catch(e){
    console.error('[renderAll]',e);
    toast('Erro ao renderizar','var(--red)');
  }
}

async function init(){
  try{
    applyTheme((localStorage.getItem('theme')||'dark')==='dark');
    db=await openDB();
    updateMonthLabels();
    await renderPersonFilterBars();
    renderDash();
  }catch(err){
    document.body.innerHTML='<div style="padding:40px;text-align:center;color:#f87171"><h2>Erro ao abrir banco</h2><p style="margin-top:10px;font-size:14px">'+err.message+'</p></div>';
  }
}
init();