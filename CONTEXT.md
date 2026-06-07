# Finanças PWA — Contexto do Projeto

## Visão Geral
PWA de finanças pessoais para Diego e Camila. App local-only (sem servidor), deployed via GitHub Pages. Arquivo único `index.html` (~188k chars). Sem frameworks — HTML/CSS/JS vanilla puro.

**Stack:** HTML5 + CSS3 + JavaScript ES2020 + IndexedDB v5 + Service Worker  
**Usuários:** Diego (dono) + Camila (responsável secundária)

---

## Arquitetura

### Páginas (nav tabs)
- `page-dash` — Dashboard (⚙️ no header → Configurações)
- `page-tx` — Lançamentos
- `page-cards` — Cartões de crédito
- `page-proj` — Projeção (3/6/12 meses)
- `page-budget` — Orçamento
- `page-cfg` — Configurações (sem tab na nav)

### IndexedDB — banco `financas_pwa_v2` versão 5
| Store | keyPath | Descrição |
|-------|---------|-----------|
| `tx` | id (autoincrement) | Lançamentos financeiros |
| `budget` | id (autoincrement) | Itens do orçamento |
| `budgetDone` | key (string) | Marcações de realizado: `budgetId_YYYYMM` |
| `pessoas` | id (autoincrement) | Responsáveis |
| `cartoes` | id (autoincrement) | Cartões de crédito |
| `gastos` | id (autoincrement) + index(cartaoId) | Gastos individuais dos cartões |
| `recorrentes` | id (autoincrement) + index(cartaoId) | Cobranças fixas mensais dos cartões |

