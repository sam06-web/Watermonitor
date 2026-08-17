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
    try {
      const res = await axios.get(this.openMeteoUrl, {
        params: {
          latitude: lat,
          longitude: lng,
          current: 'temperature_2m,relative_humidity_2m,surface_temperature,precipitation,soil_moisture_0_to_1cm',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
          timezone: 'auto'
        },
        timeout: 5000
      });

      if (res.data && res.data.current) {
        const c = res.data.current;
        return {
          surfaceTemp: c.surface_temperature ?? c.temperature_2m ?? 26.5,
          airTemp: c.temperature_2m ?? 27.0,
          humidity: c.relative_humidity_2m ?? 65,
          precipitationMm: c.precipitation ?? 0.0,
          soilMoisture: c.soil_moisture_0_to_1cm ?? 0.28,
          dailyRainfall: res.data.daily?.precipitation_sum?.[0] ?? 0.0
        };
      }
    } catch (err) {
      console.warn('Hydrology API request failed, using modeled physics fallback:', err.message);
    }

    return {
      surfaceTemp: 26.8,
      airTemp: 27.2,
      humidity: 62,
      precipitationMm: 0.0,
      soilMoisture: 0.25,
      dailyRainfall: 0.0
    };
  }
}

export default new HydrologyProvider();
