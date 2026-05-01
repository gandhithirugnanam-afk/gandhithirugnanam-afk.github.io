
// FED-FinExcel Calculation Engine
// Mirrors the Excel workbook logic in JavaScript

window.FEDEngine = (() => {

  // ── Constants (2026) ──────────────────────────────────────────────
  const TAX_BRACKETS_MFJ = [
    { rate: 0.10, max: 23200 },
    { rate: 0.12, max: 94300 },
    { rate: 0.22, max: 201050 },
    { rate: 0.24, max: 383900 },
    { rate: 0.32, max: 487450 },
    { rate: 0.35, max: 731200 },
    { rate: 0.37, max: Infinity }
  ];
  const TAX_BRACKETS_SINGLE = [
    { rate: 0.10, max: 11600 },
    { rate: 0.12, max: 47150 },
    { rate: 0.22, max: 100525 },
    { rate: 0.24, max: 191950 },
    { rate: 0.32, max: 243725 },
    { rate: 0.35, max: 365600 },
    { rate: 0.37, max: Infinity }
  ];
  const STD_DED_MFJ = 29200;
  const STD_DED_SINGLE = 14600;
  const IRMAA_TIERS_MFJ = [
    { max: 206000,   surcharge: 0 },
    { max: 258000,   surcharge: 838.80 },
    { max: 322000,   surcharge: 2096.40 },
    { max: 386000,   surcharge: 3353.60 },
    { max: 750000,   surcharge: 4611.60 },
    { max: Infinity, surcharge: 4954.80 }
  ];
  const TSP_MAX = 23500;
  const IRA_MAX_50_PLUS = 8000;
  const IRA_MAX = 7000;
  const HSA_FAM = 8550;
  const SOCIAL_SECURITY_COLA = 0.025; // long-run assumption
  const PENSION_COLA = -0.005;        // per workbook default

  // ── Tax helpers ───────────────────────────────────────────────────
  function marginalRate(taxableIncome, filing) {
    const brackets = filing === 'MFJ' ? TAX_BRACKETS_MFJ : TAX_BRACKETS_SINGLE;
    for (const b of brackets) {
      if (taxableIncome <= b.max) return b.rate;
    }
    return 0.37;
  }

  function effectiveTax(taxableIncome, filing) {
    const brackets = filing === 'MFJ' ? TAX_BRACKETS_MFJ : TAX_BRACKETS_SINGLE;
    let tax = 0, prev = 0;
    for (const b of brackets) {
      if (taxableIncome <= prev) break;
      tax += (Math.min(taxableIncome, b.max) - prev) * b.rate;
      prev = b.max;
    }
    return tax;
  }

  function stdDeduction(filing) {
    return filing === 'MFJ' ? STD_DED_MFJ : STD_DED_SINGLE;
  }

  function irmaa(magi, filing) {
    const tiers = IRMAA_TIERS_MFJ; // simplified: use MFJ tiers
    for (const t of tiers) {
      if (magi <= t.max) return t.surcharge;
    }
    return 4954.80;
  }

  // ── FERS Pension ──────────────────────────────────────────────────
  function calcPension(inputs) {
    const { high3, yearsService, retireAge, multiplierOverride } = inputs;
    const multiplier = multiplierOverride || (retireAge >= 62 && yearsService >= 20 ? 0.011 : 0.01);
    const gross = high3 * yearsService * multiplier;
    // Early retirement penalty: 5/12% per month before 62
    const monthsBefore62 = retireAge < 62 ? (62 - retireAge) * 12 : 0;
    const penalty = monthsBefore62 * (5 / 12 / 100);
    const afterPenalty = gross * (1 - penalty);
    // Survivor election reduction
    const survReduction = inputs.survivorElection === 10 ? 0.10 :
                          inputs.survivorElection === 5  ? 0.05 : 0;
    const net = afterPenalty * (1 - survReduction);
    return { gross, penalty, afterPenalty, net, multiplier };
  }

  // ── Social Security ───────────────────────────────────────────────
  function ssBenefit(pia, claimAge) {
    const fra = 67;
    if (claimAge <= fra) {
      const monthsEarly = (fra - claimAge) * 12;
      const reduction = monthsEarly <= 36
        ? monthsEarly * (5 / 9 / 100)
        : 36 * (5 / 9 / 100) + (monthsEarly - 36) * (5 / 12 / 100);
      return pia * (1 - reduction);
    } else {
      const monthsLate = (claimAge - fra) * 12;
      return pia * (1 + monthsLate * (2 / 3 / 100));
    }
  }

  // ── TSP / Investment Growth ───────────────────────────────────────
  function projectBalance(balance, annualContrib, realReturn, years) {
    const r = realReturn;
    for (let y = 0; y < years; y++) {
      balance = balance * (1 + r) + annualContrib;
    }
    return balance;
  }

  // ── Net Worth Trajectory ──────────────────────────────────────────
  function netWorthTrajectory(inputs) {
    const {
      currentAge, deathAge, retireAge,
      traditionalBalance, rothBalance, brokerageBalance,
      annualContribTrad, annualContribRoth, annualContribBrokerage,
      realReturn, pension, socialSecurity, spouseSS,
      retireSpending, goGoFactor, slowGoFactor, noGoFactor,
      slowGoAge, noGoAge, ltcStartAge, ltcAmount,
      homeEquity, cashLiquid,
      filingStatus
    } = inputs;

    const rows = [];
    let trad = traditionalBalance;
    let roth = rothBalance;
    let brokerage = brokerageBalance;
    const r = realReturn;

    for (let age = currentAge; age <= deathAge; age++) {
      const retired = age >= retireAge;
      const spendFactor = age < slowGoAge ? goGoFactor :
                          age < noGoAge   ? slowGoFactor : noGoFactor;
      const ltcBump = age >= ltcStartAge ? ltcAmount : 0;
      const baseSpend = retireSpending * spendFactor + ltcBump;

      let annualTrad = annualContribTrad;
      let annualRoth = annualContribRoth;
      let annualBrok = annualContribBrokerage;

      if (retired) {
        // Income floor
        const pensionIncome = pension;
        const ssIncome = socialSecurity + (spouseSS || 0);
        const incomeFloor = pensionIncome + ssIncome;
        const gap = Math.max(0, baseSpend - incomeFloor);

        // Draw from trad first, then roth, then brokerage
        let remaining = gap;
        const tradDraw = Math.min(trad, remaining);
        remaining -= tradDraw;
        const rothDraw = Math.min(roth, remaining);
        remaining -= rothDraw;
        const brokDraw = Math.min(brokerage, remaining);

        trad = Math.max(0, trad - tradDraw) * (1 + r);
        roth = Math.max(0, roth - rothDraw) * (1 + r);
        brokerage = Math.max(0, brokerage - brokDraw) * (1 + r);
        annualTrad = 0; annualRoth = 0; annualBrok = 0;
      } else {
        trad = trad * (1 + r) + annualTrad;
        roth = roth * (1 + r) + annualRoth;
        brokerage = brokerage * (1 + r) + annualBrok;
      }

      const netWorth = trad + roth + brokerage + homeEquity + cashLiquid;
      rows.push({ age, netWorth, trad, roth, brokerage });
    }
    return rows;
  }

  // ── FIRE Number ───────────────────────────────────────────────────
  function fireNumber(spending, swr) {
    return spending / swr;
  }

  // ── Healthcare projection ─────────────────────────────────────────
  function healthcareProjection(inputs) {
    const { retireAge, deathAge, fehbAnnual, medicareMonthly, medigapMonthly,
            partDMonthly, oopAnnual, hcInflation } = inputs;
    const rows = [];
    for (let age = retireAge; age <= deathAge; age++) {
      const years = age - retireAge;
      const inflFactor = Math.pow(1 + hcInflation, years);
      const preMedicare = age < 65 ? fehbAnnual * inflFactor : 0;
      const medicare = age >= 65
        ? (medicareMonthly + medigapMonthly + partDMonthly) * 12 * inflFactor + oopAnnual * inflFactor
        : 0;
      rows.push({ age, annual: preMedicare + medicare });
    }
    return rows;
  }

  // ── Roth Conversion Ladder ────────────────────────────────────────
  function rothConversionLadder(inputs) {
    const { currentAge, retireAge, tradBalance, realReturn,
            annualContrib, filingStatus, otherIncome } = inputs;
    const years = retireAge - currentAge;
    const rows = [];
    let balance = tradBalance;
    for (let i = 0; i < years; i++) {
      const age = currentAge + i;
      const income = otherIncome || 0;
      const deduction = stdDeduction(filingStatus);
      const taxableIncome = Math.max(0, income - deduction);
      const topBracket = filingStatus === 'MFJ' ? 94300 : 47150;
      const conversionRoom = Math.max(0, topBracket - taxableIncome);
      balance = balance * (1 + realReturn) + annualContrib;
      rows.push({ age, balance: Math.round(balance), conversionRoom: Math.round(conversionRoom) });
    }
    return rows;
  }

  // ── Monte Carlo ───────────────────────────────────────────────────
  function monteCarlo(inputs, simulations = 500) {
    const { startBalance, annualWithdrawal, realReturn, years, stdDev } = inputs;
    let successes = 0;
    for (let s = 0; s < simulations; s++) {
      let bal = startBalance;
      let failed = false;
      for (let y = 0; y < years; y++) {
        // Box-Muller transform for normal random
        const u1 = Math.random(), u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const yearReturn = realReturn + z * stdDev;
        bal = bal * (1 + yearReturn) - annualWithdrawal;
        if (bal <= 0) { failed = true; break; }
      }
      if (!failed) successes++;
    }
    return Math.round((successes / simulations) * 100);
  }

  // ── Main compute function ─────────────────────────────────────────
  function compute(inputs) {
    const {
      // Personal
      name = 'Federal Employee', spouseName = 'Spouse',
      dob, spouseDob, filingStatus = 'MFJ',
      retireState = 'Pennsylvania', retireAge = 60,
      deathAge = 95, spouseDeathAge = 95,
      currentAge,

      // Income
      salary = 130000, spouseSalary = 0,

      // Retirement accounts
      tradBalance = 220000, rothBalance = 30000, brokerBalance = 0,
      spouseTradBalance = 0, spouseRothBalance = 0,
      annualTSP = 23000, tspRothPct = 0.5,
      annualBackdoorRoth = 7000, spouseBackdoorRoth = 7000,
      realReturn = 0.03,

      // Pension
      high3 = 130000, yearsAtRetire = 30,
      survivorElection = 10, multiplierOverride,
      sickLeaveHours = 0,

      // Social Security
      ssPIA = 30000, ssClaimAge = 67,
      spousePIA = 0, spouseSsClaimAge = 67,

      // Spending
      retireSpending = 80000,
      goGoFactor = 1.0, slowGoFactor = 0.8, noGoFactor = 0.7,
      slowGoAge = 75, noGoAge = 85,
      ltcStartAge = 93, ltcAmount = 80000,

      // Healthcare
      fehbAnnual = 7200,
      medicareMonthly = 202.90, partDMonthly = 35,
      medigapMonthly = 200, oopAnnual = 3000,
      hcInflation = 0.055,

      // Real Estate
      homeValue = 400000, mortgageBalance = 200000,
      cashLiquid = 40000,

      // Other
      hsaBalance = 0, swr = 0.04,
    } = inputs;

    const yearsToRetire = retireAge - currentAge;
    const homeEquity = homeValue - mortgageBalance;

    // Pension
    const pension = calcPension({ high3, yearsService: yearsAtRetire, retireAge, survivorElection, multiplierOverride });
    const sickLeaveYears = sickLeaveHours / 2087;
    const pensionBoost = high3 * sickLeaveYears * (pension.multiplier || 0.01);

    // Social Security
    const yourSS = ssBenefit(ssPIA, ssClaimAge);
    const spouseSS = ssBenefit(spousePIA, spouseSsClaimAge);
    const incomeFloor = pension.net + pensionBoost + yourSS + spouseSS;

    // TSP projections at retirement
    const tradAtRetire = projectBalance(tradBalance, annualTSP * (1 - tspRothPct), realReturn, yearsToRetire);
    const rothAtRetire = projectBalance(rothBalance, annualTSP * tspRothPct + annualBackdoorRoth + spouseBackdoorRoth, realReturn, yearsToRetire);
    const spouseTradAtRetire = projectBalance(spouseTradBalance, 0, realReturn, yearsToRetire);
    const totalAtRetire = tradAtRetire + rothAtRetire + spouseTradAtRetire;

    // FIRE number
    const fireNum = fireNumber(retireSpending, swr);
    const fireReadiness = totalAtRetire / fireNum;

    // Savings
    const annualSavings = annualTSP + annualBackdoorRoth * 2;
    const savingsRate = salary > 0 ? annualSavings / salary : 0;
    const annualSpending = salary - annualSavings; // simplified
    const monthlySpending = annualSpending / 12;
    const monthlyIncome = (salary + spouseSalary) / 12;
    const monthlySurplus = monthlyIncome - monthlySpending - (200000 - mortgageBalance > 0 ? 1500 : 0);

    // Current taxes
    const deduction = stdDeduction(filingStatus);
    const taxableIncome = Math.max(0, salary + spouseSalary - annualTSP * (1 - tspRothPct) - deduction);
    const currentMarginalRate = marginalRate(taxableIncome, filingStatus);
    const currentEffectiveTax = effectiveTax(taxableIncome, filingStatus);

    // Net worth
    const netWorth = tradBalance + rothBalance + brokerBalance + spouseTradBalance + spouseRothBalance + homeEquity + cashLiquid + hsaBalance;

    // Net worth trajectory
    const trajectory = netWorthTrajectory({
      currentAge, deathAge, retireAge,
      traditionalBalance: tradBalance + spouseTradBalance,
      rothBalance: rothBalance + spouseRothBalance,
      brokerageBalance: brokerBalance,
      annualContribTrad: annualTSP * (1 - tspRothPct),
      annualContribRoth: annualTSP * tspRothPct + annualBackdoorRoth + spouseBackdoorRoth,
      annualContribBrokerage: 0,
      realReturn, pension: pension.net + pensionBoost,
      socialSecurity: yourSS, spouseSS,
      retireSpending, goGoFactor, slowGoFactor, noGoFactor,
      slowGoAge, noGoAge, ltcStartAge, ltcAmount,
      homeEquity, cashLiquid, filingStatus
    });

    // Healthcare
    const hcProjection = healthcareProjection({
      retireAge, deathAge, fehbAnnual, medicareMonthly, medigapMonthly,
      partDMonthly, oopAnnual, hcInflation
    });
    const lifetimeHC = hcProjection.reduce((s, r) => s + r.annual, 0);

    // RMD at 73
    const rmdDivisor = 26.5;
    const tradAt73 = projectBalance(tradAtRetire, 0, realReturn, 73 - retireAge);
    const rmdAt73 = tradAt73 / rmdDivisor;
    const magiAt73 = pension.net + yourSS * 0.85 + rmdAt73;
    const irmaaAt73 = irmaa(magiAt73, filingStatus);

    // Monte Carlo
    const mcSuccess = monteCarlo({
      startBalance: totalAtRetire,
      annualWithdrawal: retireSpending - (pension.net + yourSS),
      realReturn,
      years: deathAge - retireAge,
      stdDev: 0.12
    });

    // Roth conversion
    const rothLadder = rothConversionLadder({
      currentAge, retireAge,
      tradBalance, realReturn,
      annualContrib: annualTSP * (1 - tspRothPct),
      filingStatus,
      otherIncome: salary
    });

    // SS timing comparison
    const ss62 = ssBenefit(ssPIA, 62);
    const ss67 = ssBenefit(ssPIA, 67);
    const ss70 = ssBenefit(ssPIA, 70);

    // Scenario comparison (3 scenarios)
    const scenarioAll50 = {
      label: 'Current (50/50 split)',
      tradAt: tradAtRetire,
      rothAt: rothAtRetire,
      tax: currentMarginalRate
    };
    const scenarioMoreRoth = {
      label: 'More Roth (80% Roth)',
      tradAt: projectBalance(tradBalance, annualTSP * 0.2, realReturn, yearsToRetire),
      rothAt: projectBalance(rothBalance, annualTSP * 0.8 + annualBackdoorRoth * 2, realReturn, yearsToRetire),
      tax: currentMarginalRate
    };
    const scenarioAllTrad = {
      label: 'All Traditional (pre-tax)',
      tradAt: projectBalance(tradBalance, annualTSP, realReturn, yearsToRetire),
      rothAt: projectBalance(rothBalance, annualBackdoorRoth * 2, realReturn, yearsToRetire),
      tax: currentMarginalRate
    };

    return {
      // Summary
      name, spouseName, currentAge, retireAge, yearsToRetire, deathAge,
      filingStatus, retireState,
      netWorth, savingsRate, monthlySurplus,
      currentMarginalRate, currentEffectiveTax,

      // Pension
      pension, pensionBoost, sickLeaveYears,

      // SS
      yourSS, spouseSS, ss62, ss67, ss70, ssClaimAge,
      incomeFloor,

      // Investments
      tradAtRetire, rothAtRetire, spouseTradAtRetire, totalAtRetire,
      fireNum, fireReadiness,

      // Healthcare
      hcProjection, lifetimeHC,
      fehbAnnual, medicareAnnual: (medicareMonthly + medigapMonthly + partDMonthly) * 12,

      // RMD / IRMAA
      tradAt73, rmdAt73, magiAt73, irmaaAt73,

      // Monte Carlo
      mcSuccess,

      // Roth ladder
      rothLadder,

      // Trajectory
      trajectory,

      // Scenarios
      scenarios: [scenarioAll50, scenarioMoreRoth, scenarioAllTrad],
      tspRothPct,

      // SS comparison
      ss62Annual: ss62, ss67Annual: ss67, ss70Annual: ss70,

      // Input echo
      salary, spouseSalary, high3, yearsAtRetire,
      annualTSP, annualBackdoorRoth,
      retireSpending, swr,
      homeValue, mortgageBalance, homeEquity, cashLiquid,
      tradBalance, rothBalance, brokerBalance,
    };
  }

  // ── Default inputs (matches sample data in workbook) ─────────────
  const DEFAULT_INPUTS = {
    name: 'Federal Employee',
    spouseName: 'Spouse',
    currentAge: 46,
    dob: '1979-08-15',
    spouseDob: '1981-12-20',
    filingStatus: 'MFJ',
    retireState: 'Pennsylvania',
    retireAge: 60,
    deathAge: 95,
    spouseDeathAge: 95,

    salary: 130000,
    spouseSalary: 0,

    tradBalance: 220000,
    rothBalance: 30000,
    brokerBalance: 0,
    spouseTradBalance: 0,
    spouseRothBalance: 0,
    annualTSP: 23000,
    tspRothPct: 0.5,
    annualBackdoorRoth: 7000,
    spouseBackdoorRoth: 7000,
    realReturn: 0.03,

    high3: 130000,
    yearsAtRetire: 30,
    survivorElection: 10,
    sickLeaveHours: 0,

    ssPIA: 30000,
    ssClaimAge: 67,
    spousePIA: 0,
    spouseSsClaimAge: 67,

    retireSpending: 80000,
    goGoFactor: 1.0,
    slowGoFactor: 0.8,
    noGoFactor: 0.7,
    slowGoAge: 75,
    noGoAge: 85,
    ltcStartAge: 93,
    ltcAmount: 80000,

    fehbAnnual: 7200,
    medicareMonthly: 202.90,
    partDMonthly: 35,
    medigapMonthly: 200,
    oopAnnual: 3000,
    hcInflation: 0.055,

    homeValue: 400000,
    mortgageBalance: 200000,
    cashLiquid: 40000,
    hsaBalance: 0,
    swr: 0.04,
  };

  return { compute, DEFAULT_INPUTS, calcPension, ssBenefit, marginalRate, effectiveTax, monteCarlo };
})();
