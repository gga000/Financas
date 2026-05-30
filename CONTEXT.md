# Finanças PWA — Contexto do Projeto

## Visão Geral
PWA de finanças pessoais para Diego e Camila. App local-only (sem servidor), deployed via GitHub Pages. Arquivo único `index.html` (~135k chars, 2665 linhas). Sem frameworks — HTML/CSS/JS vanilla puro.

**URL:** https://[usuario].github.io/financas  
**Stack:** HTML5 + CSS3 + JavaScript ES2020 + IndexedDB v4 + Service Worker  
**Usuários:** Diego (dono) + Camila (responsável secundária)

---

## Arquitetura

### Estrutura do arquivo único
```
index.html
├── <head>          PWA meta, manifest, fonts, theme-color
├── <style>         ~519 linhas de CSS (variables, components, pages)
├── <body>          HTML das 6 páginas + modal + confirmação
└── <script>        ~2146 linhas de JS (toda a lógica)
```

### Páginas (nav tabs)
- `page-dash` — Início/Dashboard (ícone ⚙️ no header → Configurações)
- `page-tx` — Lançamentos
- `page-cards` — Cartões de crédito
- `page-proj` — Projeção (3/6/12 meses)
- `page-budget` — Orçamento
- `page-cfg` — Configurações (sem tab na nav, acessado pelo ⚙️ ou `showPageCfg()`)

### IndexedDB — banco `financas_pwa_v2` versão 4
| Store | keyPath | Descrição |
|-------|---------|-----------|
| `tx` | id (autoincrement) | Lançamentos financeiros |
| `budget` | id (autoincrement) | Itens do orçamento |
| `budgetDone` | key (string) | Marcações de realizado: `budgetId_YYYYMM` |
| `pessoas` | id (autoincrement) | Responsáveis (Diego, Camila, etc.) |
| `cartoes` | id (autoincrement) | Cartões de crédito cadastrados |
| `gastos` | id (autoincrement) + index(cartaoId) | Gastos individuais dos cartões |

### Estado global (variáveis globais)
```js
let db             // instância do IndexedDB
let curMonth       // mês atual selecionado (0-11)
let curYear        // ano atual selecionado
let pessoaFilter   // null = todos, ou id da pessoa filtrada
let projPeriods    // 3, 6 ou 12 meses na projeção
let txFilter       // 'all'|'income'|'fixed'|'variable'|'credit'
let budgetMonth    // DEPRECATED - agora usa curMonth
let budgetYear     // DEPRECATED - agora usa curYear
```

---

## Modelos de Dados

### Transaction (store `tx`)
```js
{
  id, name, value, rawExpr,        // rawExpr: expressão original da calculadora
  type,                            // 'income'|'fixed'|'variable'|'credit'
  month, year, ym,                 // ym = year*100+month (índice)
  date,                            // ISO string vencimento (opcional)
  paidDate,                        // ISO string data de pagamento (opcional)
  obs, subitems,                   // subitems: [{name, value}]
  pessoaId,                        // FK → pessoas.id
  groupId,                         // série de repetição
  recurring,                       // bool: criado via repetição mensal
  fromBudget,                      // bool: gerado ao marcar orçamento como realizado
  fromCartao,                      // id do cartão (se veio de fatura)
  createdAt
}
```

### Budget Item (store `budget`)
```js
{
  id, name, value, rawExpr,
  type,                            // 'income'|'fixed'|'variable'
  dueDay,                          // dia do vencimento (1-31)
  obs, subitems,
  pessoaId,
  recurrence,                      // 'always'|'once'|'installments'
  installmentCur,                  // parcela atual (ex: 2)
  installmentTotal,                // total de parcelas (ex: 6)
  budgetMonth,                     // mês que pertence (0-11) — só para 'once'/'installments'
  budgetYear,                      // ano que pertence — só para 'once'/'installments'
  groupId,                         // série de parcelas
  createdAt
}
```

**Regras de recorrência:**
- `recurrence: 'always'` → fixos e receitas, aparecem em TODOS os meses
- `recurrence: 'once'` → variáveis únicas, aparecem APENAS no `budgetMonth/budgetYear`
- `recurrence: 'installments'` → salvo como `'once'` com groupId compartilhado, cada item tem seu próprio `budgetMonth/budgetYear`

### Cartão (store `cartoes`)
```js
{
  id, name,
  fechamento,    // dia de fechamento (gastos >= fechamento → próxima fatura)
  vencimento,    // dia de vencimento da fatura
  color,         // hex color
  pessoaId,      // responsável pelo cartão (herdado pelos gastos)
  createdAt
}
```

