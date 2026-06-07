const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const ICONS={income:'💵',fixed:'🏠',variable:'🛒',credit:'💳'};
const CAT_LABELS={income:'Receita',fixed:'Despesa Fixa',variable:'Despesa Variável',credit:'Cartão de Crédito'};
let db, curMonth=new Date().getMonth(), curYear=new Date().getFullYear(), txFilter='all';
let budgetMonth=new Date().getMonth(), budgetYear=new Date().getFullYear();
let deferredInstall=null;
