export const createStreamResponse = (res) => {
    //设置响应头，允许流式传输
    res.setHeader('Content-Type', 'text/event-stream');
    //确保客户端每次都是接受最新的数据
    res.setHeader('Cache-Control', 'no-cache');
    //保持http链接为长链接
    res.setHeader('Connection', 'keep-alive');
    return{
       send: (data) => {
        try{
            console.log(`data: ${JSON.stringify(data)}\n\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }catch(err){
            console.error("发送流式数据失败:", err);
        }
       },
       end: () => {
        try{
            res.write('event: end\ndata: {"done": "true"}\n\n');
            res.end();
        }
        catch(err){
            console.error("流式结束失败:", err);
        }
       },
       error:(message) => {
        try{
            res.write(`event: error\ndata: {"message": "${message}"}\n\n`);
            res.end();
        }
        catch(err){
            console.error("流式错误:", err);
        }
       }
    }
}