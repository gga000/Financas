# Finanças PWA — Contexto do Projeto

## Visão Geral
PWA de finanças pessoais para Diego e Camila. App local-only (sem servidor), deployed via GitHub Pages. Sem frameworks — HTML/CSS/JS vanilla puro.

**URL:** https://diegomedm.github.io/Financas/  
**Stack:** HTML5 + CSS3 + JavaScript ES2020 + IndexedDB v5 + Service Worker  
**Usuários:** Diego (dono) + Camila (responsável secundária)

---

## Estrutura de Arquivos

```
index.html          ← HTML + CSS (~33k) + 10 tags <script src="js/...">
sw.js               ← Service Worker (cache de todos os módulos, 'financas-v3')
js/
  globals.js        ← Constantes, variáveis globais, cache em memória
  db.js             ← IndexedDB + helpers CRUD com cache integrado
  utils.js          ← fmt, modal, toast, confirm, numpad, subitems, validação inline
  pessoas.js        ← Pessoas logic + colors
  cards.js          ← Cartão modal + gasto modal + render cards + fatura logic
  transactions.js   ← TX form + TX card + dashboard + última atualização
  budget.js         ← Budget CRUD + renderBudget
  projection.js     ← renderProj
  config.js         ← Export/import v6 + clearAll + renderCfg
  app.js            ← PWA + SW + theme + nav + renderAll + init
```

**⚠️ IMPORTANTE:** `<script src>` sequencial (NÃO `type="module"`). Ordem importa — `globals.js` primeiro, `app.js` por último.

### Variáveis globais (em globals.js)
```js
const MONTHS, ICONS, CAT_LABELS
let db, curMonth, curYear, txFilter, budgetMonth, budgetYear, deferredInstall
let pessoaFilter, projPeriods
let _numpadExpr, _numpadTarget, _numpadResolve
let _dbCache  // cache em memória do IndexedDB
```

### Funções de cache (em globals.js)
```js
invalidateCache(store)   // invalida um store específico
invalidateAllCache()     // invalida todos (usado no clearAll e import)
```

### Workflow de edição
- Orçamento → `js/budget.js`
- Cartões/gastos → `js/cards.js`
- Lançamentos/dashboard → `js/transactions.js`
- Banco de dados → `js/db.js`
- Modal/toast/subitems/validação → `js/utils.js`
- Variável global nova → `js/globals.js`

### Verificação de sintaxe
```bash
node --check js/budget.js
```

---

## Páginas (nav tabs)
- `page-dash` — Dashboard (⚙️ no header → Configurações)
- `page-tx` — Lançamentos
- `page-cards` — Cartões de crédito
- `page-proj` — Projeção (3/6/12 meses)
- `page-budget` — Orçamento
- `page-cfg` — Configurações (sem tab na nav)

---

## IndexedDB — banco `financas_pwa_v2` versão 5
| Store | keyPath | Descrição |
|-------|---------|-----------|
| `tx` | id (autoincrement) | Lançamentos financeiros |
| `budget` | id (autoincrement) | Itens do orçamento |
| `budgetDone` | key (string) | Marcações de realizado: `budgetId_YYYYMM` |
| `pessoas` | id (autoincrement) | Responsáveis |
| `cartoes` | id (autoincrement) | Cartões de crédito |
| `gastos` | id (autoincrement) + index(cartaoId) | Gastos individuais dos cartões |
| `recorrentes` | id (autoincrement) + index(cartaoId) | Cobranças fixas mensais dos cartões |

---

## Cache em Memória (db.js + globals.js)

Cada `*All()` verifica `_dbCache[store]` antes de ir ao IndexedDB. Cada escrita (`*Add`, `*Put`, `*Del`) chama `invalidateCache(store)` automaticamente.

```js
// Leitura com cache automático (exemplo)
const cartoesAll = () => {
  const hit = _cacheRead('cartoes'); if(hit) return hit;
  return new Promise(res => { /* busca IndexedDB, armazena */ });
};
// Escrita invalida automaticamente
const cartoesAdd = item => new Promise(...) => { invalidateCache('cartoes'); ... };
```

`budgetDone` também é cacheado — `doneGet` e `doneAllForMonth` filtram do array em memória.

**Regra:** qualquer função que abre transação direta no IndexedDB (sem usar os helpers) deve chamar `invalidateCache(store)` ou `invalidateAllCache()` manualmente. Exemplo: `config.js` chama `invalidateAllCache()` no início do `clearAll` e após o `import`.

---

## Modelos de Dados

