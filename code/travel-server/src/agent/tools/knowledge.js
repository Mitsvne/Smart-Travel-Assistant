import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getKnowledgeRetriever } from '../memory/knowledge.js';

/**
 * 知识库搜索工具
 * 从本地知识库检索旅行相关信息
 */
export const searchKnowledge = tool(
  async ({ query, type, topK }) => {
    try {
      const retriever = getKnowledgeRetriever();
      const results = retriever.search(query, type || null, topK || 5);

      if (results.length === 0) {
        return JSON.stringify({
          query,
          count: 0,
          results: [],
          message: `未找到与"${query}"相关的知识条目`
        });
      }

      return JSON.stringify({
        query,
        count: results.length,
        results: results.map(r => ({
          title: r.title,
          type: r.type,
          city: r.city || '',
          content: r.content,
          tags: r.tags || [],
          relevance: r.score
        })),
        source: 'local_knowledge_base'
      });
    } catch (err) {
      return JSON.stringify({
        error: true,
        message: `知识库搜索失败: ${err.message}`
      });
    }
  },
  {
    name: 'search_knowledge',
    description:
      '搜索本地旅游知识库，获取景点详情、旅行贴士、城市指南等信息。调用时机：用户询问景点详情、旅行建议、城市攻略、打包清单、预算建议等。知识库包含：热门景点介绍（门票/交通/游览建议）、旅行贴士（保险/打包/预订/安全）、城市速览（最佳季节/必游/美食）。',
    schema: z.object({
      query: z.string().describe('搜索查询，如"故宫"、"杭州攻略"、"旅行保险"、"预算规划"'),
      type: z.enum(['spot', 'tip', 'guide']).optional().describe('过滤类型：spot=景点, tip=贴士, guide=城市指南'),
      topK: z.number().min(1).max(10).default(5).describe('返回结果数量，默认5条')
    })
  }
);
