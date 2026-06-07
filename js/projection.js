function setProjPeriods(n,btn){
  projPeriods=n;
  document.querySelectorAll('#proj-tab-3,#proj-tab-6,#proj-tab-12').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderProj();
}
async function renderProj(){
  const all=await dbAll();
  let html='',totIncome=0,totExpense=0,totBalance=0;
  for(let i=0;i<projPeriods;i++){
    const m=(curMonth+i)%12,y=curYear+Math.floor((curMonth+i)/12);
    const{income,expense,credit,balance}=calcMonth(all,y,m);
    totIncome+=income;totExpense+=expense+credit;totBalance+=balance;
    const bColor=balance>=0?'var(--green)':'var(--red)';
    const isNow=m===curMonth&&y===curYear;
    html+=`<div class="proj-row" style="${isNow?'border-color:var(--blue);background:var(--blue-bg)':''}">
      <span class="proj-month-name">${MONTHS[m].substring(0,3)} ${y}${isNow?' <span style="font-size:10px;color:var(--blue)"> atual</span>':''}</span>
      <div class="proj-vals">
        <span style="color:var(--green)">${fmt(income)}</span>
        <span style="color:var(--red)">${fmt(expense+credit)}</span>
        <span class="proj-balance" style="color:${bColor}">${totBalance>=0&&balance>=0?'+':'-'}${fmt(balance)}</span>
      </div>
    </div>`;
  }
  document.getElementById('proj-list').innerHTML=html||`<div class="empty">Sem dados cadastrados</div>`;
  const totColor=totBalance>=0?'var(--green)':'var(--red)';
  document.getElementById('proj-total').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;font-weight:600;color:var(--text2)">TOTAL ${projPeriods} MESES</span>
      <div style="display:flex;gap:10px;font-family:var(--mono);font-size:12px;font-weight:600">
        <span style="color:var(--green)">${fmt(totIncome)}</span>
        <span style="color:var(--red)">${fmt(totExpense)}</span>
        <span style="color:${totColor};min-width:80px;text-align:right">${totBalance>=0?'+':'-'}${fmt(totBalance)}</span>
      </div>
    </div>`;

}