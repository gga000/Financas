const PERSON_COLORS=['#5b8eff','#3ddc84','#ff6b6b','#ffb547','#a78bfa','#2dd4bf'];
const PERSON_LABELS=['Azul','Verde','Vermelho','Âmbar','Roxo','Teal'];
 // null = todos

function personInitials(nome){
  const parts=nome.trim().split(' ');
  if(parts.length>=2)return(parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  return nome.substring(0,2).toUpperCase();
}
function personAvatarHtml(pessoa,size){
  if(!pessoa)return'';
  const sz=size||24;
  return`<span class="person-avatar" style="background:${pessoa.color};width:${sz}px;height:${sz}px;font-size:${Math.round(sz*0.42)}px">${personInitials(pessoa.nome)}</span>`;
}
async function getPessoaById(id){
  if(!id)return null;
  const all=await pessoasAll();
  return all.find(p=>p.id===id)||null;
}

async function renderPessoasConfig(){

  try{
    const list=document.getElementById('pessoas-list');
    if(!list)return;
    const pessoas=await pessoasAll();
    if(!pessoas.length){list.innerHTML='<div style="font-size:13px;color:var(--text3);padding:8px 0">Nenhuma pessoa cadastrada.</div>';return;}
    list.innerHTML=pessoas.map(p=>`
      <div class="person-row">
        ${personAvatarHtml(p,32)}
        <span class="person-row-name">${p.nome}</span>
        <button class="tx-btn edit" onclick="showEditPessoaModal(${p.id})">✏️</button>
        <button class="tx-btn del" onclick="deletePessoa(${p.id})">✕</button>
      </div>`).join('');

  }catch(e){
    console.error('[renderPessoasConfig]',e);
    toast('Erro ao carregar pessoas','var(--red)');
  }
}

function showAddPessoaModal(pessoa=null){
  const isEdit=!!pessoa;
  const defColor=pessoa?.color||PERSON_COLORS[0];
  openModal(`
    <div class="modal-title">${isEdit?'Editar pessoa':'Nova pessoa'}</div>
    <div class="form-group">
      <label>Nome</label>
      <input id="p-nome" placeholder="Ex: Diego, Camila..." value="${isEdit?pessoa.nome:''}" oninput="clearFieldError('p-nome')">
    <div class="field-error-msg" id="p-nome-err"></div>
    </div>
    <div class="form-group">
      <label>Cor</label>
      <div class="color-swatches" id="p-color-swatches">
        ${PERSON_COLORS.map((c,i)=>`<div class="color-swatch${c===defColor?' selected':''}" style="background:${c}" data-color="${c}" onclick="selectPessoaColor('${c}')"></div>`).join('')}
      </div>
      <input type="hidden" id="p-color" value="${defColor}">
    </div>
    <div class="btn-row" style="margin-top:4px">
      <button class="btn btn-primary" style="flex:1" onclick="${isEdit?`savePessoaEdit(${pessoa.id})`:'savePessoa()'}">Salvar</button>
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
    </div>`);
}

function selectPessoaColor(c){
  document.querySelectorAll('.color-swatch').forEach(s=>s.classList.toggle('selected',s.dataset.color===c));
  const inp=document.getElementById('p-color');
  if(inp)inp.value=c;
}

async function showEditPessoaModal(id){
  const all=await pessoasAll();
  const p=all.find(x=>x.id===id);
  if(p)showAddPessoaModal(p);
}

async function savePessoa(){

  try{
    const nome=document.getElementById('p-nome')?.value.trim();
    const color=document.getElementById('p-color')?.value||PERSON_COLORS[0];
    if(!nome){setFieldError('p-nome','Informe o nome');return;}
    await pessoasAdd({nome,color,createdAt:Date.now()});
    toast('Pessoa adicionada!','var(--teal)');
    closeModal();renderPessoasConfig();renderPersonFilterBars();

  }catch(e){
    console.error('[savePessoa]',e);
    toast('Erro ao salvar pessoa','var(--red)');
  }
}

async function savePessoaEdit(id){

  try{
    const nome=document.getElementById('p-nome')?.value.trim();
    const color=document.getElementById('p-color')?.value||PERSON_COLORS[0];
    if(!nome){setFieldError('p-nome','Informe o nome');return;}
    const all=await pessoasAll();
    const existing=all.find(x=>x.id===id);
    if(!existing)return;
    await pessoasPut({...existing,nome,color});
    toast('Pessoa atualizada!','var(--teal)');
    closeModal();renderPessoasConfig();renderPersonFilterBars();renderAll();

  }catch(e){
    console.error('[savePessoaEdit]',e);
    toast('Erro ao salvar pessoa','var(--red)');
  }
}

async function deletePessoa(id){

  try{
    if(!confirm('Remover esta pessoa? Os lançamentos associados não serão apagados.'))return;
    await pessoasDel(id);
    if(pessoaFilter===id)pessoaFilter=null;
    toast('Pessoa removida','var(--red)');
    renderPessoasConfig();renderPersonFilterBars();renderAll();

  }catch(e){
    console.error('[deletePessoa]',e);
    toast('Erro ao remover pessoa','var(--red)');
  }
}

// Render pessoa chips inside a form (tx or budget)
async function renderPessoaChips(containerId,selectedId){

  try{
    const el=document.getElementById(containerId);
    if(!el)return;
    const pessoas=await pessoasAll();
    if(!pessoas.length){
      const group=document.getElementById(containerId.replace('-chips','-group'));
      if(group)group.style.display='none';
      return;
    }
    el.innerHTML=pessoas.map(p=>`
      <div class="person-chip${p.id===selectedId?' selected':''}" style="color:${p.color};border-color:${p.id===selectedId?p.color:'transparent'}"
        data-pid="${p.id}" onclick="togglePessoaChip(this,'${containerId}')">
        ${personAvatarHtml(p,18)} ${p.nome}
      </div>`).join('');

  }catch(e){
    console.error('[renderPessoaChips]',e);
    toast('Erro ao carregar pessoas','var(--red)');
  }
}

function togglePessoaChip(el,containerId){
  const already=el.classList.contains('selected');
  document.querySelectorAll('#'+containerId+' .person-chip').forEach(c=>{
    c.classList.remove('selected');
    c.style.borderColor='transparent';
  });
  if(!already){
    el.classList.add('selected');
    el.style.borderColor=el.style.color;
  }
}

function getSelectedPessoa(containerId){
  const sel=document.querySelector('#'+containerId+' .person-chip.selected');
  return sel?parseInt(sel.dataset.pid):null;
}

// Person filter bars
async function renderPersonFilterBars(){

  try{
    const pessoas=await pessoasAll();
    ['dash','tx','budget'].forEach(page=>{
      const el=document.getElementById('person-filter-bar-'+page);
      if(!el)return;
      if(!pessoas.length){el.innerHTML='';return;}
      el.innerHTML='<button class="person-filter-btn active" data-pid="all" onclick="setPessoaFilter(null,this)">👥 Todos</button>'
        +pessoas.map(p=>`<button class="person-filter-btn" data-pid="${p.id}" onclick="setPessoaFilter(${p.id},this)" style="color:${p.color}">${personAvatarHtml(p,16)} ${p.nome}</button>`).join('');
    });

  }catch(e){
    console.error('[renderPersonFilterBars]',e);
    toast('Erro ao carregar filtros','var(--red)');
  }
}

function setPessoaFilter(id,btn){
  pessoaFilter=id;
  // update active state in both bars
  document.querySelectorAll('.person-filter-btn').forEach(b=>{
    const match=(id===null&&b.dataset.pid==='all')||(b.dataset.pid==id);
    b.classList.toggle('active',match);
    if(match&&id!==null){b.style.fontWeight='600';}else if(id===null){b.style.fontWeight='';}
  });
  renderAll();
}