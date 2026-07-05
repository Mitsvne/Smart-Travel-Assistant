import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
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
            configuration: {
                apiKey: apiKey,
                baseURL: baseURL,
                modelName: modelName,
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
        // 生成旅行提示
        const prompt = this.getTravelPrompt(city,budget,days);
        try{
            // 调用 LLM 模型
            const response = await this.llm.invoke(prompt);
            console.log(response);
            const fullResponse = response.content || '';
            try{
               const jsonMath=fullResponse.match(/'''json\n([\s\S]*?)'''/) ||
                fullResponse.match(/'''\n([\s\S]*?)'''/) ||
                fullResponse.match(/\{([\s\S]*?)}/);
                //处理后的JSON字符串
                const resData = JSON.parse(jsonMath[1]);
                return resData;
            }catch(err){
                return{
                success: false,
                error: 'JSON解析失败',
                rawResponse: error.message
                }
            }
        }catch(err){
            return{
                success: false,
                message: err.message
                }
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

请确保JSON格式正确，可以被解析。`);
    }
}
export default TravelService;