import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 汇率换算工具
 * 使用 frankfurter.app 免费 API（无需 API Key）
 * 支持 30+ 常用货币
 */

// 汇率缓存（1小时过期）
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1小时

// 常用货币代码 → 中文名称
const CURRENCY_NAMES = {
  CNY: '人民币',
  USD: '美元',
  EUR: '欧元',
  JPY: '日元',
  KRW: '韩元',
  GBP: '英镑',
  HKD: '港币',
  TWD: '新台币',
  THB: '泰铢',
  SGD: '新加坡元',
  MYR: '马来西亚林吉特',
  IDR: '印尼盾',
  VND: '越南盾',
  PHP: '菲律宾比索',
  AUD: '澳元',
  NZD: '新西兰元',
  CAD: '加拿大元',
  CHF: '瑞士法郎'
};

async function getRates(base = 'CNY') {
  const now = Date.now();
  if (cache && cache.base === base && (now - cacheTime) < CACHE_TTL) {
    return cache;
  }

  try {
    const url = `https://api.frankfurter.app/latest?from=${base}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    cache = {
      base: data.base,
      date: data.date,
      rates: data.rates
    };
    cacheTime = now;
    return cache;
  } catch (err) {
    // 如果 API 不可用，返回常用参考汇率
    if (cache) return cache; // 用过期缓存
    return {
      base,
      date: new Date().toISOString().slice(0, 10),
      rates: {
        USD: 0.14,
        EUR: 0.13,
        JPY: 20.5,
        KRW: 183,
        GBP: 0.11,
        HKD: 1.1,
        TWD: 4.5,
        THB: 5.0,
        SGD: 0.19,
        AUD: 0.22,
        CAD: 0.19,
        CHF: 0.12
      }
    };
  }
}

export const convertCurrency = tool(
  async ({ amount, from, to }) => {
    try {
      const fromUpper = from.toUpperCase();
      const toUpper = to.toUpperCase();

      // 同币种
      if (fromUpper === toUpper) {
        return JSON.stringify({
          from: { code: fromUpper, name: CURRENCY_NAMES[fromUpper] || fromUpper, amount },
          to: { code: toUpper, name: CURRENCY_NAMES[toUpper] || toUpper, amount },
          rate: 1,
          result: amount,
          note: '同币种无需换算'
        });
      }

      const rateData = await getRates(fromUpper);
      const rate = rateData.rates[toUpper];

      if (!rate) {
        // 尝试通过欧元中转
        const eurData = await getRates('EUR');
        const fromToEur = fromUpper === 'EUR' ? 1 : eurData.rates[fromUpper];
        const eurToTarget = toUpper === 'EUR' ? 1 : eurData.rates[toUpper];

        if (fromToEur && eurToTarget) {
          const crossRate = eurToTarget / fromToEur;
          const result = Math.round(amount * crossRate * 100) / 100;
          return JSON.stringify({
            from: { code: fromUpper, name: CURRENCY_NAMES[fromUpper] || fromUpper, amount },
            to: { code: toUpper, name: CURRENCY_NAMES[toUpper] || toUpper, amount: result },
            rate: Math.round(crossRate * 10000) / 10000,
            result,
            date: rateData.date,
            note: `参考汇率（${rateData.date}），实际以银行牌价为准`
          });
        }

        return JSON.stringify({
          error: true,
          message: `不支持${toUpper}货币换算，支持的货币: ${Object.keys(CURRENCY_NAMES).join(', ')}`
        });
      }

      const result = Math.round(amount * rate * 100) / 100;
      return JSON.stringify({
        from: { code: fromUpper, name: CURRENCY_NAMES[fromUpper] || fromUpper, amount },
        to: { code: toUpper, name: CURRENCY_NAMES[toUpper] || toUpper, amount: result },
        rate: Math.round(rate * 10000) / 10000,
        result,
        date: rateData.date,
        note: `参考汇率（${rateData.date}），实际以银行牌价为准`
      });
    } catch (err) {
      return JSON.stringify({
        error: true,
        message: `汇率查询失败: ${err.message}`
      });
    }
  },
  {
    name: 'convert_currency',
    description:
      '查询实时汇率并进行货币换算。调用时机：用户询问汇率、需要换算旅行预算、对比外币价格。支持 CNY/USD/EUR/JPY/KRW/GBP/HKD/TWD/THB/SGD/AUD/CAD 等货币。',
    schema: z.object({
      amount: z.number().positive().describe('要换算的金额'),
      from: z.string().describe('源货币代码，如 CNY、USD、JPY'),
      to: z.string().describe('目标货币代码，如 CNY、USD、JPY')
    })
  }
);