### Estado global
```js
let db, curMonth, curYear, pessoaFilter, projPeriods, txFilter
// budgetMonth/budgetYear — DEPRECATED, usar curMonth/curYear
```

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
  dueDay,                                // dia do vencimento (1-31)
  dueMonthOffset,                        // 0=mesmo mês, 1=+1 mês, 2=+2 meses
  obs, subitems, pessoaId,
  recurrence,                            // 'always'|'once'|'installments'
  installmentCur, installmentTotal,      // só parcelado tradicional
  budgetMonth, budgetYear,               // só para 'once'/'installments'
  groupId,                               // série de parcelas
  subRepeatStart,                        // {month, year} — se tem subitems com repeat
  // campos de atraso:
  delayed,                               // bool — item marcado como atrasado
  delayedFrom,                           // {month, year} — período de origem
  delayedTo,                             // {month, year} — período destino
  delayedFromId,                         // id do item fixo original (só no clone)
  delayedSkipMonths,                     // [{month, year}] — meses pulados (só no always original)
  createdAt
}
```

### Cartão (store `cartoes`)
```js
{ id, name, fechamento, vencimento, color, pessoaId, limite, createdAt }
// limite: number (opcional) — exibe barra de uso e disponível
```

### Gasto (store `gastos`)
```js
{
  id, name, value, rawExpr, date, obs, cartaoId,
  parcela, totalParcelas, groupId,
  subitems,                              // [{name, value, repeat?, sgid?, skip?, startMonth?, startYear?}]
  subRepeatStart,                        // {month, year} — se tem subitems com repeat
  createdAt
}
```

### Recorrente (store `recorrentes`)
```js
{ id, cartaoId, name, value, subitems, obs, createdAt }
// Subitems simples: [{name, value}] — sem repeat, sem sgid
// Aparece em TODAS as faturas automaticamente, some apenas ao deletar
```

---

## Regras de Recorrência do Budget

- `recurrence: 'always'` → aparece em todos os meses
- `recurrence: 'once'` → aparece só no `budgetMonth/budgetYear`
- `recurrence: 'installments'` → salvo como `'once'` com `groupId` compartilhado
- `income` e `variable`: padrão `'always'`; podem ser `'once'` ou `'installments'`
- `fixed`: sempre `'always'`

---

## Subitems com Repeat

### Budget (`budget.subitems`) e TX (`tx.subitems`)
```js
{
  name, value,
  repeat,      // 0/undefined=fixo (sem fim), N>=1=limitado a N meses
  sgid,        // subitem group id — gerado ao ativar ⟳
  skip,        // number[] — elapsed indices a pular
  // campos opcionais para gastos de cartão:
  startMonth,  // mês de início individual deste subitem
  startYear,   // ano de início individual deste subitem
}
```

**Como funciona:**
- `repeat=0/undefined` → fixo, sempre aparece
- `repeat=N` → aparece N meses com label `"Nome X/N"`
- `skip=[1,3]` → pula elapsed 1 e 3
- `elapsed = (curYear*12+curMonth) - (subRepeatStart.year*12+subRepeatStart.month)`
- Para gastos de cartão: cada subitem pode ter `startMonth/startYear` próprio (adicionados em meses diferentes)

**Pipeline:**
```js
getRawSubitems()                                     // → salvar no banco (preserva repeat/sgid/skip)
getActiveSubitems(subs, startM, startY, curM, curY)  // → exibir (calcula ativos para o mês)
getSubitems()                                        // → total do form
addSubitem(name, value, repeat, sgid, skip)          // → restaurar no form de edição
```

**Para gastos de cartão:**
```js
getRawGastoSubitems()                                // → salvar (preserva repeat/sgid/skip/startMonth/startYear)
addGastoSubitem(name, value, repeat, sgid, skip, startMonth, startYear)
```

---

## Feature: Atrasado / Pendente (Budget)

Permite mover um item de orçamento para outro período marcando-o como atrasado.

### Comportamento por tipo:
- **`always` (fixo):** adiciona `curMonth` ao `delayedSkipMonths` do original → some daquele mês. Cria um item `once` no destino com `delayed:true` e `delayedFromId` apontando para o original.
- **`once`/parcelado:** move o `budgetMonth/budgetYear` para o destino. Salva `delayedFrom` para poder restaurar.
- **Novo item:** `delayed:true` salvo no `curMonth` — sem select de destino.

### Ao desmarcar:
- Clone de fixo (`delayedFromId != null`): deleta o clone + limpa o skip no original.
- Once/parcelado: restaura `budgetMonth` para `existing.delayedFrom`.

### ⚠️ REGRA — delayed e parcelados:
Parcelados detectam série (`isSeries=true`) antes de chegar no branch geral do `saveBudgetEdit`. O confirm "Apenas esta" também precisa processar `getBudgetDelayed()` — não assume que o save chega no `else` final.

### ⚠️ REGRA — dueDay preservado ao atrasar:
Ao mover item atrasado, usar `existing.dueDay` e `existing.dueMonthOffset` — não os valores do form. O vencimento original é referência histórica.

### `getBudgetDelayed()`:
```js
// Retorna {to: {month, year}} ou {noDestino: true} ou null
// from é calculado no save a partir de existing.budgetMonth/budgetYear
// O select de destino só existe no HTML quando isEdit=true
```

---

## Feature: Limite do Cartão

- Campo `limite` no cartão (opcional)
- `calcLimiteUsado(cartao, allGastos)`: soma gastos de faturas atuais + futuras + recorrentes
- Para gastos com `subRepeatStart`: itera sobre todos os N meses do repeat
- Exibe barra de uso com cor: verde <70%, âmbar 70-90%, vermelho >90%
- Disponível mostra negativo se ultrapassou o limite

## Feature: Recorrentes do Cartão

- Store `recorrentes`: cobranças fixas que aparecem toda fatura automaticamente
- Seção separada "🔄 Recorrências" no card do cartão (borda teal)
- Entram no cálculo do limite e no total da fatura
- `getCartaoBudgetItems` inclui recorrentes no orçamento
- `toggleBudgetDone` inclui recorrentes no lançamento de fatura
- Ao deletar cartão: recorrentes são removidos junto

## Feature: Subitems nos Gastos do Cartão

- Modal de gasto tem área de subitems com ⟳ para repeat
- `subRepeatStart` = mês da fatura onde foi criado
- Cada subitem pode ter `startMonth/startYear` próprio (adicionados em edições posteriores)
- `gastoValueForFatura(gasto, fatM, fatY)`: retorna valor/subitems ativos para a fatura
- `getCartaoFaturaGastos(cartaoId, fatM, fatY)`: retorna gastos ativos para a fatura (inclui subRepeatStart)
- Gastos com todos subitems expirados somem da fatura
- `removeGastoSubitem`: repeat=1 → confirm simples; repeat>1 → 3 opções (só este, este e seguintes, todos)

## Feature: Última Atualização (Dashboard)

- `markLastUpdate()`: salva timestamp em `localStorage`
- `loadLastUpdate()`: atualiza label no dashboard
- Widget discreto entre filtro de pessoa e summary-cards
- Manual apenas — nunca auto-atualiza

## Feature: Saldo no Resumo do Orçamento

- Terceira linha no `budget-summary-text`: saldo realizado / saldo total
- `doneSaldo = doneIncome - doneExpense`
- Cor verde se positivo, vermelho se negativo

---

## Funções Críticas — Padrões e Armadilhas

### ⚠️ REGRA #1 — Destruturação de getFormValues()
```js
const{name,val,rawExpr,type,date,paidDate,month,year,obs,subitems,pessoaId}=getFormValues();
// Se adicionar campo novo, atualizar TODOS os callers
```

### ⚠️ REGRA #2 — addSubitem() assinatura atual
```js
addSubitem(name, value, repeat, sgid, skip)  // budget/TX
addGastoSubitem(name, value, repeat, sgid, skip, startMonth, startYear)  // gastos cartão
// REMOVIDOS: addSubitem('tx',...) e addSubitem('budget',...)
```

### ⚠️ REGRA #3 — renderSubitemsHtml() assinatura
```js
renderSubitemsHtml(subitems)  // array de {name, value} — já processados
// REMOVIDA: versão antiga com prefix/id
```

### ⚠️ REGRA #4 — IDs de subitems areas
- TX: `id="subitems-area"`
- Budget modal: `id="modal-b-subitems-area"`
- Gasto cartão: `id="cg-subitems-area"`
- Recorrente: `id="cr-subitems-area"`

### ⚠️ REGRA #5 — JSON.stringify em onclick PROIBIDO
```js
// ERRADO
onclick="editItem(${JSON.stringify(item)})"
// CORRETO
onclick="editItem(${item.id})"
// Funções safe: showBudgetEditById(id), editGasto(cartaoId, gastoId), editRecorrente(id)
```

### ⚠️ REGRA #6 — showBudgetEditById obrigatório
O botão editar do orçamento **sempre** usa `showBudgetEditById(item.id)` — busca raw do banco. Nunca passar `enrichedItem` diretamente (subitems sem repeat/sgid/skip).

### ⚠️ REGRA #7 — dueMonthOffset no vencimento
```js
const offset = item.dueMonthOffset || 0;
const rawDueMonth = curMonth + offset;
const dueYear = curYear + Math.floor(rawDueMonth / 12);
const dueMonth = (rawDueMonth % 12 + 12) % 12;
// NUNCA usar curMonth/curYear diretamente como mês de vencimento
```

### ⚠️ REGRA #8 — calcMonth() retorna credit separado
```js
const{income, expense, credit, balance} = calcMonth(all, y, m);
// expense NÃO inclui credit — balance = income - expense - credit
```

### ⚠️ REGRA #9 — enrichedItems tem subitems SEM repeat/sgid/skip
```js
// NUNCA passar enrichedItem para funções que precisam do raw:
showBudgetEditById(item.id)  // CORRETO — busca raw do banco
```

### ⚠️ REGRA #10 — saveBudgetEdit com subRepeatStart
```js
// Mesclar subitems do DOM com encerrados do banco:
const ended = existing.subitems.filter(s => (s.repeat||0) > 0 && elap >= (s.repeat||0));
finalSubitems = [...subsFromDOM, ...ended];
```

### ⚠️ REGRA #11 — getActiveSubitems: TX vs Budget
```js
// TX: passar t.month, t.year (mês do lançamento)
// Budget: passar curMonth, curYear (mês do filtro)
// Gastos cartão: cada subitem usa s.startMonth??subRepeatStart.month
```

### ⚠️ REGRA #12 — recurrence 'always' forçado para subitems com repeat
```js
// saveBudgetItem detecta subitems com repeat:
const hasSubRepeat = subitems.some(s => s.repeat > 0);
if(hasSubRepeat) → força recurrence:'always' + subRepeatStart
```

### ⚠️ REGRA #13 — dataset.userChanged no select de recorrência
```js
// onBudgetTypeChange: só muda padrão se !recurSel.dataset.userChanged
// onBudgetRecurChange: seta dataset.userChanged='1'
```

### ⚠️ REGRA #14 — Exclusão de parcelas
`deleteBudgetItem(id)`: detecta série por `groupId` OU `installmentTotal>1&&recurrence==='once'`. Oferece 3 opções + limpa skip se item era clone delayed.

### ⚠️ REGRA #15 — Gastos cartão: getFaturaMonth precisa do cartão, não do gasto
```js
// ERRADO — getFaturaMonth(date, existing) onde existing é o gasto
// CORRETO — getFaturaMonth(date, cartaoObj) onde cartaoObj é buscado do banco
```

### ⚠️ REGRA #16 — Subitems de gasto: startMonth/startYear individual
```js
// Ao editar gasto existente, novos subitems recebem startMonth=curMonth/curYear
// Subitems existentes preservam startMonth do banco (ou subRepeatStart como fallback)
// getRawGastoSubitems() serializa startMonth/startYear quando presentes
```

---

## Padrões de Código

### Template literals aninhados — PROIBIDO
```js
// ERRADO
return `<div>${arr.map(x => `<span>${x}</span>`)}</div>`
// CORRETO
return `<div>${arr.map(x => '<span>'+x+'</span>')}</div>`
```

### Substituições Python — padrão obrigatório
```python
with open('index.html', 'rb') as f: raw = f.read()
old = b"texto com \xc3\xa7 acento"
print("found:", old in raw)
if old in raw:
    raw = raw.replace(old, new, 1)
    with open('index.html', 'wb') as f: f.write(raw)
