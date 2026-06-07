// Variáveis globais compartilhadas entre todos os módulos
// Atribuídas ao window para compatibilidade com o código existente
window.db = null;
window.curMonth = new Date().getMonth();
window.curYear = new Date().getFullYear();
window.txFilter = 'all';
window.pessoaFilter = null;
window.projPeriods = 3;
window.budgetMonth = new Date().getMonth();
window.budgetYear = new Date().getFullYear();
window.deferredInstall = null;
window._numpadExpr = '';