### Gasto (store `gastos`)
```js
{
  id, name, value, rawExpr,
  date,           // ISO string da data do gasto
  obs,
  cartaoId,       // FK → cartoes.id
  parcela,        // número da parcela atual
  totalParcelas,  // total de parcelas
  groupId,        // série de parcelas parceladas
  createdAt
}
```

### BudgetDone (store `budgetDone`)
```js
{
  key,        // formato: `${budgetId}_${year}${String(month+1).padStart(2,'0')}`
              // ex: "42_202506" ou "cartao_3_202506"
  budgetId,   // id do item de orçamento (number) ou 'cartao_X' (string)
  txId,       // id do lançamento criado ao marcar como realizado
  doneAt
}
```

---

## Funções Críticas — Padrões e Armadilhas

### ⚠️ REGRA #1 — Destruturação de getFormValues()
**Todo** `saveEntry()` e `updateEntry()` DEVE destruturar todos os campos:
```js
const{name,val,rawExpr,type,date,paidDate,month,year,obs,subitems,pessoaId}=getFormValues();
```
Se adicionar campo novo ao `getFormValues()`, atualizar TODOS os callers. Bug histórico recorrente — `pessoaId` e `paidDate` já causaram lançamentos silenciosamente não salvos.

### ⚠️ REGRA #2 — addSubitem() assinatura
```js
// CORRETO
addSubitem(name, value)
addSubitem()  // adiciona linha vazia

// ERRADO — modo foi removido
addSubitem('tx', name, value)   // NÃO EXISTE MAIS
addSubitem('budget', name, value) // NÃO EXISTE MAIS
```

### ⚠️ REGRA #3 — renderSubitemsHtml() assinatura
```js
// CORRETO — single argument
renderSubitemsHtml(subitems)  // array de {name, value}

// ERRADO — versão antiga com prefix/id foi removida
renderSubitemsHtml('budget-', item.id, item.subitems) // NÃO EXISTE MAIS
```

### ⚠️ REGRA #4 — IDs de subitems areas
- Formulário de TX: `id="subitems-area"` (no template literal em `entryFormHtml()`)
- Modal de orçamento: `id="modal-b-subitems-area"` (no template literal em `showBudgetAddModal()`)
- `addSubitem()` e `getSubitems()` buscam `modal-b-subitems-area` primeiro, depois `subitems-area`

### ⚠️ REGRA #5 — JSON.stringify em onclick
**Nunca** usar `JSON.stringify(objeto)` diretamente em atributos `onclick` HTML:
```js
// ERRADO — quebra com aspas simples nos valores
onclick="editItem(${JSON.stringify(item)})"

// CORRETO — passar só o id, buscar do DB na função
onclick="editItem(${item.id})"
async function editItem(id){ const item = await dbFindById(id); ... }
```
Funções safe: `editGasto(cartaoId, gastoId)`, `editCartao(cartaoId)`, `showEditModal(id)`

### ⚠️ REGRA #6 — addMonths() com data vazia
```js
// ERRADO — addMonths('', 1) retorna string inválida
d = addMonths(d, 1)

// CORRETO — sempre guard
const nd = addMonths(d, 1); if(nd) d = nd;
// ou
if(d){ const nd = addMonths(d,1); if(nd) d = nd; }
```

### ⚠️ REGRA #7 — Lógica de fatura do cartão
- Gasto no dia >= `cartao.fechamento` → entra na **próxima** fatura
- Gasto no dia < `cartao.fechamento` → entra na fatura **atual**
- Fatura aparece no orçamento no mês do **vencimento** (não do fechamento)
- `getFaturaMonth(dateISO, cartao)` retorna `{month, year}` da fatura correta

### ⚠️ REGRA #8 — calcMonth() retorna credit separado
```js
const{income, expense, credit, balance} = calcMonth(all, y, m);
// expense NÃO inclui credit (evita double-count no dashboard)
// balance = income - expense - credit
// Para mostrar total de saídas: expense + credit
```

---

## Padrões de Código

### Template literals aninhados — PROIBIDO
```js
// ERRADO — backtick dentro de backtick quebra em mobile
return `<div>${arr.map(x => `<span>${x}</span>`).join('')}</div>`

// CORRETO — concatenação de string para o nível interno
return `<div>${arr.map(x => '<span>'+x+'</span>').join('')}</div>`
```

### Verificação de sintaxe obrigatória após toda edição
```bash
node --check index.html  # não, só funciona com .js
# usar:
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

### Padrão de edição segura com Python
```python
# SEMPRE buscar o texto exato antes de substituir
# SEMPRE verificar se a substituição encontrou (contar ocorrências)
# NUNCA usar replace() sem verificar count de resultados
if 'texto_exato' in content:
    content = content.replace('texto_exato', 'novo_texto', 1)
    print("OK")
