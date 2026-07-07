import { ToolNode } from '@langchain/langgraph/prebuilt';
import { calculateBudget } from './calculator.js';
import { getWeather } from './weather.js';
import { searchPOI } from './poi.js';
import { searchFlights } from './flight.js';
import { searchHotels } from './hotel.js';
import { convertCurrency } from './currency.js';
import { searchKnowledge } from './knowledge.js';

/**
 * 全部工具列表
 */
export const TOOLS = [
  calculateBudget,
  getWeather,
  searchPOI,
  searchFlights,
  searchHotels,
  convertCurrency,
  searchKnowledge
];

/**
 * 工具名称 → 工具对象的映射
 */
export const toolByName = {};
for (const t of TOOLS) {
  toolByName[t.name] = t;
}

/**
 * 工具描述文本（用于 prompt）
 */
export function getToolDescriptions() {
  return TOOLS.map(t => {
    const shape = t.schema?.shape;
    const params = shape ? Object.entries(shape).map(([k, v]) => {
      const desc = v.description || v._def?.description || k;
      const required = !v.isOptional?.() ? '(必填)' : '';
      return `  - ${k}: ${desc} ${required}`;
    }).join('\n') : '无参数';
    return `- **${t.name}**: ${t.description}\n参数:\n${params}`;
  }).join('\n\n');
}

/**
 * 预构建的 ToolNode，用于 LangGraph 工具执行节点
 */
export const toolNode = new ToolNode(TOOLS);
