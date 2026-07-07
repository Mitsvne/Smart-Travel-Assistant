import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 轻量级知识检索器
 * 无需向量库或嵌入模型，使用关键词+模糊匹配
 * 适合数百条文档以内的小规模知识库
 */

class KnowledgeRetriever {
  constructor() {
    this.documents = [];
    this.initialized = false;
  }

  /**
   * 加载知识库数据
   */
  async initialize() {
    if (this.initialized) return;

    const dataDir = join(__dirname, '..', '..', '..', 'data', 'knowledge');

    // 加载旅行贴士
    const tipsPath = join(dataDir, 'travel_tips.json');
    if (existsSync(tipsPath)) {
      try {
        const tips = JSON.parse(readFileSync(tipsPath, 'utf-8'));
        this.documents.push(...tips);
        console.log(`[Knowledge] Loaded ${tips.length} travel tips`);
      } catch (e) {
        console.warn('[Knowledge] Failed to load travel_tips.json:', e.message);
      }
    }

    // 加载城市指南
    const guidesPath = join(dataDir, 'city_guides.json');
    if (existsSync(guidesPath)) {
      try {
        const guides = JSON.parse(readFileSync(guidesPath, 'utf-8'));
        this.documents.push(...guides);
        console.log(`[Knowledge] Loaded ${guides.length} city guides`);
      } catch (e) {
        console.warn('[Knowledge] Failed to load city_guides.json:', e.message);
      }
    }

    // 加载景点数据（来自 POI 工具的 mock 数据）
    const spotsPath = join(dataDir, '..', '..', 'src', 'agent', 'tools', 'poi.js');
    // 景点数据已经内嵌在 poi 工具中，这里我们直接添加热门景点摘要
    const scenicSpots = this._getScenicSpots();
    this.documents.push(...scenicSpots);
    console.log(`[Knowledge] Added ${scenicSpots.length} scenic spot entries`);

    this.initialized = true;
    console.log(`[Knowledge] Total documents: ${this.documents.length}`);
  }

  /**
   * 内置热门景点知识
   */
  _getScenicSpots() {
    return [
      { id: 'spot_001', type: 'spot', city: '北京', title: '故宫', content: '故宫博物院位于北京中轴线中心，是明清两代的皇家宫殿，世界文化遗产。占地72万平方米，有宫殿70多座，房屋9000余间。旺季门票60元（4-10月），淡季40元。建议游览时间：3-4小时。必看：太和殿、乾清宫、珍宝馆、钟表馆。交通：地铁1号线天安门东站。', tags: ['北京', '故宫', '世界遗产', '古建筑'] },
      { id: 'spot_002', type: 'spot', city: '北京', title: '八达岭长城', content: '八达岭长城是明长城中保存最完好的段落，位于北京延庆区。门票旺季40元，淡季35元。建议游览时间：3-5小时。交通：德胜门乘877路直达，或S2线到八达岭站。提示：避开节假日高峰期，清晨前往人少。', tags: ['北京', '长城', '世界遗产', '古建筑'] },
      { id: 'spot_003', type: 'spot', city: '杭州', title: '西湖', content: '西湖是杭州的标志性景区，中国十大名胜之一，世界文化遗产。免费开放。建议游览方式：骑行环湖（约15km，2-3小时）或步行+游船。必看：断桥残雪、苏堤春晓、雷峰塔、三潭印月。最佳季节：春天樱花季（3-4月）和秋天桂花季（9-10月）。', tags: ['杭州', '西湖', '世界遗产', '自然'] },
      { id: 'spot_004', type: 'spot', city: '成都', title: '大熊猫繁育研究基地', content: '成都大熊猫基地位于成华区，是全球最大的大熊猫人工繁育机构。门票55元。建议游览时间：2-3小时，早上9点前到达可看到熊猫进食。交通：地铁3号线熊猫大道站，转公交198路。', tags: ['成都', '大熊猫', '动物园', '亲子'] },
      { id: 'spot_005', type: 'spot', city: '西安', title: '兵马俑', content: '秦始皇兵马俑博物馆位于西安临潼区，世界第八大奇迹。门票120元。建议游览时间：3-4小时。交通：西安火车站乘游5/306路公交直达。提示：建议请讲解或租讲解器，否则只能"看热闹"。', tags: ['西安', '兵马俑', '世界遗产', '历史'] },
      { id: 'spot_006', type: 'spot', city: '上海', title: '外滩', content: '外滩位于上海黄浦区中山东一路，万国建筑博览群。全天免费开放。最佳观赏时间：傍晚到夜晚，可同时欣赏白天建筑和夜景灯光。交通：地铁2/10号线南京东路站。', tags: ['上海', '外滩', '夜景', '建筑'] },
      { id: 'spot_007', type: 'spot', city: '三亚', title: '亚龙湾', content: '亚龙湾位于三亚市东南，被誉为"天下第一湾"。沙滩免费（部分酒店区域限住客）。最佳季节：11月至次年4月。水上项目：潜水、摩托艇、香蕉船等。交通：三亚市区乘15/25路公交。', tags: ['三亚', '亚龙湾', '海滩', '度假'] },
      { id: 'spot_008', type: 'spot', city: '重庆', title: '洪崖洞', content: '洪崖洞位于渝中区嘉陵江畔，巴渝传统吊脚楼建筑群。免费开放。最佳观赏时间：晚上亮灯后（约18:30-22:30），夜景极美，被称为"千与千寻"同款。交通：地铁1/6号线小什字站。', tags: ['重庆', '洪崖洞', '夜景', '建筑'] },
      { id: 'spot_009', type: 'spot', city: '广州', title: '广州塔', content: '广州塔（小蛮腰）位于海珠区，高600米，中国第一高塔。门票150元起（按楼层不同）。建议游览时间：2-3小时，建议选日落时段。交通：地铁3号线/APM线广州塔站。', tags: ['广州', '广州塔', '地标', '观景'] },
      { id: 'spot_010', type: 'spot', city: '深圳', title: '世界之窗', content: '世界之窗位于深圳南山区，大型文化旅游景区。门票220元。建议游览时间：半天至一天。交通：地铁1/2号线世界之窗站。', tags: ['深圳', '世界之窗', '主题乐园', '亲子'] },
      { id: 'spot_011', type: 'spot', city: '南京', title: '中山陵', content: '中山陵位于南京紫金山南麓，孙中山先生陵寝。免费开放（需预约）。建议游览时间：2-3小时。交通：地铁2号线苜蓿园站。提示：392级台阶，穿舒适的鞋。', tags: ['南京', '中山陵', '历史', '建筑'] },
      { id: 'spot_012', type: 'spot', city: '昆明', title: '石林', content: '石林风景区位于昆明石林彝族自治县，世界自然遗产。门票130元。建议游览时间：4-6小时。交通：昆明东部客运站乘班车到石林。最佳季节：3-10月。', tags: ['昆明', '石林', '世界遗产', '自然'] }
    ];
  }

