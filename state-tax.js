
// ── FED-FinExcel State Tax Engine ────────────────────────────────
// Full 50-state retirement tax library (2026 data from workbook)

window.StateTaxEngine = (() => {

  // State data: [state, abbrev, system, topRate, taxWages, taxSS, taxPension, taxIRA,
  //              taxQDiv, taxLTCG, note, pensionExemptType, pensionExemptAmt,
  //              agExemptStartAge, ageExemptAmt, stdDedSingle, stdDedMFJ]
  const STATE_LIBRARY = {
    "Alabama":              { abbrev:"AL", system:"Flat PIT",          topRate:0.050,   taxWages:1,taxSS:0,taxPension:0,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed", pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:3000,  stdM:8500,  note:"SS and many defined-benefit pensions exempt; IRA treatment differs." },
    "Alaska":               { abbrev:"AK", system:"No broad income tax",topRate:0,       taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"No broad personal income tax." },
    "Arizona":              { abbrev:"AZ", system:"Flat PIT",          topRate:0.025,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed", pensionExempt:2500,   ageStart:0,  ageAmt:0,     stdS:14600, stdM:29200, note:"SS exempt; some public pensions partially excluded ($2,500)." },
    "Arkansas":             { abbrev:"AR", system:"Graduated PIT",     topRate:0.039,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:0.5, pensionType:"Partial fixed", pensionExempt:6000, ageStart:0, ageAmt:0,    stdS:2340,  stdM:4680,  note:"$6,000 retirement-income exemption; SS exempt." },
    "California":           { abbrev:"CA", system:"Graduated PIT",     topRate:0.123,   taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:5540,  stdM:11080, note:"SS exempt; pensions/IRAs taxed at ordinary rates." },
    "Colorado":             { abbrev:"CO", system:"Flat PIT",          topRate:0.044,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:55, ageAmt:20000, stdS:14600, stdM:29200, note:"Age 55-64: $20K, 65+: $24K pension-SS subtraction." },
    "Connecticut":          { abbrev:"CT", system:"Graduated PIT",     topRate:0.0699,  taxWages:1,taxSS:0.5,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:0,   ageStart:0,  ageAmt:0,     stdS:15000, stdM:24000, note:"SS and pension partially exempt by AGI." },
    "Delaware":             { abbrev:"DE", system:"Graduated PIT",     topRate:0.066,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:60, ageAmt:12500, stdS:3250,  stdM:6500,  note:"Age 60+ $12,500 pension exclusion; SS exempt." },
    "District of Columbia": { abbrev:"DC", system:"Graduated PIT",     topRate:0.1075,  taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:14600, stdM:29200, note:"SS exempt; pensions/IRAs taxed." },
    "Florida":              { abbrev:"FL", system:"No broad income tax",topRate:0,       taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"No broad personal income tax." },
    "Georgia":              { abbrev:"GA", system:"Flat PIT",          topRate:0.0539,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:62, ageAmt:35000, stdS:12000, stdM:24000, note:"Age 62-64: $35K, 65+: $65K retirement exclusion; SS exempt." },
    "Hawaii":               { abbrev:"HI", system:"Graduated PIT",     topRate:0.110,   taxWages:1,taxSS:0,taxPension:0,taxIRA:1,taxQDiv:1,taxLTCG:0, pensionType:"Full",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:2200,  stdM:4400,  note:"Employer-funded pensions exempt; SS exempt; no cap gains tax." },
    "Idaho":                { abbrev:"ID", system:"Flat PIT",          topRate:0.058,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",         pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:14600, stdM:29200, note:"SS exempt; most pensions taxed." },
    "Illinois":             { abbrev:"IL", system:"Flat PIT",          topRate:0.0495,  taxWages:1,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:1,taxLTCG:1, pensionType:"Full",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"All qualified retirement income exempt; SS exempt." },
    "Indiana":              { abbrev:"IN", system:"Flat PIT",          topRate:0.0305,  taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:1000,  stdM:2000,  note:"SS exempt; most retirement income taxed." },
    "Iowa":                 { abbrev:"IA", system:"Retirement-exempt", topRate:0.038,   taxWages:1,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:1,taxLTCG:1, pensionType:"Full",          pensionExempt:0,      ageStart:55, ageAmt:0,     stdS:14600, stdM:29200, note:"Age 55+ retirement income fully exempt; SS exempt." },
    "Kansas":               { abbrev:"KS", system:"Graduated PIT",     topRate:0.057,   taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:3500,  stdM:8000,  note:"SS now fully exempt (SB 33, 2024); private pensions taxed." },
    "Kentucky":             { abbrev:"KY", system:"Flat PIT",          topRate:0.040,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:31110,  ageStart:0,  ageAmt:0,     stdS:3160,  stdM:6320,  note:"$31,110 retirement-income exclusion; SS exempt." },
    "Louisiana":            { abbrev:"LA", system:"Graduated PIT",     topRate:0.0425,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:6000,   ageStart:65, ageAmt:6000,  stdS:4500,  stdM:9000,  note:"Age 65+ $6,000 retirement exclusion; SS exempt." },
    "Maine":                { abbrev:"ME", system:"Graduated PIT",     topRate:0.0715,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:30000,  ageStart:0,  ageAmt:0,     stdS:14600, stdM:29200, note:"$30,000 pension deduction; SS exempt." },
    "Maryland":             { abbrev:"MD", system:"Graduated PIT",     topRate:0.0575,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:65, ageAmt:39500, stdS:2550,  stdM:5100,  note:"Age 65+ $39,500 pension exclusion; SS exempt." },
    "Massachusetts":        { abbrev:"MA", system:"Flat PIT",          topRate:0.050,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:8000,  stdM:16400, note:"Gov pensions exempt; SS exempt; private pensions taxed." },
    "Michigan":             { abbrev:"MI", system:"Flat PIT",          topRate:0.0425,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:67, ageAmt:61518, stdS:0,     stdM:0,     note:"Age-based pension subtraction phase-in; SS exempt." },
    "Minnesota":            { abbrev:"MN", system:"Graduated PIT",     topRate:0.0985,  taxWages:1,taxSS:0.5,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:14575, stdM:29150, note:"SS subtraction phase-in 2024+; pensions taxed." },
    "Mississippi":          { abbrev:"MS", system:"Graduated PIT",     topRate:0.044,   taxWages:1,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:1,taxLTCG:1, pensionType:"Full",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:2300,  stdM:4600,  note:"All qualified retirement income exempt; SS exempt." },
    "Missouri":             { abbrev:"MO", system:"Graduated PIT",     topRate:0.048,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:62, ageAmt:6000,  stdS:14600, stdM:29200, note:"SS now fully exempt (SB 190, 2024); pension phase-out by AGI." },
    "Montana":              { abbrev:"MT", system:"Graduated PIT",     topRate:0.059,   taxWages:1,taxSS:1,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:0.5, pensionType:"None",         pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:14600, stdM:29200, note:"SS partial; small pension exemption phases out." },
    "Nebraska":             { abbrev:"NE", system:"Graduated PIT",     topRate:0.0584,  taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:8350,  stdM:16700, note:"SS fully exempt 2024+ (LB 873); pensions taxed." },
    "Nevada":               { abbrev:"NV", system:"No broad income tax",topRate:0,      taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"No broad personal income tax." },
    "New Hampshire":        { abbrev:"NH", system:"No broad income tax",topRate:0,      taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"Interest/dividend tax repealed effective 2025." },
    "New Jersey":           { abbrev:"NJ", system:"Graduated PIT",     topRate:0.1075,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:62, ageAmt:100000,stdS:0,     stdM:0,     note:"Age 62+ $100K MFJ / $75K Single pension exclusion (income-tested); SS exempt." },
    "New Mexico":           { abbrev:"NM", system:"Graduated PIT",     topRate:0.059,   taxWages:1,taxSS:0.5,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:0,   ageStart:65, ageAmt:8000,  stdS:14600, stdM:29200, note:"SS exempt below AGI thresholds; age 65+ $8K exemption." },
    "New York":             { abbrev:"NY", system:"Graduated PIT",     topRate:0.109,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:20000,  ageStart:0,  ageAmt:0,     stdS:8000,  stdM:16050, note:"$20,000 private pension exclusion at 59½+; gov pensions fully exempt; SS exempt." },
    "North Carolina":       { abbrev:"NC", system:"Flat PIT",          topRate:0.0425,  taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:12750, stdM:25500, note:"SS exempt; no special pension exclusion." },
    "North Dakota":         { abbrev:"ND", system:"Graduated PIT",     topRate:0.025,   taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:14600, stdM:29200, note:"SS exempt 2021+; pensions taxed." },
    "Ohio":                 { abbrev:"OH", system:"Graduated PIT",     topRate:0.035,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:200,    ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"Senior credit + retirement-income credit (income-tested)." },
    "Oklahoma":             { abbrev:"OK", system:"Graduated PIT",     topRate:0.0475,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:10000,  ageStart:0,  ageAmt:0,     stdS:6350,  stdM:12700, note:"$10K retirement-income exclusion; SS exempt." },
    "Oregon":               { abbrev:"OR", system:"Graduated PIT",     topRate:0.099,   taxWages:1,taxSS:0,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:2745,  stdM:5495,  note:"SS exempt; pensions/IRAs taxed; small senior credit." },
    "Pennsylvania":         { abbrev:"PA", system:"Flat PIT",          topRate:0.0307,  taxWages:1,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:1,taxLTCG:1, pensionType:"Full",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"Retirement distributions and SS not taxed; dividends/gains taxed." },
    "Rhode Island":         { abbrev:"RI", system:"Graduated PIT",     topRate:0.0599,  taxWages:1,taxSS:0.5,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",  pensionExempt:0,      ageStart:65, ageAmt:20000, stdS:10550, stdM:21150, note:"Full retirement age $20K pension modification; SS partial by AGI." },
    "South Carolina":       { abbrev:"SC", system:"Graduated PIT",     topRate:0.064,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:3000,   ageStart:65, ageAmt:15000, stdS:14600, stdM:29200, note:"Under 65: $3K deduction; 65+: $15K; SS exempt." },
    "South Dakota":         { abbrev:"SD", system:"No broad income tax",topRate:0,      taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"No broad personal income tax." },
    "Tennessee":            { abbrev:"TN", system:"No broad income tax",topRate:0,      taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"Hall tax fully repealed 2021." },
    "Texas":                { abbrev:"TX", system:"No broad income tax",topRate:0,      taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"No broad personal income tax." },
    "Utah":                 { abbrev:"UT", system:"Flat PIT",          topRate:0.0455,  taxWages:1,taxSS:0.5,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"None",        pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:876,   stdM:1752,  note:"SS credit (income-tested); small retirement-income credit." },
    "Vermont":              { abbrev:"VT", system:"Graduated PIT",     topRate:0.0875,  taxWages:1,taxSS:0.5,taxPension:1,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:7400,  stdM:14850, note:"SS exclusion phased by AGI; small pension exclusion." },
    "Virginia":             { abbrev:"VA", system:"Graduated PIT",     topRate:0.0575,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Age-based",   pensionExempt:0,      ageStart:65, ageAmt:12000, stdS:4500,  stdM:9000,  note:"Age 65+ $12K age deduction (income-tested); SS exempt." },
    "Washington":           { abbrev:"WA", system:"No wage tax/cap gains",topRate:0.07, taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:1, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"No broad income tax; 7% capital-gains tax above threshold." },
    "West Virginia":        { abbrev:"WV", system:"Graduated PIT",     topRate:0.048,   taxWages:1,taxSS:0,taxPension:0.5,taxIRA:0.5,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"SS phase-out 2024-2026 (35%/65%/100% exempt); pensions taxed." },
    "Wisconsin":            { abbrev:"WI", system:"Graduated PIT",     topRate:0.0765,  taxWages:1,taxSS:0,taxPension:0.5,taxIRA:1,taxQDiv:1,taxLTCG:1, pensionType:"Partial fixed",pensionExempt:5000,   ageStart:65, ageAmt:5000,  stdS:13230, stdM:24490, note:"Age 65+ $5K retirement subtraction (income-tested); SS exempt." },
    "Wyoming":              { abbrev:"WY", system:"No broad income tax",topRate:0,      taxWages:0,taxSS:0,taxPension:0,taxIRA:0,taxQDiv:0,taxLTCG:0, pensionType:"None",          pensionExempt:0,      ageStart:0,  ageAmt:0,     stdS:0,     stdM:0,     note:"No broad personal income tax." },
  };

  const STATE_NAMES = Object.keys(STATE_LIBRARY).sort();

  // Compute state tax for a given retirement scenario
  function computeStateTax(stateName, { pension, ssIncome, iraDraws, dividends, ltcg, age, filing }) {
    const s = STATE_LIBRARY[stateName];
    if (!s) return { totalTax: 0, effectiveRate: 0, breakdown: [], note: 'State not found' };

    if (s.topRate === 0) return { totalTax: 0, effectiveRate: 0, breakdown: [], note: s.note };

    const stdDed = filing === 'MFJ' ? s.stdM : s.stdS;

    // Pension taxable amount
    let pensionTaxable = pension;
    if (s.taxPension === 0) {
      pensionTaxable = 0;
    } else if (s.taxPension === 0.5) {
      const ageExempt = (s.ageStart > 0 && age >= s.ageStart) ? s.ageAmt : s.pensionExempt;
      pensionTaxable = Math.max(0, pension - ageExempt);
    }

    // SS taxable
    let ssTaxable = ssIncome;
    if (s.taxSS === 0) ssTaxable = 0;
    else if (s.taxSS === 0.5) ssTaxable = ssIncome * 0.5;

    // IRA/TSP draws
    let iraTaxable = iraDraws * s.taxIRA;

    // Dividends & LTCG
    let divTaxable = dividends * s.taxQDiv;
    let ltcgTaxable = ltcg * s.taxLTCG;

    const grossTaxable = pensionTaxable + ssTaxable + iraTaxable + divTaxable + ltcgTaxable;
    const netTaxable = Math.max(0, grossTaxable - stdDed);
    const totalTax = netTaxable * s.topRate; // simplified flat application
    const totalIncome = pension + ssIncome + iraDraws + dividends + ltcg;
    const effectiveRate = totalIncome > 0 ? totalTax / totalIncome : 0;

    return {
      totalTax,
      effectiveRate,
      breakdown: [
        { label: 'Pension (taxable portion)', amount: pensionTaxable },
        { label: 'Social Security (taxable portion)', amount: ssTaxable },
        { label: 'TSP/IRA draws', amount: iraTaxable },
        { label: 'Dividends', amount: divTaxable },
        { label: 'Capital gains', amount: ltcgTaxable },
        { label: 'Standard deduction', amount: -stdDed },
        { label: 'Net taxable income', amount: netTaxable },
      ],
      topRate: s.topRate,
      note: s.note,
      system: s.system,
    };
  }

  // Retirement tax-friendliness ranking
  function rankStates(scenario) {
    return STATE_NAMES.map(name => {
      const result = computeStateTax(name, scenario);
      const s = STATE_LIBRARY[name];
      return {
        state: name,
        abbrev: s.abbrev,
        system: s.system,
        topRate: s.topRate,
        taxSS: s.taxSS,
        taxPension: s.taxPension,
        taxIRA: s.taxIRA,
        totalTax: result.totalTax,
        effectiveRate: result.effectiveRate,
        note: s.note,
      };
    }).sort((a, b) => a.totalTax - b.totalTax);
  }

  return { STATE_LIBRARY, STATE_NAMES, computeStateTax, rankStates };
})();
