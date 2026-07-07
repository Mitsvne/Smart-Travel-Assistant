import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import 'dotenv/config';

/**
 * POI / 景点搜索工具
 * 使用高德地图 POI 搜索 API，无 API Key 时降级为模拟数据
 */

// 高德地图 API Key
const AMAP_KEY = process.env.AMAP_API_KEY || '';

// 热门城市模拟景点数据
const MOCK_SPOTS = {
  '北京': [
    { name: '故宫博物院', address: '东城区景山前街4号', type: '国家级景点', rating: '4.8', ticket: '60元', description: '明清两代皇家宫殿，世界文化遗产，中国最大的古代宫廷建筑群' },
    { name: '长城（八达岭）', address: '延庆区G6京藏高速58号出口', type: '国家级景点', rating: '4.7', ticket: '40元', description: '世界七大奇迹之一，明长城精华段，雄伟壮观' },
    { name: '颐和园', address: '海淀区新建宫门路19号', type: '国家级景点', rating: '4.7', ticket: '30元', description: '清代皇家园林，中国现存最大的皇家园林' },
    { name: '天坛公园', address: '东城区天坛内东里7号', type: '国家级景点', rating: '4.6', ticket: '15元', description: '明清皇帝祭天场所，标志性建筑祈年殿所在地' },
    { name: '南锣鼓巷', address: '东城区南锣鼓巷', type: '特色街区', rating: '4.4', ticket: '免费', description: '北京最古老的胡同之一，美食与文创聚集地' }
  ],
  '上海': [
    { name: '外滩', address: '黄浦区中山东一路', type: '观光景点', rating: '4.8', ticket: '免费', description: '黄浦江畔万国建筑博览群，上海城市名片' },
    { name: '东方明珠', address: '浦东新区世纪大道1号', type: '观景台', rating: '4.5', ticket: '199元', description: '上海地标，263米观光层俯瞰浦江两岸' },
    { name: '迪士尼乐园', address: '浦东新区川沙镇黄赵路310号', type: '主题乐园', rating: '4.7', ticket: '475元起', description: '中国大陆首座迪士尼主题乐园' },
    { name: '豫园', address: '黄浦区福佑路168号', type: '古典园林', rating: '4.5', ticket: '40元', description: '明代江南私家园林，城隍庙商圈核心' },
    { name: '南京路步行街', address: '黄浦区南京东路', type: '商业街区', rating: '4.4', ticket: '免费', description: '中华商业第一街，购物天堂' }
  ],
  '成都': [
    { name: '宽窄巷子', address: '青羊区长顺上街', type: '历史文化区', rating: '4.5', ticket: '免费', description: '成都三大历史文化保护区之一，体验地道成都慢生活' },
    { name: '大熊猫繁育研究基地', address: '成华区熊猫大道1375号', type: '动物园', rating: '4.8', ticket: '55元', description: '近距离观赏国宝大熊猫的最佳去处' },
    { name: '锦里古街', address: '武侯区武侯祠大街231号', type: '特色街区', rating: '4.4', ticket: '免费', description: '西蜀历史上最古老商业街，三国文化与美食结合' },
    { name: '都江堰', address: '都江堰市公园路', type: '世界遗产', rating: '4.7', ticket: '80元', description: '2000多年历史的水利工程，世界文化遗产' },
    { name: '武侯祠', address: '武侯区武侯祠大街231号', type: '历史遗迹', rating: '4.5', ticket: '50元', description: '纪念三国蜀汉丞相诸葛亮的祠堂' }
  ],
  '杭州': [
    { name: '西湖', address: '西湖区龙井路1号', type: '国家级景点', rating: '4.9', ticket: '免费', description: '中国十大名胜之一，人间天堂，世界文化遗产' },
    { name: '灵隐寺', address: '西湖区法云弄1号', type: '寺庙', rating: '4.6', ticket: '75元', description: '中国佛教禅宗十大古刹之一，千年古寺' },
    { name: '西溪湿地', address: '西湖区天目山路518号', type: '湿地公园', rating: '4.4', ticket: '80元', description: '中国首个国家湿地公园，《非诚勿扰》取景地' }
  ],
  '西安': [
    { name: '兵马俑', address: '临潼区秦陵北路', type: '世界遗产', rating: '4.8', ticket: '120元', description: '世界第八大奇迹，秦始皇陵陪葬陶俑' },
    { name: '大雁塔', address: '雁塔区大慈恩寺内', type: '历史建筑', rating: '4.5', ticket: '50元', description: '唐代高僧玄奘译经之地，西安地标' },
    { name: '回民街', address: '莲湖区北院门', type: '美食街区', rating: '4.3', ticket: '免费', description: '西安著名美食街，汇聚西北特色小吃' }
  ],
  '广州': [
    { name: '广州塔', address: '海珠区阅江西路222号', type: '观景台', rating: '4.5', ticket: '150元', description: '中国第一高塔，600米高空俯瞰羊城' },
    { name: '长隆野生动物世界', address: '番禺区大石镇105国道', type: '动物园', rating: '4.7', ticket: '300元', description: '亚洲最大野生动物主题公园' },
    { name: '沙面岛', address: '荔湾区沙面大街', type: '历史文化区', rating: '4.4', ticket: '免费', description: '欧陆风情建筑群，百年历史租界岛' }
  ],
  '深圳': [
    { name: '世界之窗', address: '南山区深南大道9037号', type: '主题乐园', rating: '4.3', ticket: '220元', description: '汇集世界奇观的大型文化旅游景区' },
    { name: '欢乐谷', address: '南山区侨城西街18号', type: '主题乐园', rating: '4.4', ticket: '230元', description: '大型现代化主题乐园' },
    { name: '深圳湾公园', address: '南山区滨海大道', type: '城市公园', rating: '4.5', ticket: '免费', description: '15公里滨海长廊，眺望香港' }
  ],
  '重庆': [
    { name: '洪崖洞', address: '渝中区嘉陵江滨江路88号', type: '观光景点', rating: '4.5', ticket: '免费', description: '巴渝传统吊脚楼建筑群，夜景如千与千寻' },
    { name: '磁器口古镇', address: '沙坪坝区磁南街1号', type: '古镇', rating: '4.3', ticket: '免费', description: '千年古镇，重庆码头文化活化石' },
    { name: '长江索道', address: '渝中区新华路153号', type: '交通体验', rating: '4.4', ticket: '20元', description: '万里长江第一条空中走廊' }
  ]
};

