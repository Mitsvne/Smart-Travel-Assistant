import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import 'dotenv/config';

/**
 * 酒店搜索工具
 * 使用高德地图 POI（酒店类别）或模拟数据
 */

const AMAP_KEY = process.env.AMAP_API_KEY || '';

// 模拟酒店数据
const MOCK_HOTELS = {
  '北京': [
    { name: '北京王府井希尔顿酒店', area: '王府井', starRating: 5, priceRange: '800-1500元/晚', address: '东城区王府井大街' },
    { name: '北京国贸大酒店', area: 'CBD/国贸', starRating: 5, priceRange: '1200-2500元/晚', address: '朝阳区建国门外大街' },
    { name: '全季酒店(北京西单店)', area: '西单', starRating: 3, priceRange: '250-400元/晚', address: '西城区西单北大街' },
    { name: '如家精选(北京前门店)', area: '前门', starRating: 3, priceRange: '200-350元/晚', address: '东城区前门大街' },
    { name: '北京胡同里民宿', area: '南锣鼓巷', starRating: 0, priceRange: '150-300元/晚', address: '东城区南锣鼓巷' }
  ],
  '上海': [
    { name: '上海外滩华尔道夫酒店', area: '外滩', starRating: 5, priceRange: '1800-3500元/晚', address: '黄浦区中山东一路' },
    { name: '上海浦东香格里拉', area: '陆家嘴', starRating: 5, priceRange: '1000-2000元/晚', address: '浦东新区富城路' },
    { name: '汉庭酒店(上海南京路店)', area: '南京路', starRating: 2, priceRange: '180-300元/晚', address: '黄浦区南京东路' },
    { name: '上海迪士尼乐园酒店', area: '迪士尼', starRating: 5, priceRange: '1500-3000元/晚', address: '浦东新区申迪西路' }
  ],
  '成都': [
    { name: '成都瑞吉酒店', area: '春熙路', starRating: 5, priceRange: '900-1800元/晚', address: '锦江区东大街' },
    { name: '成都博舍酒店', area: '太古里', starRating: 5, priceRange: '1200-2500元/晚', address: '锦江区中纱帽街' },
    { name: '亚朵酒店(成都宽窄巷子店)', area: '宽窄巷子', starRating: 3, priceRange: '280-450元/晚', address: '青羊区宽窄巷子' },
    { name: '青旅(成都武侯祠店)', area: '武侯祠', starRating: 1, priceRange: '50-100元/晚', address: '武侯区武侯祠大街' }
  ],
  '杭州': [
    { name: '杭州四季酒店', area: '西湖', starRating: 5, priceRange: '2000-4000元/晚', address: '西湖区灵隐路' },
    { name: '杭州法云安缦', area: '灵隐', starRating: 5, priceRange: '3000-6000元/晚', address: '西湖区法云弄' },
    { name: '桔子酒店(杭州西湖店)', area: '西湖', starRating: 3, priceRange: '220-380元/晚', address: '上城区西湖大道' }
  ],
  '西安': [
    { name: '西安索菲特传奇酒店', area: '钟楼', starRating: 5, priceRange: '800-1500元/晚', address: '碑林区东新街' },
    { name: '西安威斯汀酒店', area: '大雁塔', starRating: 5, priceRange: '700-1300元/晚', address: '雁塔区慈恩路' },
    { name: '全季酒店(西安钟楼店)', area: '钟楼', starRating: 3, priceRange: '200-350元/晚', address: '碑林区南大街' }
  ],
  '广州': [
    { name: '广州四季酒店', area: '珠江新城', starRating: 5, priceRange: '1200-2500元/晚', address: '天河区珠江新城' },
    { name: '广州白天鹅宾馆', area: '沙面', starRating: 5, priceRange: '800-1500元/晚', address: '荔湾区沙面南街' }
  ],
  '深圳': [
    { name: '深圳瑞吉酒店', area: '罗湖', starRating: 5, priceRange: '1000-2000元/晚', address: '罗湖区深南东路' },
    { name: '深圳华侨城洲际', area: '华侨城', starRating: 5, priceRange: '900-1800元/晚', address: '南山区华侨城' }
  ],
  '重庆': [
    { name: '重庆解放碑威斯汀酒店', area: '解放碑', starRating: 5, priceRange: '700-1300元/晚', address: '渝中区解放碑' },
    { name: '重庆洪崖洞大酒店', area: '洪崖洞', starRating: 4, priceRange: '400-700元/晚', address: '渝中区沧白路' }
  ],
  '三亚': [
    { name: '三亚亚特兰蒂斯酒店', area: '海棠湾', starRating: 5, priceRange: '1500-4000元/晚', address: '海棠区海棠北路' },
    { name: '三亚艾迪逊酒店', area: '海棠湾', starRating: 5, priceRange: '1200-3000元/晚', address: '海棠区海棠北路' },
    { name: '三亚湾海居度假酒店', area: '三亚湾', starRating: 4, priceRange: '400-800元/晚', address: '天涯区三亚湾路' }
  ]
};

