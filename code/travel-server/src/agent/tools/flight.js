import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 机票查询工具
 * 使用模拟数据（国内主要航线），后续可接入 AviationStack 或天行数据
 */

// 国内主要城市之间的模拟航班数据
const FLIGHT_DATA = {};

// 城市对 → 航班列表
const ROUTES = [
  // 北京出发
  ['北京', '上海', [{ flight: 'CA1521', airline: '国航', depart: '07:30', arrive: '09:45', price: 680, duration: '2h15m' }, { flight: 'MU5102', airline: '东航', depart: '10:00', arrive: '12:15', price: 720, duration: '2h15m' }, { flight: 'CZ3690', airline: '南航', depart: '14:30', arrive: '16:50', price: 550, duration: '2h20m' }, { flight: 'HU7601', airline: '海航', depart: '19:00', arrive: '21:10', price: 480, duration: '2h10m' }]],
  ['北京', '成都', [{ flight: 'CA4101', airline: '国航', depart: '08:00', arrive: '11:00', price: 850, duration: '3h' }, { flight: '3U8881', airline: '川航', depart: '12:30', arrive: '15:30', price: 650, duration: '3h' }, { flight: 'CZ6183', airline: '南航', depart: '16:00', arrive: '19:00', price: 580, duration: '3h' }]],
  ['北京', '广州', [{ flight: 'CA1301', airline: '国航', depart: '09:00', arrive: '12:20', price: 920, duration: '3h20m' }, { flight: 'CZ3100', airline: '南航', depart: '14:00', arrive: '17:20', price: 780, duration: '3h20m' }]],
  ['北京', '西安', [{ flight: 'MU2101', airline: '东航', depart: '07:00', arrive: '09:10', price: 520, duration: '2h10m' }, { flight: 'CA1201', airline: '国航', depart: '13:00', arrive: '15:10', price: 580, duration: '2h10m' }]],
  ['北京', '杭州', [{ flight: 'CA1701', airline: '国航', depart: '08:30', arrive: '10:50', price: 620, duration: '2h20m' }, { flight: 'HU7101', airline: '海航', depart: '15:00', arrive: '17:20', price: 450, duration: '2h20m' }]],

  // 上海出发
  ['上海', '北京', [{ flight: 'CA1522', airline: '国航', depart: '10:30', arrive: '12:50', price: 720, duration: '2h20m' }, { flight: 'MU5101', airline: '东航', depart: '18:00', arrive: '20:15', price: 680, duration: '2h15m' }]],
  ['上海', '成都', [{ flight: 'CA4501', airline: '国航', depart: '09:00', arrive: '12:10', price: 880, duration: '3h10m' }, { flight: '3U8961', airline: '川航', depart: '14:00', arrive: '17:10', price: 720, duration: '3h10m' }]],
  ['上海', '深圳', [{ flight: 'CZ3551', airline: '南航', depart: '08:00', arrive: '10:30', price: 650, duration: '2h30m' }, { flight: 'MU5301', airline: '东航', depart: '16:00', arrive: '18:30', price: 580, duration: '2h30m' }]],
  ['上海', '西安', [{ flight: 'MU2151', airline: '东航', depart: '11:00', arrive: '13:30', price: 550, duration: '2h30m' }]],
  ['上海', '三亚', [{ flight: 'CZ6751', airline: '南航', depart: '07:30', arrive: '10:50', price: 780, duration: '3h20m' }, { flight: 'HU7301', airline: '海航', depart: '14:00', arrive: '17:20', price: 650, duration: '3h20m' }]],

  // 广州出发
  ['广州', '北京', [{ flight: 'CA1330', airline: '国航', depart: '08:00', arrive: '11:10', price: 950, duration: '3h10m' }, { flight: 'CZ3108', airline: '南航', depart: '16:00', arrive: '19:10', price: 780, duration: '3h10m' }]],
  ['广州', '成都', [{ flight: 'CZ3401', airline: '南航', depart: '09:30', arrive: '12:00', price: 580, duration: '2h30m' }, { flight: '3U8731', airline: '川航', depart: '15:00', arrive: '17:30', price: 520, duration: '2h30m' }]],
  ['广州', '三亚', [{ flight: 'CZ6731', airline: '南航', depart: '07:00', arrive: '08:30', price: 380, duration: '1h30m' }]]
];