### Transaction (store `tx`)
```js
{
  id, name, value, rawExpr, type,        // 'income'|'fixed'|'variable'|'credit'
  month, year, ym,                       // ym = year*100+month
  date, paidDate, obs,
  subitems,                              // [{name, value, repeat?, sgid?, skip?, startMonth?, startYear?}]
  pessoaId, groupId, recurring,
  subRepeatStart,                        // {month, year} — se tem subitems com repeat
  fromBudget, fromCartao, createdAt
}
```

### Budget Item (store `budget`)
```js
{
  id, name, value, rawExpr,
  type,                                  // 'income'|'fixed'|'variable'
  dueDay, dueMonthOffset,                // vencimento: dia (1-31) e offset de mês
  obs, subitems, pessoaId,
  recurrence,                            // 'always'|'once'|'installments'
  installmentCur, installmentTotal,
  budgetMonth, budgetYear,               // só para 'once'/'installments'
  groupId, subRepeatStart,
  delayed, delayedFrom, delayedTo,
  delayedFromId, delayedSkipMonths,
  createdAt
}
```

### Cartão (store `cartoes`)
```js
{ id, name, fechamento, vencimento, color, pessoaId, limite, createdAt }
```

### Gasto (store `gastos`)
```js
{ id, name, value, rawExpr, date, obs, cartaoId, parcela, totalParcelas, groupId, subitems, subRepeatStart, createdAt }
```

### Recorrente (store `recorrentes`)
```js
{ id, cartaoId, name, value, subitems, obs, createdAt }
// Subitems simples [{name, value}] — sem repeat. Some só ao deletar.
```

---

## Export/Import — versão 6

```js
{
  version: 6,
  exportedAt,
  data,             // tx
  budget,
  pessoas,
  cartoes,
  gastos,
  recorrentes,      // incluído na v6
  budgetDone,
  lastUpdateHistory // array de timestamps do localStorage
}
```

**Ordem de import (crítica):**
pessoas → tx → budget → **segundo passe budget** (remapeia `delayedFromId`) → cartoes → gastos → **segundo passe tx** (remapeia `fromCartao`) → recorrentes → budgetDone → restaura `lastUpdateHistory`

**budgetDone com cartões:** keys no formato `cartao_3_202506` são detectadas pelo prefixo `cartao_` e têm o `cartaoId` remapeado via `cartaoIdMap`.

**lastUpdateHistory:** mergeado com o histórico local existente, deduplicado, limitado a 20 entradas.

---

## Regras de Recorrência do Budget

- `recurrence: 'always'` → aparece em todos os meses
- `recurrence: 'once'` → aparece só no `budgetMonth/budgetYear`
- `recurrence: 'installments'` → salvo como `'once'` com `groupId`
- `fixed`: sempre `'always'`
- `income`/`variable`: padrão `'always'`; podem ser `'once'` ou `'installments'`

---

## Subitems com Repeat

```js
{ name, value, repeat, sgid, skip, startMonth?, startYear? }
// repeat=0/undefined → fixo; repeat=N → N meses com label "Nome X/N"
// elapsed = (curYear*12+curMonth) - (subRepeatStart.year*12+subRepeatStart.month)
// Gastos de cartão: cada subitem pode ter startMonth/startYear próprio
```

**Pipeline:**
```js
getRawSubitems()                                      // salvar no banco (budget/TX)
getActiveSubitems(subs, startM, startY, curM, curY)   // exibir no mês
addSubitem(name, value, repeat, sgid, skip)            // restaurar no form
addGastoSubitem(name, value, repeat, sgid, skip, startMonth, startYear)
getRawGastoSubitems()                                  // salvar gastos
```

---

## Feature: Atrasado / Pendente (Budget)

- **`always`:** skip no mês de origem (`delayedSkipMonths`) + clone `once` no destino com `delayedFromId`
- **`once`/parcelado:** move `budgetMonth` para o destino, salva `delayedFrom`
- **Novo item:** `delayed:true` no mês atual, sem select de destino
- **Desmarcar fixo:** deleta clone + remove skip do original
- **Desmarcar once:** restaura `budgetMonth` para `delayedFrom`
- **Parcelado "Apenas esta":** branch do confirm também processa `getBudgetDelayed()`

### ⚠️ Regras Delayed
- `dueDay/dueMonthOffset` preservados do `existing` ao mover — não do form
- Select de destino só existe no HTML quando `isEdit=true`
- `getBudgetDelayed()` retorna `{to}` ou `null`; `from` calculado no save via `existing.budgetMonth`
- Ao deletar clone (`delayedFromId`): limpar skip do original em `deleteBudgetItem`

---

## Features Ativas

### Cache em Memória
Todos os `*All()` usam `_dbCache`. Toda escrita invalida automaticamente.

### Try/Catch em Funções Async
32 funções de render e CRUD protegidas com `try/catch` + `toast` vermelho + `console.error`. Auxiliares chamados dentro de funções protegidas deliberadamente sem catch (evita mensagens duplicadas).

