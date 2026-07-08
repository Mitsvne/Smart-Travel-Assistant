# Smart-Travel-Assistant-Agent

> 基于 **LangGraph + DeepSeek** 的 AI Agent 智能旅行助手 — 输入目的地/预算/天数，Agent 自主调用 7 类工具，规划专属行程。

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
| Agent | **LangGraph.js**（StateGraph + ReAct） |
| LLM | DeepSeek v4-flash（兼容 OpenAI，可替换） |
| 知识库 | 本地检索引擎（34 条文档） |
| 缓存 | MD5 哈希 · 工具结果缓存（TTL 30min~24h）· 响应缓存（TTL 30min） |
| 流式 | SSE（Server-Sent Events）前后端全链路流式 |

---

## Agent 工作流

```
用户输入 → 🧠 流式推理 → 🔧 调用工具 → 📊 综合结果 → 📝 流式输出
              ↓ 无工具调用时直接输出（跳过二次 LLM 调用）
              ↑ 工具结果缓存命中时跳过 API 请求
```

Agent 自主决定调用哪些工具、是否需要追加查询，最多 10 轮保护。无工具调用时通过流式直出将 TTFT 从 5-8s 降至 < 3s。

---

## 7 大工具

| 工具 | 用途 | 数据源 | 缓存 TTL |
|------|------|--------|----------|
| `search_knowledge` | 查景点/贴士/攻略 | 📚 本地知识库 34 条 | 24h |
| `get_weather` | 天气查询 | 🌤️ Open-Meteo（免费） | 30min |
| `search_poi` | 景点/餐厅搜索 | 📍 高德 API + 9 城数据 | 24h |
| `search_flights` | 机票查询 | ✈️ 16 条国内航线 | 1h |
| `search_hotels` | 酒店搜索 | 🏨 高德 API + 9 城数据 | 24h |
| `calculate_budget` | 预算分配 | 🧮 纯数学 | 永久 |
| `convert_currency` | 汇率换算 | 💱 frankfurter.app（免费） | 1h |

工具调用成功率 **100%**（23/23，覆盖 5 类工具）。所有工具均具备 try/catch + mock 兜底，外部 API 不可用时优雅降级。

---

## 性能优化

### 流式交互（SSE）

| 指标 | 普通模式 | Agent 模式（无工具） | Agent 模式（含工具） |
|------|---------|---------------------|---------------------|
| TTFT P50 | 2.1s | 3.3s | 3.7s |
| 总耗时 P50 | 6.7s | 4.5s | 9.7s |

Agent 模式优化：agent 节点改为流式调用，无工具时跳过 finalize 节点，将双 LLM 调用合并为一次。

### 双层缓存（MD5 哈希 + TTL）

| 缓存层 | 命中时提升 | 说明 |
|--------|-----------|------|
| 工具结果缓存 | **56-58%** | 天气/汇率等外部 API 调用跳过，Agent 端到端耗时减半 |
| 响应缓存 | **99%**（22ms vs 3.9s） | 归一化查询直接返回缓存结果，完全跳过 LLM |
| 前端 LocalStorage | **即时响应** | 相同行程参数从 LocalStorage 读取，无需 API 调用 |

Benchmark 脚本：`node scripts/benchmark-cache.js`

---

## 架构一览

```
┌─ Vue 3 H5 ───────────────────────────────────────┐
│  Home（规划表单）· Chat（Agent 对话）· Detail（行程）│
└────────────────── SSE ───────────────────────────┘
                        │
┌─ Express :3000 ───────────────────────────────────┐
│  POST /api/travel/agent   ← Agent SSE 流式端点     │
│  POST /api/travel/chat    ← 普通 SSE 流式端点      │
│  POST /api/travel/recommend ← 行程规划（兼容）      │
│                                                    │
│  ┌─ LangGraph StateGraph ────────────────────────┐ │
│  │  agent ──(tool_calls)──→ tools ──→ agent      │ │
│  │    │          ↑ 缓存命中跳过API    │            │ │
│  │    ├──(无工具)──→ END（流式直出）   │            │ │
│  │    └──(工具完成)──→ finalize → END  │            │ │
│  └────────────────────────────────────┘            │
│                                                    │
│  ┌─ 缓存层 ──────────────────────────────────────┐ │
│  │  toolCache（MD5 哈希 · TTL 可配 · 500 条）     │ │
│  │  responseCache（归一化查询 · TTL 30min）        │ │
│  └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## 项目结构

```
Smart-Travel-Assistant/
├── README.md
├── code/
│   ├── travel-server/              # 后端
│   │   ├── src/
│   │   │   ├── agent/              # LangGraph Agent 核心
│   │   │   │   ├── graph.js        # StateGraph 定义（含优化路由）
│   │   │   │   ├── nodes/          # agent / tools / finalize
│   │   │   │   ├── tools/          # 7 个工具（含缓存集成）
│   │   │   │   ├── prompts/        # 提示词模板
│   │   │   │   └── memory/         # 知识库检索引擎
│   │   │   ├── routes/             # API 路由 + 统计端点
│   │   │   └── utils/              # SSE · 延迟追踪 · 缓存 · 统计
│   │   ├── data/knowledge/         # 知识库 JSON
│   │   └── scripts/                # Benchmark 脚本
│   │       ├── benchmark.js        # 延迟对比测试
│   │       └── benchmark-cache.js  # 缓存效率测试
│   │
│   └── travel-h5/                  # 前端
│       └── src/
│           ├── views/              # Home / Chat / Detail
│           ├── components/         # ChatBubble / AgentSteps
│           ├── stores/             # Pinia（chat / history / trip）
│           └── utils/              # HTTP + SSE 客户端
```

---

## 调试 & 监控 API

| 端点 | 用途 |
|------|------|
| `GET /api/travel/agent/status` | Agent 状态（模型/工具/知识库/checkpoint） |
| `GET /api/travel/agent/latency-stats` | 延迟统计（P50/P90/P95，分有无工具调用） |
| `GET /api/travel/agent/latency-records` | 延迟明细记录 |
| `GET /api/travel/agent/tool-cache-stats` | 工具缓存命中率/条目数 |
| `GET /api/travel/agent/tool-success-stats` | 工具调用成功率（按工具分） |
| `GET /api/travel/cache-stats` | 响应缓存 + 前端缓存统计 |
| `DELETE /api/travel/agent/tool-cache` | 清空工具缓存 |
| `DELETE /api/travel/agent/tool-success-stats` | 重置工具统计 |

---

## 效果截图

<img width="604" height="1147" alt="首页" src="https://github.com/user-attachments/assets/edba69fe-f3e2-4511-9cbd-ec8c7894992a" />
<img width="602" height="1139" alt="行程规划" src="https://github.com/user-attachments/assets/577c1717-005e-4d53-a732-54ac8664bae9" />
<img width="609" height="1144" alt="AI对话" src="https://github.com/user-attachments/assets/0be267e0-f948-4ca7-a218-954a7908783f" />
<img width="606" height="1139" alt="预算明细" src="https://github.com/user-attachments/assets/cb1f84ec-3fce-4f56-afe4-2625c8d9d754" />