  /**
   * 搜索知识库
   * @param {string} query - 搜索查询
   * @param {string} type - 过滤类型 (spot/tip/guide)，空则不限
   * @param {number} topK - 返回结果数
   */
  search(query, type = null, topK = 5) {
    if (!query || !query.trim()) return [];

    const q = query.toLowerCase().trim();
    const scored = [];

    for (const doc of this.documents) {
      // 类型过滤
      if (type && doc.type !== type) continue;

      let score = 0;
      const title = (doc.title || '').toLowerCase();
      const content = (doc.content || '').toLowerCase();
      const city = (doc.city || '').toLowerCase();
      const tags = (doc.tags || []).join(' ').toLowerCase();

      // 1. 精确城市名匹配（权重最高：文档的城市匹配查询中的城市名）
      if (city && q.includes(city)) {
        score += 10;
      }

      // 2. 标题精确包含
      if (q.includes(title)) {
        score += 8;
      } else if (title.includes(q)) {
        score += 5;
      }

      // 3. 内容关键词匹配
      const queryWords = q.split(/[\s,，、。！？]+/).filter(w => w.length >= 2);
      for (const word of queryWords) {
        if (title.includes(word)) score += 3;
        if (content.includes(word)) score += 1;
        if (tags.includes(word)) score += 2;
        if (city.includes(word) || word.includes(city)) score += 4;
      }

      // 4. 查询整体在内容中出现
      if (content.includes(q)) {
        score += 3;
      }

      // 5. Tag 匹配
      if (tags.includes(q)) {
        score += 4;
      }

      if (score > 0) {
        scored.push({ ...doc, score });
      }
    }

    // 按分数排序，取 topK
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * 获取指定城市的全部知识
   */
  getByCity(city) {
    return this.search(city, null, 10);
  }

  /**
   * 获取文档总数
   */
  get count() {
    return this.documents.length;
  }
}

// 单例
let instance = null;

export function getKnowledgeRetriever() {
  if (!instance) {
    instance = new KnowledgeRetriever();
  }
  return instance;
}

export async function initKnowledge() {
  const retriever = getKnowledgeRetriever();
  await retriever.initialize();
  return retriever;
}
