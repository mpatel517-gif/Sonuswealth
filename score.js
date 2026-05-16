// ─── Finio score harness ─────────────────────────────────────────────────────
// Mirrors fq-calculator.js logic exactly. No ES imports needed.
// Run: node score.js
// ─────────────────────────────────────────────────────────────────────────────

const TAX = {
  pa: 12570, brl: 37700, brt: 50270, br: 0.20, hr: 0.40, ar: 0.45,
  art: 125140, nrb: 325000, rnrb: 175000, rnrbTaper: 2000000, ihtRate: 0.40,
  cgaAllowance: 3000, isaAllowance: 20000, pensionAA: 60000, swr: 0.04,
  deadline: new Date('2027-04-06'), giftExemption: 3000,
  lsa: 268275, lsdba: 1073100, ver: 'UK-2026.1',
};

function daysLeft() {
  return Math.max(0, Math.round((TAX.deadline - new Date()) / 86400000));
}
function netWorth(e) {
  const a = e.assets || {};
  return (a.sipp?.total||0)+(a.isa?.value||0)+(a.residence?.value||0)+(a.portfolio?.value||0)+(a.cash?.total||0);
}
function investable(e) {
  const a = e.assets || {};
  return (a.sipp?.total||0)+(a.isa?.value||0)+(a.portfolio?.value||0)+(a.cash?.total||0);
}
function guardrail(e) { return investable(e) * TAX.swr; }
function fqBand(s) {
  if (s<=20) return {name:'Exposed',colour:'#FF6B6B'};
  if (s<=40) return {name:'Building',colour:'#FFB347'};
  if (s<=60) return {name:'Established',colour:'#4D8EFF'};
  if (s<=80) return {name:'Optimised',colour:'#00E5A8'};
  return {name:'Exceptional',colour:'#00E5A8'};
}
function riskBand(s) {
  if (s<=20) return {name:'Exposed',colour:'#FF3B30'};
  if (s<=40) return {name:'Vulnerable',colour:'#FF6B6B'};
  if (s<=60) return {name:'Managed',colour:'#FFB347'};
  if (s<=80) return {name:'Protected',colour:'#4D8EFF'};
  return {name:'Resilient',colour:'#00E5A8'};
}
function ihtDynamic(e, includeSipp=true, drawdownOverride=null) {
  const a = e.assets; if (!a) return {iht:0};
  const dd = drawdownOverride !== null ? drawdownOverride : (e.drawdown||0);
  const resShare = (a.residence?.value||0)*(a.residence?.ownershipShare||1);
  const sippVal  = includeSipp ? Math.max(0,(a.sipp?.total||0)-dd) : 0;
  const isaVal   = a.isa?.value||0;
  const giaVal   = a.portfolio?.bpr ? 0 : (a.portfolio?.value||0);
  const cashVal  = a.cash?.own||0;
  const protE    = (a.protection?.lifeInsurance?.exists && !a.protection.lifeInsurance.inTrust)
                     ? (a.protection.lifeInsurance.amount||0) : 0;
  const gross = resShare+sippVal+isaVal+giaVal+cashVal+protE;
  let nrb=TAX.nrb; if (e.isCouple) nrb*=2;
  let rnrb=TAX.rnrb; if (e.isCouple) rnrb*=2;
  if (gross>TAX.rnrbTaper) rnrb=Math.max(0,rnrb-(gross-TAX.rnrbTaper)/2);
  const taxable=Math.max(0,gross-nrb-rnrb);
  return {iht:Math.round(taxable*TAX.ihtRate)};
}
function costOfInaction(e) {
  return Math.max(0,ihtDynamic(e,true).iht-ihtDynamic(e,false).iht);
}
function _isStale(d) {
  if (!d) return true;
  return (Date.now()-new Date(d)) > 3*365.25*86400000;
}