// 初始化航班数据
for (const [from, to, flights] of ROUTES) {
  const key = `${from}-${to}`;
  FLIGHT_DATA[key] = flights;
}

function findFlights(from, to) {
  // 精确匹配
  const key = `${from}-${to}`;
  if (FLIGHT_DATA[key]) return FLIGHT_DATA[key];

  // 反向查询
  const revKey = `${to}-${from}`;
  if (FLIGHT_DATA[revKey]) return FLIGHT_DATA[revKey];

  // 模糊匹配
  for (const [k, v] of Object.entries(FLIGHT_DATA)) {
    if (k.includes(from) && k.includes(to)) return v;
  }

  return [];
}

function estimatePrice(from, to) {
  // 估算距离 → 估算票价
  const majorCities = {
    '北京': { lat: 39.9, lon: 116.4 },
    '上海': { lat: 31.2, lon: 121.5 },
    '广州': { lat: 23.1, lon: 113.3 },
    '深圳': { lat: 22.5, lon: 114.1 },
    '成都': { lat: 30.6, lon: 104.1 },
    '杭州': { lat: 30.3, lon: 120.2 },
    '西安': { lat: 34.3, lon: 108.9 },
    '重庆': { lat: 29.6, lon: 106.5 },
    '南京': { lat: 32.1, lon: 118.8 },
    '武汉': { lat: 30.6, lon: 114.3 },
    '长沙': { lat: 28.2, lon: 113.0 },
    '三亚': { lat: 18.2, lon: 109.5 },
    '昆明': { lat: 25.0, lon: 102.7 },
    '厦门': { lat: 24.5, lon: 118.1 },
    '青岛': { lat: 36.1, lon: 120.4 },
    '大连': { lat: 38.9, lon: 121.6 }
  };

  const fromCoord = majorCities[from];
  const toCoord = majorCities[to];

  if (!fromCoord || !toCoord) return null;

  // 粗略距离计算（Haversine 简化）
  const R = 6371;
  const dLat = ((toCoord.lat - fromCoord.lat) * Math.PI) / 180;
  const dLon = ((toCoord.lon - fromCoord.lon) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((fromCoord.lat * Math.PI) / 180) * Math.cos((toCoord.lat * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // 估算：基础票价 = 距离 * 0.5 元
  const basePrice = Math.round(dist * 0.5);
  return {
    estimated: true,
    distance: `${Math.round(dist)}km`,
    priceRange: `${Math.round(basePrice * 0.6)}-${Math.round(basePrice * 1.5)}元`,
    note: '此为估算价格，实际价格以航空公司为准'
  };
}

export const searchFlights = tool(
  async ({ from, to, date }) => {
    const flights = findFlights(from, to);

    if (flights.length > 0) {
      return JSON.stringify({
        route: `${from} → ${to}`,
        date: date || '待定',
        count: flights.length,
        flights: flights.map(f => ({
          flight: f.flight,
          airline: f.airline,
          depart: f.depart,
          arrive: f.arrive,
          price: `¥${f.price}`,
          duration: f.duration
        })),
        note: '航班数据为模拟参考，实际请以航空公司官网为准'
      });
    }

    // 无精确匹配，返回估算
    const estimate = estimatePrice(from, to);
    if (estimate) {
      return JSON.stringify({
        route: `${from} → ${to}`,
        date: date || '待定',
        count: 0,
        flights: [],
        estimate,
        note: '未找到精确航班数据，以上为估算价格范围'
      });
    }

    return JSON.stringify({
      route: `${from} → ${to}`,
      error: true,
      message: `未找到${from}到${to}的航班信息，建议查询主流航空公司官网`
    });
  },
  {
    name: 'search_flights',
    description:
      '查询两个城市之间的航班信息（国内航线）。调用时机：用户询问机票价格、航班信息、出行交通方式。',
    schema: z.object({
      from: z.string().describe('出发城市，如"北京"、"上海"'),
      to: z.string().describe('到达城市，如"成都"、"杭州"'),
      date: z.string().optional().describe('出发日期，如"2026-07-15"，不填则返回通用航班信息')
    })
  }
);
