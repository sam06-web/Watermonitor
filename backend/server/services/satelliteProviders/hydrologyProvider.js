import axios from 'axios';
import config from '../../config/config.js';

/**
 * Hydrology & Land Surface Temperature Provider
 * Fetches real meteorological, land surface temperature, runoff and hydrological data
 * via Open-Meteo ERA5 / ECMWF Land APIs.
 */
export class HydrologyProvider {
  constructor() {
    this.openMeteoUrl = config.providers.hydrology.openMeteoUrl;
    this.historicalUrl = config.providers.hydrology.historicalUrl;
  }

  /**
   * Fetch current and 7-day surface temperature and precipitation
   */
  async getSurfaceHydrology(lat, lng) {
    return this._hydrology(lat, lng, this.openMeteoUrl, { current: 'temperature_2m,relative_humidity_2m,surface_temperature,precipitation,soil_moisture_0_to_1cm' });
  }

  /**
   * Real historical surface temperature and precipitation for a past date
   * (Open-Meteo / ECMWF ERA5 archive). Returns nulls when unavailable.
   */
  async getHistoricalHydrology(lat, lng, date) {
    const result = await this._hydrology(lat, lng, this.historicalUrl, {}, { start_date: date, end_date: date });
    if (!result.surfaceTemp) return result;
    return result;
  }

  async _hydrology(lat, lng, url, queryParams, extraParams = {}) {
    try {
      const res = await axios.get(url, {
        params: {
          latitude: lat,
          longitude: lng,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
          timezone: 'auto',
          ...extraParams,
          ...queryParams
        },
        timeout: 5000
      });

      if (res.data) {
        const c = res.data.current || {};
        const surfaceTemp = c.surface_temperature ?? c.temperature_2m ?? null;
        const dailyMax = res.data.daily?.temperature_2m_max?.[0] ?? null;
        const rain = res.data.daily?.precipitation_sum?.[0] ?? null;
        const isSurfaceValid = surfaceTemp != null && Number.isFinite(Number(surfaceTemp));
        const isDailyValid = dailyMax != null && Number.isFinite(Number(dailyMax));
        return {
          surfaceTemp: isSurfaceValid ? Number(surfaceTemp) : (isDailyValid ? Number(dailyMax) : null),
          airTemp: c.temperature_2m != null && Number.isFinite(Number(c.temperature_2m)) ? Number(c.temperature_2m) : null,
          humidity: c.relative_humidity_2m != null && Number.isFinite(Number(c.relative_humidity_2m)) ? Number(c.relative_humidity_2m) : null,
          precipitationMm: c.precipitation != null && Number.isFinite(Number(c.precipitation)) ? Number(c.precipitation) : null,
          soilMoisture: c.soil_moisture_0_to_1cm != null && Number.isFinite(Number(c.soil_moisture_0_to_1cm)) ? Number(c.soil_moisture_0_to_1cm) : null,
          dailyRainfall: rain != null && Number.isFinite(Number(rain)) ? Number(rain) : null
        };
      }
    } catch (err) {
      console.warn('Hydrology API request failed:', err.message);
    }

    return {
      surfaceTemp: null,
      airTemp: null,
      humidity: null,
      precipitationMm: null,
      soilMoisture: null,
      dailyRainfall: null
    };
  }
}

export default new HydrologyProvider();
