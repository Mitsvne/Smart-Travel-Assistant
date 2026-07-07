import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 预算计算工具
 * 计算旅行各项费用总和，验证预算是否合理
 * 纯数学运算，无需外部 API
 */
export const calculateBudget = tool(
  async ({ items, totalBudget }) => {
    const details = [];
    let totalCost = 0;

    for (const item of items) {
      const cost = Number(item.cost) || 0;
      details.push({ name: item.name, cost });
      totalCost += cost;
    }

    const remaining = totalBudget - totalCost;
    const percentUsed = totalBudget > 0 ? ((totalCost / totalBudget) * 100).toFixed(1) : '0';

    return JSON.stringify({
      breakdown: details,
      totalCost,
      totalBudget,
      remaining,
      percentUsed: `${percentUsed}%`,
      status: remaining >= 0 ? 'within_budget' : 'over_budget',
      advice:
        remaining >= 0
          ? `预算充足，剩余 ¥${remaining}，可用于升级住宿或增加体验项目`
          : `超出预算 ¥${Math.abs(remaining)}，建议削减餐饮或住宿开支`
    });
  },
  {
    name: 'calculate_budget',
    description:
      '计算旅行各项费用总和，验证预算是否合理。调用时机：用户给出预算和花费明细，需要计算是否超支。',
    schema: z.object({
      items: z
        .array(
          z.object({
            name: z.string().describe('费用项目名称，如"住宿"、"餐饮"、"交通"'),
            cost: z.number().describe('费用金额（人民币元）')
          })
        )
        .describe('各项费用列表'),
      totalBudget: z.number().describe('总预算（人民币元）')
    })
  }
);