// ── FINIO-1.0 ─────────────────────────────────────────────────────────────────
function calcFQ(e) {
  const a=e.assets||{}, nw=netWorth(e), retNum=(e.targetIncome||50000)/TAX.swr;
  const drawdown=e.drawdown||0, prot=a.protection||{}, dl=daysLeft();
  const age=e.age||0, sipp=a.sipp?.total||0, coi=costOfInaction(e);

  let behaviour=15;
  if ((a.isa?.value||0)>0) behaviour+=2;
  if (a.trustGifts) behaviour+=1;
  const freshNoms=(a.sipp?.pensions||[]).filter(p=>p.nominationDate&&(Date.now()-new Date(p.nominationDate))<2*365.25*86400000).length;
  if (freshNoms>0) behaviour+=1;
  if (drawdown>0||age<55) behaviour+=1;
  behaviour=Math.min(20,behaviour);

  const capRatio=retNum>0?nw/retNum:0;
  const capital=capRatio>=2.0?18:capRatio>=1.5?16:capRatio>=1.0?14:capRatio>=0.75?12:capRatio>=0.50?10:capRatio>=0.25?7:3;

  const taxBase=e.isHigherRateTaxpayer?4:6;
  let tax=taxBase;
  if (drawdown>0) tax+=5;
  if ((a.isa?.value||0)>50000) tax+=3;
  if (a.trustGifts) tax+=2;
  if ((e.payOptimisation?.taxSavingOptimised||0)>0) tax-=2;
  tax=Math.max(1,Math.min(18,tax));

  let protection=0;
  if (prot.lifeInsurance?.exists){protection+=5;if(prot.lifeInsurance.inTrust)protection+=3;}
  if (prot.criticalIllness?.exists) protection+=4;
  if (prot.incomeProtection?.exists) protection+=3;
  if (prot.relevantLifePlan?.exists) protection+=2;
  protection=Math.min(16,protection);

  const cashMos=((a.cash?.total||0)/(e.targetIncome||50000))*12;
  const cashflow=cashMos>=24?16:cashMos>=12?14:cashMos>=6?13:12;
  const debt=10;

  let estPos=0;
  if (age>=55) estPos+=8; else if (age>=45) estPos+=4;
  if (a.trustGifts) estPos+=5;
  if (prot.lifeInsurance?.inTrust) estPos+=3;
  if ((a.residence?.value||0)>0) estPos+=3;
  if (nw>=1000000) estPos+=5; else if (nw>=500000) estPos+=3; else if (nw>=200000) estPos+=1;
  const coiPct=nw>0?coi/nw:0;
  const coiPenalty=Math.min(18,Math.round(coiPct*150));
  const urgPenalty=(drawdown===0&&sipp>=50000&&age>=55&&dl<500)?Math.round(Math.min(6,(500-dl)/83)):0;
  const estate=Math.max(0,Math.min(28,estPos-coiPenalty-urgPenalty));

  let momentum=1.0;
  if (drawdown===0&&sipp>=100000&&age>=60&&dl<365) momentum-=0.30;
  if (!prot.lifeInsurance?.exists&&nw>300000&&age>=55) momentum-=0.08;
  if (prot.lifeInsurance?.exists&&!prot.lifeInsurance?.inTrust&&nw>500000) momentum-=0.05;
  if ((a.sipp?.pensions?.length||0)>=3) momentum-=0.03;
  if (e.hasBusiness&&e.isHigherRateTaxpayer&&age<65) momentum-=0.08;
  if (e.hasBusiness&&!prot.criticalIllness?.exists&&age<65) momentum-=0.03;
  if (drawdown>0) momentum+=0.05;
  if (a.trustGifts) momentum+=0.05;
  if (prot.lifeInsurance?.inTrust) momentum+=0.05;
  if ((a.sipp?.pensions?.length||1)<=2) momentum+=0.03;
  momentum=Math.max(0.60,Math.min(1.20,momentum));

  const raw=behaviour+capital+tax+protection+cashflow+debt+estate;
  const total=Math.min(100,Math.max(0,Math.round(raw*momentum)));
  return {total,band:fqBand(total),dims:{behaviour,capital,tax,protection,cashflow,debt,estate},momentum,raw};
}

