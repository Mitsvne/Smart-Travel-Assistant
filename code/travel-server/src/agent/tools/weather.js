import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * 天气查询工具
 * 使用 Open-Meteo 免费 API（无需 API Key）
 * 先通过 geocoding API 将城市名转为经纬度，再查天气
 */

// WMO 天气码到中文描述映射
const WMO_CODES = {
  0: '晴天', 1: '大部晴朗', 2: '多云', 3: '阴天',
  45: '雾', 48: '沉积雾凇',
  51: '小毛毛雨', 53: '中毛毛雨', 55: '大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '中阵雨', 82: '大阵雨',
  85: '小阵雪', 86: '大阵雪',
  95: '雷暴', 96: '雷暴+小冰雹', 99: '雷暴+大冰雹'
};

function weatherCodeToText(code) {
  return WMO_CODES[code] || `未知(${code})`;
}

/**
 * 城市名 → 经纬度（使用 Open-Meteo Geocoding API）
 */
async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`地理编码失败: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error(`未找到城市"${city}"，请使用标准城市名如"北京"、"上海"`);
  }
  const r = data.results[0];
  return {
    lat: r.latitude,
    lon: r.longitude,
    name: r.name || city,
    country: r.country || ''
  };
}

export const getWeather = tool(
  async ({ city, days }) => {
    try {
      // 1. 地理编码
      const coords = await geocode(city);

      // 2. 获取天气
      const forecastDays = Math.min(Math.max(days || 3, 1), 7);
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,windspeed_10m_max` +
        `&forecast_days=${forecastDays}&timezone=Asia/Shanghai`;

      const wRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(10000) });
      if (!wRes.ok) throw new Error(`天气查询失败: HTTP ${wRes.status}`);
      const wData = await wRes.json();

      // 3. 格式化
      const forecast = wData.daily.time.map((date, i) => ({
        date,
        maxTemp: `${wData.daily.temperature_2m_max[i]}°C`,
        minTemp: `${wData.daily.temperature_2m_min[i]}°C`,
        weather: weatherCodeToText(wData.daily.weathercode[i]),
        precipitation: `${wData.daily.precipitation_sum[i]}mm`,
        windSpeed: `${wData.daily.windspeed_10m_max[i]}km/h`
      }));

      return JSON.stringify({
        city: coords.name,
        country: coords.country,
        coordinates: { lat: coords.lat, lon: coords.lon },
        forecast,
        summary: `${coords.name}未来${forecastDays}天：${forecast.map(f => `${f.date}: ${f.weather} ${f.minTemp}~${f.maxTemp}`).join('；')}`
      });
    } catch (err) {
      return JSON.stringify({ error: true, message: `天气查询失败: ${err.message}` });
    }
  },
  {
    name: 'get_weather',
    description:
      '查询指定城市未来N天的天气预报。调用时机：用户询问目的地天气、出行日期天气、户外活动可行性判断。',
    schema: z.object({
      city: z.string().describe('城市名称，如"北京"、"上海"、"成都"'),
      days: z.number().min(1).max(7).default(3).describe('预报天数，1-7天')
    })
  }
);