// 未匹配城市时的通用回复
const DEFAULT_SPOTS = [
  { name: '市中心步行街', type: '商业街区', rating: '4.0', ticket: '免费', description: '城市核心商圈，购物餐饮汇聚' },
  { name: '城市博物馆', type: '博物馆', rating: '4.3', ticket: '免费', description: '了解本地历史文化的最佳场所' },
  { name: '城市公园', type: '公园', rating: '4.2', ticket: '免费', description: '市民休闲娱乐的城市绿肺' }
];

async function searchAmap(city, keyword, types) {
  if (!AMAP_KEY) throw new Error('NO_KEY');

  const params = new URLSearchParams({
    key: AMAP_KEY,
    keywords: keyword || city,
    city,
    types: types || '风景名胜|公园广场|纪念馆|寺庙道观|国家级景点',
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
    address: p.address || '',
    type: p.type || '',
    rating: p.biz_ext?.rating || '暂无',
    ticket: p.biz_ext?.cost || '请致电咨询',
    description: p.biz_ext?.rating ? `评分${p.biz_ext.rating}` : ''
  })) || [];
}

function searchMock(city, keyword) {
  let spots = MOCK_SPOTS[city] || DEFAULT_SPOTS;

  if (keyword) {
    const kw = keyword.toLowerCase();
    spots = spots.filter(s =>
      s.name.includes(kw) || s.description.includes(kw) || s.type.includes(kw)
    );
    if (spots.length === 0) spots = MOCK_SPOTS[city] || DEFAULT_SPOTS;
  }

  return spots.slice(0, 5);
}

export const searchPOI = tool(
  async ({ city, keyword, types }) => {
    try {
      // 尝试高德 API
      if (AMAP_KEY) {
        const results = await searchAmap(city, keyword, types);
        return JSON.stringify({
          source: 'amap',
          city,
          keyword: keyword || city,
          count: results.length,
          pois: results
        });
      }
    } catch (e) {
      // API 不可用，降级
    }

    // 降级到模拟数据
    const results = searchMock(city, keyword);
    return JSON.stringify({
      source: 'mock',
      city,
      keyword: keyword || city,
      count: results.length,
      pois: results,
      note: '当前使用模拟数据，配置 AMAP_API_KEY 以获取实时 POI 信息'
    });
  },
  {
    name: 'search_poi',
    description:
      '搜索城市内的景点、餐厅、酒店、商场等 POI 信息。调用时机：用户询问某城市有哪些景点、推荐游玩地点、搜索特定类型的地点。',
    schema: z.object({
      city: z.string().describe('城市名称，如"北京"、"上海"、"杭州"'),
      keyword: z.string().optional().describe('搜索关键词，如"长城"、"博物馆"，不填则返回热门景点'),
      types: z.string().optional().describe('POI类型，如"风景名胜"、"餐饮"、"购物"，不填则默认搜索景点')
    })
  }
);