// ── RISK-1.0  (s07 seven-dimension) ──────────────────────────────────────────
function calcRisk(e) {
  const a=e.assets||{}, prot=a.protection||{}, income=e.income||{};
  const liab=e.liabilities||{}, rq=e.riskQuestionnaire||{};
  const nw=netWorth(e), drawdown=e.drawdown||0, age=e.age||0, lifeStage=e.lifeStage||1;

  // D1 Income Resilience max 20
  const dataSources=[
    (income.employment||0)>0,(income.dividends||0)>0,(income.rentalIncome||0)>0,
    drawdown>0,(income.statePension?.annual||0)>0&&age>=(income.statePension?.startAge||67),!!(e.hasBusiness)
  ].filter(Boolean).length;
  const q13=rq.q13_income_sources;
  const srcCount=q13==='three-or-more'?3:q13==='two'?2:q13==='one'?1:dataSources;
  const incomeRes=srcCount>=4?20:srcCount===3?16:srcCount===2?12:srcCount===1?8:4;

  // D2 Liquidity Buffer max 18
  const monthly=(e.targetIncome||50000)/12;
  const ownCash=a.cash?.own??a.cash?.total??0;
  const dataMos=monthly>0?ownCash/monthly:0;
  const q11=rq.q11_liquidity_months;
  const qMos=q11==='over-6'?8:q11==='3-6'?4.5:q11==='1-3'?2:q11==='under-1'?0.5:null;
  const cashMos=qMos!==null&&dataMos===0?qMos:dataMos;
  const bufTarget=lifeStage>=6?18:lifeStage>=5?12:e.hasBusiness?6:lifeStage>=4?5:lifeStage>=2?4:3;
  const bufRatio=bufTarget>0?cashMos/bufTarget:0;
  const liquidity=bufRatio>=1.5?18:bufRatio>=1.0?15:bufRatio>=0.7?11:bufRatio>=0.4?7:bufRatio>=0.2?3:0;

  // D3 Protection Coverage max 18
  let protCov=0;
  const q12=rq.q12_income_protection;
  if (prot.incomeProtection?.exists||q12==='yes') protCov+=7;
  else if (q12==='partly'||prot.relevantLifePlan?.exists) protCov+=3;
  if (prot.lifeInsurance?.exists) protCov+=prot.lifeInsurance.inTrust?7:5;
  if (prot.criticalIllness?.exists) protCov+=4;
  protCov=Math.min(18,protCov);

  // D4 Debt Vulnerability max 15
  const mortgageOut=liab.mortgage?.outstanding||0;
  const otherDebt=(liab.otherLoans||[]).reduce((s,l)=>s+(l.outstanding||0),0);
  const totalDebt=mortgageOut+otherDebt;
  const monthlyService=(liab.mortgage?.monthlyPayment||0)+(liab.otherLoans||[]).reduce((s,l)=>s+(l.monthlyPayment||0),0);
  const annualIncome=e.targetIncome||50000;
  const dsr=annualIncome>0?(monthlyService*12)/annualIncome:0;
  const leverage=nw>0?totalDebt/nw:0;
  const hasVariable=liab.mortgage?.rateType==='variable'||(liab.otherLoans||[]).some(l=>l.rateType==='variable');
  let debtVuln;
  if (totalDebt===0){debtVuln=15;}
  else {
    debtVuln=leverage<0.30?13:leverage<0.50?10:leverage<0.70?6:2;
    if (dsr>0.40) debtVuln-=5; else if (dsr>0.25) debtVuln-=3; else if (dsr>0.15) debtVuln-=1;
    if (hasVariable&&leverage>0.30) debtVuln-=2;
  }
  debtVuln=Math.min(15,Math.max(0,debtVuln));

  // D5 Concentration Risk max 12
  const resVal=(a.residence?.value||0)*(a.residence?.ownershipShare||1);
  const resPct=nw>0?resVal/nw:0, sippPct=nw>0?(a.sipp?.total||0)/nw:0;
  const maxAssetPct=Math.max(resPct,sippPct);
  const assetConc=maxAssetPct>0.70?1:maxAssetPct>0.55?3:maxAssetPct>0.40?5:maxAssetPct>0.25?6:7;
  const incConc=srcCount>=3?5:srcCount===2?3:1;
  const concRisk=Math.min(12,assetConc+incConc);

  // D6 Dependency Exposure max 10
  const dependants=e.dependants||[];
  const minorChildren=dependants.filter(d=>d.type==='child'&&(d.age||0)<18);
  const hasDependants=dependants.some(d=>d.financiallyDependent!==false)||(e.isCouple&&dependants.length===0);
  const willOk=e.willStatus==='current';
  const lpaOk=e.lpaStatus==='both';
  const lifeInTrust=!!(prot.lifeInsurance?.exists&&prot.lifeInsurance?.inTrust);
  const pensions=a.sipp?.pensions||[];
  const nominationsOk=rq.d6_nominations_complete==='all'||(pensions.length>0&&pensions.every(p=>!_isStale(p.nominationDate)));
  const guardianOk=minorChildren.length===0||!!(e.guardianNamed);
  let depExp;
  if (!hasDependants){depExp=lpaOk?10:9;}
  else {
    depExp=0;
    if(willOk) depExp+=3; if(nominationsOk) depExp+=2; if(lifeInTrust) depExp+=2;
    if(lpaOk) depExp+=2; if(guardianOk) depExp+=1;
  }
  depExp=Math.min(10,Math.max(0,depExp));

  // D7 Behavioural Track Record max 7 — always 0 at first capture
  const behaviouralTrack=0;

  const seedAnswered=[rq.q11_liquidity_months,rq.q12_income_protection,rq.q13_income_sources].filter(Boolean).length;
  const hasFinData=(a.sipp?.total||0)>0||(a.cash?.total||0)>0;
  const hasDrillDown=!!(rq.d6_nominations_complete||rq.d4_debt_service_pct);
  const confidenceLevel=rq.confidenceLevel||(seedAnswered>=3&&hasDrillDown&&hasFinData?'medium':'low');

  const rawRisk=incomeRes+liquidity+protCov+debtVuln+concRisk+depExp+behaviouralTrack;
  const total=Math.min(100,Math.max(0,rawRisk));
  return {total,band:riskBand(total),dims:{incomeRes,liquidity,protCov,debtVuln,concRisk,depExp,behaviouralTrack},confidenceLevel};
}

