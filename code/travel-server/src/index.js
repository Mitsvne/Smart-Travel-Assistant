import express from 'express';
import travelRouter from './routes/travel.js';
import agentRouter from './routes/agent.js';
import { initKnowledge } from './agent/memory/knowledge.js';
import 'dotenv/config';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3000;

// 跨域中间件
app.use(cors());
// 中间件，解析请求体为 JSON 格式
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 心跳接口
app.get('/heartbeat', (req, res) => {
    console.log(req.body);
    res.json({message: '服务端启动成功', timestamp: new Date().toISOString()});
});

// 原有旅行规划路由（向后兼容）
app.use('/api/travel', travelRouter);
// 新增 Agent 路由
app.use('/api/travel', agentRouter);

// 初始化知识库后启动服务
initKnowledge()
  .then((kb) => {
    console.log(`Knowledge base ready: ${kb.count} documents`);
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
      console.log(`Agent endpoint: POST http://localhost:${port}/api/travel/agent`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize knowledge base:', err);
    process.exit(1);
  });