# NUNCA: raw[idx:end] (causa duplicação)
# NUNCA: bytes b"" com acentos/emojis — usar \xNN ou .encode('utf-8')
# SEMPRE: verificar "found: True" antes de prosseguir
```

### Verificação de sintaxe obrigatória
```bash
python3 -c "
import subprocess, tempfile, os
with open('index.html') as f: content = f.read()
script = content[content.find('<script>')+8:content.rfind('</script>')]
with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
    f.write(script); tmp = f.name
r = subprocess.run(['node','--check',tmp], capture_output=True, text=True)
print('OK' if r.returncode==0 else r.stderr[:300])
os.unlink(tmp)
"
```

### ⚠️ NUNCA usar slice para inserir conteúdo
```python
# ERRADO — causa duplicação se end calculado errado:
raw = raw[:idx] + new + raw[end:]

# CORRETO — sempre usar replace com old/new:
raw = raw.replace(old, new, 1)
```

---

## Componentes de UI

### Sistema de Modal
```js
openModal(htmlString)           // abre em #modal-content
closeModal()
showConfirm(title, msg, buttons)
// dataset do modal ao editar:
document.getElementById('modal-content').dataset.editingId = id
document.getElementById('modal-content').dataset.subRepeatStart = JSON.stringify(srs)
document.getElementById('modal-content').dataset.origMonth = String(m)  // para delayed
document.getElementById('modal-content').dataset.origYear = String(y)
```

### Toggle (igual ao de parcelas)
```html
<label class="toggle">
  <input type="checkbox" id="b-delayed-toggle" onchange="onBudgetDelayedToggle()">
  <div class="toggle-track"></div><div class="toggle-thumb"></div>
