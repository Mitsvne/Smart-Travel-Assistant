import express from 'express';
import travelRouter from './routes/travel.js';
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

    res.json({message: '服务端启动成功',timestamp: new Date().toISOString()});
});

// 中间件，解析请求体为 JSON 格式
app.use('/api/travel', travelRouter);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});