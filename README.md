# Smart-Travel-Assistant-Agent

> 基于 **LangGraph + DeepSeek** 的 AI Agent 智能旅行助手 — 输入目的地/预算/天数，Agent 自主调用工具，规划专属行程。

---

## 快速开始

```bash
# 后端 (port 3000)
cd code/travel-server && npm run dev

# 前端 (port 5173)
cd code/travel-h5 && npm run dev
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 · Vite · Pinia · Vant 4 |
| 后端 | Node.js · Express |
| Agent | **LangGraph.js** (StateGraph + ReAct) |
| LLM | DeepSeek v4-flash（兼容 OpenAI，可替换） |
| 知识库 | 本地检索引擎（34 条文档） |

---

## Agent 工作流

```
用户输入 → 🧠 理解意图 → 📋 制定计划 → 🔧 调用工具 → 📊 综合结果 → 📝 生成回复
                                          ↑                    │
                                          └── 信息不足则循环 ──┘
```

Agent 自主决定调用哪些工具、是否需要追加查询，最多 10 轮保护。

---

## 7 大工具

| 工具 | 用途 | 数据源 |
|------|------|--------|
| `search_knowledge` | 查景点/贴士/攻略 | 📚 本地知识库 34 条 |
| `get_weather` | 天气查询 | 🌤️ Open-Meteo（免费） |
| `search_poi` | 景点/餐厅搜索 | 📍 高德 API + 9 城数据 |
| `search_flights` | 机票查询 | ✈️ 16 条国内航线 |
| `search_hotels` | 酒店搜索 | 🏨 高德 API + 9 城数据 |
| `calculate_budget` | 预算分配 | 🧮 纯数学 |
| `convert_currency` | 汇率换算 | 💱 frankfurter.app（免费） |

---

## 架构一览

```
┌─ Vue 3 H5 ─────────────────────────────────────┐
│  Home（规划表单）· Chat（Agent 对话）· Detail（行程）│
└────────────────── SSE ─────────────────────────┘
                        │
┌─ Express :3000 ─────────────────────────────────┐
│  POST /api/travel/agent   ← Agent SSE 流式端点   │
│  POST /api/travel/recommend ← 原版规划（兼容）    │
│                                                  │
│  ┌─ LangGraph StateGraph ──────────────────────┐ │
│  │  agent ──(tool_calls)──→ tools ──→ agent    │ │
│  │    │                      7 tools ↑    │     │ │
│  │    └──(无调工具)──→ finalize → SSE 流式输出  │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

## 项目结构

```
Smart-Travel-Assistant/
├── README.md
├── code/
│   ├── travel-server/          # 后端
│   │   ├── src/
│   │   │   ├── agent/          # LangGraph Agent 核心
│   │   │   │   ├── graph.js    # StateGraph 定义
│   │   │   │   ├── nodes/      # agent / tools / finalize
│   │   │   │   ├── tools/      # 7 个工具
│   │   │   │   ├── prompts/    # 提示词模板
│   │   │   │   └── memory/     # 知识库检索引擎
│   │   │   ├── routes/         # API 路由
│   │   │   └── utils/          # SSE 工具
│   │   └── data/knowledge/     # 知识库 JSON
│   │
│   └── travel-h5/              # 前端
│       └── src/
│           ├── views/           # Home / Chat / Detail
│           ├── components/      # ChatBubble / AgentSteps
│           ├── stores/          # Pinia 状态管理
│           └── utils/           # HTTP + SSE 客户端
```

---

## 效果截图

<img width="604" height="1147" alt="首页" src="https://github.com/user-attachments/assets/edba69fe-f3e2-4511-9cbd-ec8c7894992a" />
<img width="602" height="1139" alt="行程规划" src="https://github.com/user-attachments/assets/577c1717-005e-4d53-a732-54ac8664bae9" />
<img width="609" height="1144" alt="AI对话" src="https://github.com/user-attachments/assets/0be267e0-f948-4ca7-a218-954a7908783f" />
<img width="606" height="1139" alt="预算明细" src="https://github.com/user-attachments/assets/cb1f84ec-3fce-4f56-afe4-2625c8d9d754" />
