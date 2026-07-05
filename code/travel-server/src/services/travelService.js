import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage,SystemMessage } from '@langchain/core/messages';
import 'dotenv/config';

class TravelService {
    constructor() {
        this.initLLM();
    }
    initLLM(){
        // 初始化 LLM 模型
        let apiKey,baseURL,modelName
        apiKey = process.env.LLM_API_KEY;
        baseURL = process.env.LLM_BASE_URL;
        modelName = process.env.LLM_MODEL;
        this.llm = new ChatOpenAI({
            apiKey: apiKey,
            model: modelName,
            configuration: {
                baseURL: baseURL,
            },
            temperature: 0.5,
            streaming: true
        });
        
    }
    async recommend(city,budget,days){
        // 推荐景点
        if(budget <= 100 || days <= 1 || days >= 30){
            throw new Error('预算不能小于等于100元，旅行天数不能小于等于1天，不能大于30天之间');
        }
        const prompt = this.getTravelPrompt(city,budget,days);
        try{
            const response = await this.llm.invoke([prompt]);
            return this.parseResponse(response.content);
        }catch(err){
            return{
                success: false,
                message: err.message
                }
            }
    }

    parseResponse(content){
        // 去除可能存在的 markdown 代码块包裹，再解析为 JSON 对象
        const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        try{
            return JSON.parse(cleaned);
        }catch(err){
            return { success: false, message: '大模型返回内容解析失败', raw: content };
        }
    }

    getTravelPrompt(city,budget,days){
        // 生成旅行提示
        return new HumanMessage(`你是一个专业的旅游规划师，擅长根据用户的需求生成详细的旅行行程。

请根据以下信息为用户生成一份详细的旅游规划：
- 目的地城市：${city}
- 预算：${budget}元
- 旅行天数：${days}天

要求：
1. 每天的行程安排（上午、下午、晚上）
2. 每个景点的详细介绍
3. 交通建议
4. 预算分配明细
5. 注意事项

请以JSON格式输出，结构如下：
{
  "success": true,
  "city": "城市名",
  "days": 天数,
  "totalBudget": 总预算,
  "dailyItinerary": [
    {
      "day": 1,
      "date": "第1天",
      "morning": {
        "spot": "景点名称",
        "duration": "游览时长",
        "ticket": "门票价格",
        "transportation": "交通方式",
        "description": "景点介绍"
      },
      "afternoon": {
        "spot": "景点名称",
        "duration": "游览时长",
        "ticket": "门票价格",
        "transportation": "交通方式",
        "description": "景点介绍"
      },
      "evening": {
        "spot": "活动名称",
        "duration": "活动时长",
        "ticket": "费用",
        "transportation": "交通方式",
        "description": "活动介绍"
      }
    }
  ],
  "budgetBreakdown": {
    "accommodation": 住宿费用,
    "food": 餐饮费用,
    "transportation": 交通费用,
    "tickets": 门票费用,
    "other": 其他费用
  },
  "tips": ["提示1", "提示2", "提示3"],
  "warnings": ["注意事项1", "注意事项2"]
}

注意：totalBudget 及 budgetBreakdown 中的所有金额字段（accommodation、food、transportation、tickets、other）必须是纯数字，单位统一为人民币元，不得包含 "¥"、"元"、"日元" 等任何货币符号或单位文字；且各项金额之和应等于 totalBudget。

请确保JSON格式正确，可以被解析。`);
    }

    async chat(message,streamCallback){
        // 流式调用大模型
        const messages = [
          new SystemMessage('你是一个专业的旅游助手，擅长用中文回答用户关于旅游的问题。'),
          new HumanMessage(message)
        ]
        try{
          //调用大模型获取流式响应
          const response = await this.llm.stream(messages);
          let fullResponse = '';
          for await (const chunk of response) {
              const content = chunk.content || ''
              //如果返回内容为空，跳过
              if(content.trim() === ''){
                  continue;
              }
              fullResponse += content;
              if(streamCallback){
                  streamCallback(content);
              }
          }
          return {
              success: true,
              reply: fullResponse
          }
        }catch(err){
          return{
            success: false,
            message: err.message
          }
        }
    }

}
export default TravelService;