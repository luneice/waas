/**
 * 利润表 fixture —— 由真实抓包脱敏而来（赛力斯 SH601127，2026Q1 / 2025年报）。
 *
 * 刻意保留三类会触发边界行为的真实数据：
 *   1. **三态二元组**：`exchg_gain: [null, null]`（科目本期不适用）
 *   2. **负值同比**：净利润同比为负
 *   3. **少数股东损益为负** —— 导致归母净利润高于合并净利润，
 *      投影层 insights 会据此产出警告，测试要锁住这条行为
 *
 * 数值均为上游原值未做修改，勾稽关系可验算。
 */
import type { RawIncomePeriod } from "@src/types/income.types";

/** 两期利润表数据（2026一季报 / 2025年报） */
export const incomePeriodsFixture = [
    {
      "report_date": 1774886400000,
      "report_name": "2026一季报",
      "ctime": 1777463147000,
      "total_revenue": [
        25745711786.75,
        0.3446285931858831
      ],
      "revenue": [
        25745711786.75,
        0.3446285931858831
      ],
      "operating_costs": [
        25864181222.45,
        0.3917663047945134
      ],
      "operating_cost": [
        18990470700.37,
        0.3702503035053049
      ],
      "operating_taxes_and_surcharge": [
        528873300.52,
        0.06567573345670744
      ],
      "sales_fee": [
        3718989331.35,
        0.39692479609486314
      ],
      "manage_fee": [
        736477052.83,
        0.12015145253086039
      ],
      "rad_cost": [
        1793557041.7,
        0.7068308317078046
      ],
      "financing_expenses": [
        95813795.68,
        1.6735346325719256
      ],
      "finance_cost_interest_fee": [
        36596098.22,
        -0.32906096811679586
      ],
      "finance_cost_interest_income": [
        256327360.98,
        0.19732234277619642
      ],
      "other_income": [
        909719742.83,
        1.739058531032966
      ],
      "invest_income": [
        41865166.44,
        3.2404858845588604
      ],
      "invest_incomes_from_rr": [
        -16442442.65,
        0.435974998211116
      ],
      "income_from_chg_in_fv": [
        22342998.05,
        15.789990698360874
      ],
      "credit_impairment_loss": [
        -3527617.58,
        0.8981342147143605
      ],
      "asset_impairment_loss": [
        52413715.72,
        -0.08179463624146419
      ],
      "asset_disposal_income": [
        -1014345.93,
        -1.3029714381659219
      ],
      "exchg_gain": [
        null,
        null
      ],
      "op": [
        805558027.55,
        -0.09242907575178125
      ],
      "non_operating_income": [
        48390474.04,
        1.325929387336667
      ],
      "non_operating_payout": [
        5089352.55,
        -0.6940040222366044
      ],
      "noncurrent_assets_dispose_gain": [
        null,
        null
      ],
      "noncurrent_asset_disposal_loss": [
        null,
        null
      ],
      "profit_total_amt": [
        848859149.04,
        -0.048119361700924596
      ],
      "income_tax_expenses": [
        238313832.11,
        0.5767727029743609
      ],
      "net_profit": [
        610545316.93,
        -0.1756409396930466
      ],
      "continous_operating_np": [
        610545316.93,
        -0.1756409396930466
      ],
      "net_profit_bi": [
        null,
        null
      ],
      "net_profit_atsopc": [
        754464672.82,
        0.008921162241436175
      ],
      "minority_gal": [
        -143919355.89,
        -19.091592985971158
      ],
      "net_profit_after_nrgal_atsolc": [
        102900401.65,
        -0.7387352984853512
      ],
      "basic_eps": [
        0.43,
        -0.14
      ],
      "dlt_earnings_per_share": [
        0.43,
        -0.14
      ],
      "othr_compre_income": [
        -818263.45,
        -1.0752135059407475
      ],
      "othr_compre_income_atoopc": [
        -42991.58,
        -1.004000678476733
      ],
      "othr_compre_income_atms": [
        -775271.87,
        -6.823125368934628
      ],
      "total_compre_income": [
        609727053.48,
        -0.1886635795080054
      ],
      "total_compre_income_atsopc": [
        754421681.24,
        -0.005428690944579629
      ],
      "total_compre_income_atms": [
        -144694627.76,
        -19.582373634338143
      ]
    },
    {
      "report_date": 1767110400000,
      "report_name": "2025年报",
      "ctime": 1774865718000,
      "total_revenue": [
        165053636639.13,
        0.13692234908079212
      ],
      "revenue": [
        165053636639.13,
        0.13692234908079212
      ],
      "operating_costs": [
        157859698707.06,
        0.13470219187894256
      ],
      "operating_cost": [
        116953831365.74,
        0.09088854746604388
      ],
      "operating_taxes_and_surcharge": [
        4390172691.9,
        0.1291209465079376
      ],
      "sales_fee": [
        24194263481.94,
        0.26115235901737105
      ],
      "manage_fee": [
        4786889602.91,
        0.3496164415959735
      ],
      "rad_cost": [
        7954319736.55,
        0.4241005107929228
      ],
      "financing_expenses": [
        -419778171.98,
        -0.42539186134244117
      ],
      "finance_cost_interest_fee": [
        198656464.51,
        -0.1735808511874842
      ],
      "finance_cost_interest_income": [
        808845597.29,
        0.5340803321808484
      ],
      "other_income": [
        1558596588.81,
        0.45978033654278694
      ],
      "invest_income": [
        294063375.28,
        27.473881960043
      ],
      "invest_incomes_from_rr": [
        80179504.72,
        2.083169728021354
      ],
      "income_from_chg_in_fv": [
        17184275.64,
        -0.829024913712654
      ],
      "credit_impairment_loss": [
        -4532816.09,
        -1.0382713122683755
      ],
      "asset_impairment_loss": [
        1579002308.08,
        -0.2747867271741032
      ],
      "asset_disposal_income": [
        28623064.75,
        7.163954758370361
      ],
      "exchg_gain": [
        null,
        null
      ],
      "op": [
        7517935744.56,
        0.5211765882883106
      ],
      "non_operating_income": [
        110456609.92,
        1.402975722225038
      ],
      "non_operating_payout": [
        158863349.87,
        3.316498979284859
      ],
      "noncurrent_assets_dispose_gain": [
        null,
        null
      ],
      "noncurrent_asset_disposal_loss": [
        null,
        null
      ],
      "profit_total_amt": [
        7469529004.61,
        0.5085850578823103
      ],
      "income_tax_expenses": [
        1322789191.71,
        5.262282298389623
      ],
      "net_profit": [
        6146739812.9,
        0.2967486979398028
      ],
      "continous_operating_np": [
        6146739812.9,
        0.2967486979398028
      ],
      "net_profit_bi": [
        null,
        null
      ],
      "net_profit_atsopc": [
        5956787449.91,
        0.0018234420985089655
      ],
      "minority_gal": [
        189952362.99,
        1.1575284506217123
      ],
      "net_profit_after_nrgal_atsolc": [
        5135925807.64,
        -0.07844831776600711
      ],
      "basic_eps": [
        3.68,
        -0.06598984771573599
      ],
      "dlt_earnings_per_share": [
        3.67,
        -0.0685279187817259
      ],
      "othr_compre_income": [
        125326777.99,
        7.866417271723999
      ],
      "othr_compre_income_atoopc": [
        118750484.01,
        7.759650541247971
      ],
      "othr_compre_income_atms": [
        6576293.98,
        10.368535702806433
      ],
      "total_compre_income": [
        6272066590.89,
        0.31925428922632476
      ],
      "total_compre_income_atsopc": [
        6075537933.92,
        0.019470761317875847
      ],
      "total_compre_income_atms": [
        196528656.97,
        1.1630604282352996
      ]
    }
  ] as unknown as RawIncomePeriod[];

