import express from 'express';
import TravelService from '../services/travelService.js';
import { createStreamResponse } from '../utils/streamUtils.js';
import { createTrace, markFirstToken, markDone } from '../utils/latencyTracker.js';
import { recordCacheAccess, getCacheStats, getAllCacheStats, clearCacheEvents } from '../utils/cacheTracker.js';
import { getCachedResponse, setCachedResponse, getResponseCacheStats, clearResponseCache } from '../utils/responseCache.js';

const travelService = new TravelService();


const router = express.Router();

router.post('/recommend', async (req, res) => {
    const { city,budget,days} = req.body;
    if(!city || !budget || !days){
        return res.status(400).json({success: false, message: '参数缺少',timestamp: new Date().toISOString()});
    }
    const startTime = Date.now();
    const result = await travelService.recommend(city,budget,days);
    const duration = Date.now() - startTime;
    // /recommend 被调用说明前端缓存未命中，记录为 miss
    recordCacheAccess('trip_plan', false, duration, `${city}|${budget}|${days}`);
    return res.json(result);
});

router.post('/chat', async (req, res) => {
    const { message, history } = req.body;
    if(!message){
        return res.status(400).json({success: false, message: '参数缺少',timestamp: new Date().toISOString()});
    }

    // ── 延迟追踪 ──
    const threadId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const trace = createTrace(threadId, message);
    trace.mode = 'normal';

    // 创建流式响应
    const stream = createStreamResponse(res);

    // ── ★ 响应缓存查询 ──
    const cachedResponse = getCachedResponse(message);
    if (cachedResponse !== null) {
        // 缓存命中：模拟流式输出
        console.log(`  [ResponseCache HIT] "${message.slice(0, 40)}..."`);
        markFirstToken(threadId);
        const chunkSize = 5; // 每次发送 5 个字符，模拟流式
        for (let i = 0; i < cachedResponse.length; i += chunkSize) {
            stream.send({
                type: 'chunk',
                content: cachedResponse.slice(i, i + chunkSize)
            });
        }
        const summary = markDone(threadId);
        stream.send({
            type: 'complete',
            data: { success: true, reply: cachedResponse, fromCache: true },
            latency: summary
        });
        stream.end();
        return;
    }

    // 缓存未命中：调用 LLM
    console.log(`  [ResponseCache MISS] "${message.slice(0, 40)}..."`);
    let firstTokenMarked = false;
    let chunkCount = 0;
    let fullResponse = '';

    // 调用大模型获取流式响应（携带历史对话上下文）
    const result = await travelService.chat(message, history, (chunk) => {
        if (!firstTokenMarked) {
            firstTokenMarked = true;
            markFirstToken(threadId);
        }
        chunkCount++;
        fullResponse += chunk;
        stream.send({type: 'chunk',content: chunk});
    });

    // 写入缓存
    if (result.success && fullResponse) {
        setCachedResponse(message, fullResponse);
    }

    // ── 记录完成 ──
    const summary = markDone(threadId);

    stream.send({
        type: 'complete',
        data: result,
        latency: summary
    });
    stream.end();
});

/**
 * POST /api/travel/cache-report
 * 前端上报缓存命中/未命中事件
 * 请求体: { cache: 'trip_history', hit: true/false, durationMs: number, key: string }
 */
router.post('/cache-report', (req, res) => {
    const { cache, hit, durationMs, key } = req.body;
    if (!cache || hit === undefined) {
        return res.status(400).json({ success: false, message: '参数缺少' });
    }
    recordCacheAccess(cache, hit, durationMs || 0, key || '');
    res.json({ success: true });
});

/**
 * GET /api/travel/cache-stats
 * 获取所有缓存点的命中率统计（含工具缓存、响应缓存、历史缓存）
 */
router.get('/cache-stats', (req, res) => {
    const stats = getAllCacheStats();
    const responseStats = getResponseCacheStats();
    // 工具缓存统计从 agent 路由获取，这里汇总
    res.json({
        success: true,
        data: {
            eventTracker: stats,
            responseCache: responseStats,
            note: '工具结果缓存统计请查看 GET /api/travel/agent/tool-cache-stats'
        }
    });
});

/**
 * DELETE /api/travel/cache-stats
 * 清空所有缓存统计数据 + 缓存内容
 */
router.delete('/cache-stats', (req, res) => {
    clearCacheEvents();
    clearResponseCache();
    res.json({ success: true, message: '所有缓存统计和内容已清空' });
});

export default router;