else:
    print("NOT FOUND - verificar")
```

---

## Componentes de UI

### Sistema de Modal
```js
openModal(htmlString)    // abre modal com conteúdo
closeModal()             // fecha
showConfirm(title, msg, buttons)  // diálogo de confirmação com múltiplos botões
```

### Toast notifications
```js
toast('mensagem')                    // default (azul)
toast('mensagem', 'var(--green)')    // verde
toast('mensagem', 'var(--red)')      // vermelho
toast('mensagem', 'var(--amber)')    // amarelo
toast('mensagem', 'var(--teal)')     // teal
```

### Calculadora numérica
```js
const result = await openNumpad(valorAtual)
// result: string com número ou expressão (ex: "100+50")
// hasOp(str) → true se tem operadores matemáticos
// evalExpr(str) → avalia expressão, retorna number
```

### Cores das pessoas
```js
const PERSON_COLORS = ['#5b8eff','#3ddc84','#ff6b6b','#ffb547','#a78bfa','#2dd4bf']
```

### Cores dos cartões
```js
const CARD_COLORS = ['#7b2d8b','#e07b00','#0070cc','#00a86b','#c0392b','#0097a7',
                     '#d4380d','#6d3fdc','#1565c0','#00796b','#ad1457','#f57c00']
```

---

## Fluxo de Sincronização de Período

Todos os passadores de período compartilham `curMonth`/`curYear`:
```js
changeMonth(delta)      // único ponto de mudança de período
updateMonthLabels()     // atualiza labels em: dash, tx, cards, budget
renderAll()             // re-renderiza a página ativa
```
`renderBudget()` usa `curMonth/curYear` — `budgetMonth/budgetYear` são legados e não devem ser usados.

---

## Filtro de Pessoa

- Estado: `pessoaFilter` (null = todos, ou id numérico)
- Aplicado em: Dashboard, Lançamentos, Projeção, Orçamento
- Barra de filtro: `person-filter-bar-dash`, `person-filter-bar-tx`, `person-filter-bar-budget`
- `setPessoaFilter(id, btn)` — atualiza estado e re-renderiza
- Ao deletar pessoa: resetar `pessoaFilter` se era essa pessoa

---

## Export/Import

**Versão atual do backup: 5**

```js
// Estrutura do JSON exportado
{
  version: 5,
  exportedAt: ISO string,
  data: [...],         // tx store
  budget: [...],       // budget store
  pessoas: [...],      // pessoas store
  cartoes: [...],      // cartoes store
  gastos: [...],       // gastos store
  budgetDone: [...]    // budgetDone store
}
```

**Import remapeia IDs:**
1. Pessoas → `pessoaIdMap` (oldId → newId)
2. Budget → `budgetIdMap` (oldId → newId)
3. Cartões → `cartaoIdMap` (oldId → newId)
4. TX e gastos usam os mapas para corrigir FKs

---

## Bugs Históricos — Hall of Shame

| Bug | Causa | Fix |
|-----|-------|-----|
| Lançamentos não salvando | Destruturação sem `pessoaId` ou `paidDate` | Regra #1 acima |
| Subitens não funcionando | `addSubitem('budget', name, val)` — modo removido | Regra #2 acima |
| Budget itens sumindo | `renderSubitemsHtml('budget-', id, subs)` — assinatura mudou | Regra #3 acima |
| Fatura do cartão não aparecia | `getCartaoBudgetItems()` sem params `(tm, ty)` não definidos | Sempre passar `curMonth, curYear` |
| App travando silenciosamente | Template literal aninhado com backtick | Regra acima — usar concatenação |
| `renderBudget` não rodava | `getCartaoBudgetItems()` lançava erro sem catch | try/catch em calls de stores |
| Parcela orçamento não fechava form | Faltava `closeModal(); renderBudget()` no branch installments | Sempre fechar modal no final |
| Item único aparecia em todos os meses | `saveBudgetItem` não salvava `budgetMonth/budgetYear` | Regra de recorrência acima |

---

## Riscos Técnicos Atuais

1. **85% das funções async sem try/catch** — erros silenciosos
2. **Arquivo único de 135k chars** — substituições podem colidir
3. **`dbAll()` chamado múltiplas vezes por render** — sem cache
4. **Template literals gerados por JS** — difícil debugar visualmente

## Próximas Melhorias Planejadas
- [ ] Cache em memória para IndexedDB (invalidação por evento)
- [ ] Try/catch em todas as funções async de render
- [ ] Separação em módulos JS quando arquivo ultrapassar 180k chars
- [ ] Event delegation para cards dinâmicos (substituir onclick inline)