function getStarText(starRating) {
  if (starRating === 0) return '民宿/客栈';
  if (starRating === 1) return '青年旅舍';
  return '★'.repeat(starRating) + '☆'.repeat(Math.max(0, 5 - starRating));
}

async function searchAmapHotels(city, maxPrice) {
  if (!AMAP_KEY) throw new Error('NO_KEY');

  const params = new URLSearchParams({
    key: AMAP_KEY,
    keywords: '酒店',
    city,
    types: '住宿服务|宾馆酒店|星级酒店|经济型酒店',
    offset: '10',
    page: '1',
    extensions: 'all'
  });

  const url = `https://restapi.amap.com/v3/place/text?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();

  if (data.status !== '1') throw new Error(data.info || '高德API返回异常');

  return data.pois?.map(p => ({
    name: p.name,
    area: p.address?.split('区')[0] + '区' || '',
    starRating: p.biz_ext?.rating ? Math.round(parseFloat(p.biz_ext.rating)) : 3,
    priceRange: p.biz_ext?.cost || '请致电咨询',
    address: p.address || ''
  })) || [];
}

export const searchHotels = tool(
  async ({ city, budget, starRating }) => {
    let hotels;

    try {
      if (AMAP_KEY) {
        hotels = await searchAmapHotels(city);
      } else {
        throw new Error('NO_KEY');
      }
    } catch {
      // 降级到模拟数据
      hotels = MOCK_HOTELS[city] || [];

      if (hotels.length === 0) {
        // 使用通用酒店数据
        hotels = [
          { name: `${city}市中心商务酒店`, area: '市中心', starRating: 4, priceRange: '300-600元/晚', address: `${city}市中心` },
          { name: `${city}经济型连锁酒店`, area: '火车站', starRating: 2, priceRange: '150-250元/晚', address: `${city}火车站附近` },
          { name: `${city}青年旅舍`, area: '景区周边', starRating: 1, priceRange: '50-120元/晚', address: `${city}景区附近` }
        ];
      }
    }

    // 根据条件过滤
    let filtered = [...hotels];

    if (starRating && starRating > 0) {
      filtered = filtered.filter(h => h.starRating >= starRating);
    }

    if (budget) {
      // 解析价格范围进行筛选
      filtered = filtered.filter(h => {
        const match = h.priceRange.match(/(\d+)/);
        if (!match) return true;
        const lowPrice = parseInt(match[1]);
        return lowPrice <= budget / 3; // 预算分摊到每晚
      });
    }

    return JSON.stringify({
      city,
      count: filtered.length,
      filters: { starRating: starRating || '不限', budget: budget ? `¥${budget}` : '不限' },
      hotels: filtered.slice(0, 8).map(h => ({
        name: h.name,
        area: h.area || '',
        rating: getStarText(h.starRating),
        starRating: h.starRating,
        priceRange: h.priceRange,
        address: h.address || ''
      })),
      source: AMAP_KEY ? 'amap' : 'mock',
      note: AMAP_KEY ? '' : '当前使用模拟数据，配置 AMAP_API_KEY 以获取实时酒店信息'
    });
  },
  {
    name: 'search_hotels',
    description:
      '搜索指定城市的酒店住宿信息。调用时机：用户需要预订酒店、咨询住宿价格、寻找特定档次的住宿。',
    schema: z.object({
      city: z.string().describe('城市名称，如"北京"、"三亚"'),
      budget: z.number().optional().describe('住宿总预算（人民币元），用于筛选合适价位的酒店'),
      starRating: z.number().min(0).max(5).optional().describe('最低星级要求，0=民宿，1=青旅，3=三星，5=五星')
    })
  }
);
