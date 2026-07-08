import express from 'express';
import TravelService from '../services/travelService.js';
import { createStreamResponse } from '../utils/streamUtils.js';
import { createTrace, markFirstToken, markDone } from '../utils/latencyTracker.js';

const travelService = new TravelService();


const router = express.Router();

router.post('/recommend', async (req, res) => {
    const { city,budget,days} = req.body;
    if(!city || !budget || !days){
        return res.status(400).json({success: false, message: '参数缺少',timestamp: new Date().toISOString()});
    }
    const result = await travelService.recommend(city,budget,days);
    return res.json(result);
    //res.json({message: '景点推荐',timestamp: new Date().toISOString()});
});

router.post('/chat', async (req, res) => {
    const { message, history } = req.body;
    if(!message){
        return res.status(400).json({success: false, message: '参数缺少',timestamp: new Date().toISOString()});
    }

    // ── 延迟追踪 ──
    const threadId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const trace = createTrace(threadId, message);
    trace.mode = 'normal'; // 标记为普通模式

    // 创建流式响应
    const stream = createStreamResponse(res);

    let firstTokenMarked = false;
    let chunkCount = 0;
    const startTime = Date.now();

    // 调用大模型获取流式响应（携带历史对话上下文）
    const result = await travelService.chat(message, history, (chunk) => {
        // ── 记录首 token ──
        if (!firstTokenMarked) {
            firstTokenMarked = true;
            markFirstToken(threadId);
        }
        chunkCount++;
        stream.send({type: 'chunk',content: chunk});
    });

    // ── 记录完成 ──
    const summary = markDone(threadId);

    stream.send({
        type: 'complete',
        data: result,
        latency: summary  // 附带延迟数据
    });
    stream.end();
});

export default router;