/** 端点族统一响应信封 —— 成功态 */
export const incomeEnvelopeFixture = {
  data: {
    quote_name: "赛力斯",
    currency: "CNY",
    currency_name: "人民币",
    org_type: 1,
    last_report_name: "2026一季报",
    statuses: null,
    list: incomePeriodsFixture,
  },
  error_code: 0,
  error_description: "",
};

/**
 * 未登录响应 —— 实测形态（curl 带齐 Origin/Referer/UA 但无 Cookie）。
 *
 * ⚠️ 两个关键点：
 *   1. `data.list` **也是空数组** —— 只看 list 长度会把「未登录」
 *      误报成「该股票无财务数据」；
 *   2. `error_code` 是 **string**（成功时是 number 0），类型会漂移。
 */
export const notLoggedInFixture = {
  data: { list: [] },
  error_code: "400016",
  error_description: "遇到错误，请刷新页面或者重新登录帐号后再试",
};

/** 正常空集 —— 已登录但该筛选下无数据 */
export const emptyResultFixture = {
  data: {
    quote_name: "某标的",
    currency: "CNY",
    currency_name: "人民币",
    org_type: 1,
    last_report_name: null,
    statuses: null,
    list: [],
  },
  error_code: 0,
  error_description: "",
};

/** 金融企业（org_type=2）—— 科目结构不同，投影层应给出警告 */
export const financialOrgFixture = {
  data: {
    quote_name: "某银行",
    currency: "CNY",
    currency_name: "人民币",
    org_type: 2,
    last_report_name: "2026一季报",
    statuses: null,
    list: [incomePeriodsFixture[0]],
  },
  error_code: 0,
  error_description: "",
};