### Validação Inline de Formulários
```js
setFieldError(id, msg)    // borda vermelha + mensagem abaixo do campo
clearFieldError(id)       // limpa (chamado no oninput e após numpad)
clearAllFieldErrors()     // limpa todos
```
CSS: `.field-invalid` (borda + shake), `.field-error-msg` / `.field-error-msg.visible`

Campos validados: `f-name`, `f-val`, `f-pnum` (TX) | `b-name`, `b-val` (budget) | `cc-name`, `cc-fech`, `cc-venc` (cartão) | `cg-name`, `cg-val`, `cg-pnum` (gasto) | `cr-name`, `cr-val` (recorrente) | `p-nome` (pessoa)

**⚠️ Regra:** ao adicionar campo com numpad, chamar `clearFieldError` tanto no `oninput` do input quanto no `if(result!==null)` do numpad.

### CSS Utility Classes (25 classes)
`.hint` `.hint-blue` `.hint-due` `.label-muted` `.label-sm` `.label-sm-green` `.row-flex` `.row-flex-wrap` `.row-between` `.row-between-sm` `.row-between-mb` `.row-between-mt` `.row-between-mt4` `.row-meta-wrap` `.row-end` `.row-gasto-actions` `.subitem-sep` `.btn-subitem-add` `.budget-summary-col` `.budget-meta-row` `.budget-due-grid` `.limite-bar-track` `.color-green-nowrap`

### Limite do Cartão
- `calcLimiteUsado(cartao, allGastos)`: gastos atuais + futuros + recorrentes
- Barra: verde <70%, âmbar 70-90%, vermelho >90%

### Recorrentes do Cartão
- Incluídos em `getCartaoBudgetItems`, `toggleBudgetDone`, `calcLimiteUsado`
- Deletados junto com o cartão

### Subitems nos Gastos
- `gastoValueForFatura(gasto, fatM, fatY)`: valor/subitems ativos para a fatura
- Novos subitems ao editar recebem `startMonth=curMonth/curYear`

### Última Atualização (Dashboard)
- `markLastUpdate()` → abre confirm → `_doMarkLastUpdate()` salva timestamp
- `loadLastUpdate()` → exibe a data mais recente
- `showUpdateHistory()` → modal com histórico completo (clique no label)
- `clearUpdateHistory()` → limpa com confirmação
- Armazenado em `localStorage.lastUpdateHistory` (array, máx 20 entradas)
- Incluído no export/import v6

### toggleBudgetDone com Confirmação
- Ao **marcar**: abre `showConfirm` antes de criar lançamento
- Ao **desmarcar**: desfaz diretamente sem confirmação

### Saldo no Resumo do Orçamento
- `doneSaldo = doneIncome - doneExpense` — verde/vermelho

---

## Funções Críticas — Padrões e Armadilhas

### ⚠️ REGRA #1 — getFormValues() destruturação
```js
const{name,val,rawExpr,type,date,paidDate,month,year,obs,subitems,pessoaId}=getFormValues();
// Atualizar TODOS os callers ao adicionar campo novo
```

### ⚠️ REGRA #2 — addSubitem() assinatura
```js
addSubitem(name, value, repeat, sgid, skip)
addGastoSubitem(name, value, repeat, sgid, skip, startMonth, startYear)
```

### ⚠️ REGRA #3 — renderSubitemsHtml()
```js
renderSubitemsHtml(subitems)  // array de {name, value} já processados
```

### ⚠️ REGRA #4 — IDs de subitems areas
TX: `subitems-area` | Budget: `modal-b-subitems-area` | Gasto: `cg-subitems-area` | Recorrente: `cr-subitems-area`

### ⚠️ REGRA #5 — JSON.stringify em onclick PROIBIDO
```js
onclick="editItem(${item.id})"  // CORRETO
// Funções safe: showBudgetEditById, editGasto, editRecorrente
```

### ⚠️ REGRA #6 — showBudgetEditById obrigatório
Botão editar orçamento sempre via `showBudgetEditById(item.id)` — nunca `enrichedItem`.

### ⚠️ REGRA #7 — dueMonthOffset
```js
const rawDueMonth = curMonth + (item.dueMonthOffset||0);
const dueYear = curYear + Math.floor(rawDueMonth/12);
const dueMonth = (rawDueMonth%12+12)%12;
```

### ⚠️ REGRA #8 — calcMonth() retorna credit separado
```js
const{income,expense,credit,balance} = calcMonth(all,y,m);
// balance = income - expense - credit
```

### ⚠️ REGRA #9 — enrichedItems sem repeat/sgid/skip
Nunca passar enrichedItem para funções que precisam do raw.