// ── Financial Profile cross-map ────────────────────────────────────────────────
const PROFILES = {
  'Exceptional|Exposed':'Peak position, critical fragility',
  'Exceptional|Vulnerable':'Peak position, partial protection',
  'Exceptional|Managed':'Peak position, risk managed',
  'Exceptional|Protected':'Peak position, well defended',
  'Exceptional|Resilient':'Fully aligned',
  'Optimised|Exposed':'Strong position, critical fragility',
  'Optimised|Vulnerable':'Strong position, underprotected',
  'Optimised|Managed':'Strong, risk managed',
  'Optimised|Protected':'Strong and protected',
  'Optimised|Resilient':'Strong and resilient',
  'Established|Exposed':'Solid progress, seriously exposed',
  'Established|Vulnerable':'Solid progress, underprotected',
  'Established|Managed':'Solid and balanced',
  'Established|Protected':'Solid and protected',
  'Established|Resilient':'Solid and resilient',
  'Building|Exposed':'Early stage, seriously vulnerable',
  'Building|Vulnerable':'Early stage, partially protected',
  'Building|Managed':'Building with managed risk',
  'Building|Protected':'Building, well structured',
  'Building|Resilient':'Building with strong foundations',
  'Exposed|Exposed':'Dual vulnerability — needs urgent attention',
  'Exposed|Vulnerable':'Low position, partially protected',
  'Exposed|Managed':'Low position, risk managed',
  'Exposed|Protected':'Low position, well structured',
  'Exposed|Resilient':'Low position, high resilience',
};

function financialProfile(e) {
  const fq=calcFQ(e), risk=calcRisk(e);
  const key=`${fq.band.name}|${risk.band.name}`;
  return {fqScore:fq.total,fqBand:fq.band.name,riskScore:risk.total,riskBand:risk.band.name,profile:PROFILES[key]||key};
}

// ── Score reporter ─────────────────────────────────────────────────────────────
function score(label, e) {
  const fq=calcFQ(e), risk=calcRisk(e), fp=financialProfile(e);
  const dl=daysLeft();
  console.log(`\n── ${label} ─────────────────────`);
  console.log(`  Finio Score : ${fq.total}  [${fq.band.name}]  momentum=${fq.momentum.toFixed(2)}`);
  console.log(`  Risk Score  : ${risk.total} [${risk.band.name}]  confidence=${risk.confidenceLevel}`);
  console.log(`  Profile     : ${fp.profile}`);
  console.log(`  Finio dims  : B=${fq.dims.behaviour} Cap=${fq.dims.capital} T=${fq.dims.tax} P=${fq.dims.protection} CF=${fq.dims.cashflow} D=${fq.dims.debt} E=${fq.dims.estate}`);
  console.log(`  Risk dims   : IR=${risk.dims.incomeRes} LB=${risk.dims.liquidity} PC=${risk.dims.protCov} DV=${risk.dims.debtVuln} CR=${risk.dims.concRisk} DE=${risk.dims.depExp} BT=${risk.dims.behaviouralTrack}`);
}

// ── Load and run all personas ─────────────────────────────────────────────────
const fs = require('fs');
const files = ['persona-a','persona-b','persona-c','persona-d','persona-e',
               'persona-f','persona-g'];

files.forEach(f => {
  const path = `/home/claude/${f}.json`;
  if (!fs.existsSync(path)) { console.log(`\n── ${f}: NOT FOUND`); return; }
  const data = JSON.parse(fs.readFileSync(path,'utf8'));
  if (data.snapshots) {
    // Anna Finch — multiple snapshots
    data.snapshots.forEach(snap => score(`${data.name} age ${snap.age}`, snap));
  } else {
    score(`${data.name} (${data.id})`, data);
  }
});