</label>
```

### CSS classes úteis
```css
.badge-amber      /* background:var(--amber-bg);color:var(--amber) */
.btn-calc         /* botão de calculadora */
.btn-clear-date   /* botão de limpar data */
.card-gasto-col   /* flex-direction:column para cards de gasto com subitems */
```

---

## Export/Import — versão 5
```js
{ version:5, exportedAt, data, budget, pessoas, cartoes, gastos, budgetDone }
// recorrentes NÃO está no backup ainda
```

---

## Bugs Históricos — Hall of Shame

| Bug | Causa | Fix |
|-----|-------|-----|
| Lançamentos não salvando | Destruturação sem `pessoaId` ou `paidDate` | Regra #1 |
| App travando em mobile | Template literal aninhado com backtick | Concatenação |
| Budget itens sumindo | `renderSubitemsHtml` assinatura mudou | Regra #3 |
| Editar budget perdia repeat | Botão passava enrichedItem | `showBudgetEditById(id)` |
| Subitems encerrados sumiam | `saveBudgetEdit` só lia DOM | Mesclar DOM + ended do banco |
| `0/3` e `-1/3` em meses anteriores | `elapsed < 0` não guardado | Guard `elapsed >= 0` |
| Caracteres quebrados | Bytes b"" com acentos | Usar `\xNN` ou `.encode()` |
| Arquivo duplicado (271k) | `raw[:idx] + new + raw[end:]` com end errado | NUNCA usar slice — só replace |
| Gasto movido para mês errado | `getFaturaMonth(date, gasto)` — gasto não tem fechamento | Passar cartaoObj |
| Parcelado delayed não restaurava | Branch "Apenas esta" não tinha caso de desmarcar | Adicionar `else if(existing.delayed&&!dEd)` |
| Select delayed em novo item | Style `${isEdit&&item.delayed?'':'display:none'}` invertido | `?'display:block':'display:none'` |
| delayedFrom sobrescrito ao mover novamente | getBudgetDelayed usava curMonth como from | Usar existing.budgetMonth como from |
| Clone de fixo não removido ao desmarcar | else branch não detectava wasAlways | Verificar `delayedFromId` e deletar clone |

---

## Riscos Técnicos Atuais

1. **Arquivo único de ~188k chars** — substituições podem colidir, usar sempre bytes exatos
2. **85% das funções async sem try/catch** — erros silenciosos
3. **`recorrentes` não está no backup/import** — dados perdidos ao restaurar
4. **`dbAll()` chamado múltiplas vezes por render** — sem cache

## Próximas Melhorias Planejadas
- [ ] Incluir `recorrentes` no export/import
- [ ] Try/catch em todas as funções async de render
- [ ] Cache em memória para IndexedDB
- [ ] Separação em módulos JS quando arquivo ultrapassar 200k chars
