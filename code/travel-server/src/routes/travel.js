import express from 'express';
import TravelService from '../services/travelService.js';
import { createStreamResponse } from '../utils/streamUtils.js';

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
    const { message } = req.body;
    if(!message){
        return res.status(400).json({success: false, message: '参数缺少',timestamp: new Date().toISOString()});
    }
    // 创建流式响应
    const stream = createStreamResponse(res);
    // 调用大模型获取流式响应
    const result = await travelService.chat(message,(chunk) => {
        stream.send({type: 'chunk',content: chunk});
    });
    stream.send({type: 'complete',data: result});
    stream.end();
});

export default router;