### ⚠️ REGRA #10 — saveBudgetEdit mescla subitems
```js
const ended = existing.subitems.filter(s=>(s.repeat||0)>0 && elap>=(s.repeat||0));
finalSubitems = [...subsFromDOM, ...ended];
```

### ⚠️ REGRA #11 — getActiveSubitems contexto
TX: `t.month, t.year` | Budget: `curMonth, curYear` | Gasto: `s.startMonth ?? subRepeatStart.month`

### ⚠️ REGRA #12 — getFaturaMonth precisa do cartão
```js
getFaturaMonth(date, cartaoObj)  // NUNCA passar o gasto como segundo argumento
```

### ⚠️ REGRA #13 — Cache: transações diretas precisam invalidar
```js
// Ao abrir db.transaction() diretamente (sem usar helpers):
invalidateCache('storeName');  // antes da operação
// ou invalidateAllCache() se múltiplos stores
```

---

## Padrões de Código

### Template literals aninhados — PROIBIDO em mobile
```js
// CORRETO: `<div>${arr.map(x => '<span>'+x+'</span>').join('')}</div>`
```

### Substituições Python — padrão obrigatório
```python
with open('js/budget.js', 'rb') as f: raw = f.read()
old = b"texto exato"
print("found:", old in raw)
if old in raw:
    raw = raw.replace(old, new, 1)
    with open('js/budget.js', 'wb') as f: f.write(raw)
# NUNCA: raw[:idx]+new+raw[end:] | NUNCA: b"" com acentos | SEMPRE: verificar found
```

### Verificação de sintaxe
```bash
node --check js/budget.js
```

---

## Componentes de UI

### Modal
```js
openModal(htmlString) | closeModal() | showConfirm(title, msg, buttons)
```

### Toggle
```html
<label class="toggle">
  <input type="checkbox" onchange="fn()">
  <div class="toggle-track"></div><div class="toggle-thumb"></div>
</label>
```

### Validação inline
```html
<input id="f-name" oninput="clearFieldError('f-name')">
<div class="field-error-msg" id="f-name-err"></div>
```

---

## Bugs Históricos — Hall of Shame

| Bug | Causa | Fix |
|-----|-------|-----|
| Lançamentos não salvando | Destruturação sem `pessoaId`/`paidDate` | Regra #1 |
| App travando mobile | Template literal aninhado | Concatenação |
| Editar budget perdia repeat | Botão passava enrichedItem | `showBudgetEditById(id)` |
| Arquivo duplicado (271k) | `raw[:idx]+new+raw[end:]` | NUNCA slice — só replace |
| Gasto mês errado | `getFaturaMonth(date, gasto)` | Passar cartaoObj |
| Parcelado delayed não restaurava | Branch "Apenas esta" sem caso desmarcar | `else if(existing.delayed&&!dEd)` |
| Select delayed em novo item | Style condicional invertido | `isEdit&&item.delayed?'display:block':'display:none'` |
| delayedFrom sobrescrito | `getBudgetDelayed` usava `curMonth` | Usar `existing.budgetMonth` |
| Clone fixo não removido ao desmarcar | else branch sem `wasAlways` | Verificar `delayedFromId` |
| Módulos: openDB not defined | `<script type="module">` carrega paralelo | Usar `<script src>` sequencial |
| MONTHS not defined | Preamble JS antes das seções não capturado | Mover para `globals.js` |
| Variáveis globais undefined | `window.*` não funciona com `<script>` normal | Declarar com `let`/`const` em globals.js |
| Cache stale após import | Import usava transações diretas | `invalidateAllCache()` após import |
| delayedFromId quebrado após import | Não era remapeado | Segundo passe com `budgetIdMap` |
| fromCartao quebrado após import | Tx importado antes de cartoes | Segundo passe com `cartaoIdMap` |
| budgetDone cartões perdido no import | Keys `cartao_*` não tratadas | Detectar prefixo + remapear cartaoId |
| clearFieldError não chamado no numpad | oninput só dispara no teclado | Adicionar `clearFieldError` no `if(result!==null)` |

---

## Estado Atual

- ✅ Modularizado em 10 arquivos JS
- ✅ Cache em memória para todos os stores
- ✅ Try/catch em 32 funções async
- ✅ Validação inline com feedback visual
- ✅ Export/import v6 (recorrentes + lastUpdateHistory + segundo passe de remapeamento)
- ✅ Histórico de última atualização com confirmação
- ✅ Confirmação no toggleBudgetDone (só ao marcar)
- ✅ 25 CSS utility classes

## Próximas Melhorias Planejadas
- [ ] Gráficos/visualizações no dashboard
- [ ] OFX/QFX importer (Nubank suporta nativamente)
- [ ] Separar `cards.js` (~47k) em dois módulos
- [ ] Onboarding para novo usuário
