import axios from 'axios';
import config from '../../config/config.js';

/**
 * Remote Sensing & Hydrological AI Analysis Engine
 * Calculates comprehensive River Health Score, Water Availability, Flood Risk, and Actionable Recommendations.
 */
export class AiAnalysisService {
  /**
   * Synthesize remote sensing indices into AI metrics
   */
  synthesizeAnalysis(metrics) {
    const clean = (value, fallback) => {
      const numeric = Number(value);
      return value != null && Number.isFinite(numeric) ? numeric : fallback;
    };

    const ndwi = clean(metrics.ndwi, 0.5);
    const ndvi = clean(metrics.ndvi, 0.6);
    const waterArea = clean(metrics.waterArea, 50.0);
    const baselineArea = clean(metrics.baselineArea, 50.0);
    const turbidity = clean(metrics.turbidity, 12.0);
    const temperature = clean(metrics.temperature, 26.5);
    const riverWidth = clean(metrics.riverWidth, 100.0);
    const cloudCover = clean(metrics.cloudCover, 10.0);
    const recentPrecipitation = clean(metrics.recentPrecipitation, 0.0);

    // 1. Water Surface Expansion Ratio
    const areaRatio = waterArea / (baselineArea || 1);
    
    // 2. Flood Risk Evaluation (0 - 100%)
    let floodRiskPct = 10;
    if (areaRatio > 1.35 || recentPrecipitation > 50) floodRiskPct = 78;
    else if (areaRatio > 1.20 || recentPrecipitation > 25) floodRiskPct = 55;
    else if (areaRatio > 1.10) floodRiskPct = 32;
    else if (ndwi > 0.65) floodRiskPct = 25;

    let floodStatus = 'Low';
    if (floodRiskPct > 70) floodStatus = 'Critical';
    else if (floodRiskPct > 45) floodStatus = 'Moderate';
    else if (floodRiskPct > 25) floodStatus = 'Alert';

    // 3. Pollution Risk & Turbidity Assessment
    let pollutionRisk = 'Low';
    if (turbidity > 40) pollutionRisk = 'High';
    else if (turbidity > 25) pollutionRisk = 'Elevated';
    else if (turbidity > 15) pollutionRisk = 'Moderate';

    // 4. Water Availability
    let waterAvailability = 'Stable';
    if (areaRatio > 1.15 && ndwi > 0.5) waterAvailability = 'Abundant';
    else if (areaRatio < 0.85 || ndwi < 0.2) waterAvailability = 'Stressed';
    else if (areaRatio < 0.70 || ndwi < 0.0) waterAvailability = 'Deficit';

    // 5. River Health Score Calculation (0 - 100)
    let score = 92;
    // Penalties
    if (turbidity > 15) score -= Math.min(30, (turbidity - 15) * 1.2);
    if (temperature > 30) score -= Math.min(15, (temperature - 30) * 3);
    if (ndvi < 0.4) score -= Math.min(15, (0.4 - ndvi) * 30); // degraded riparian vegetation
    if (ndwi < 0.2) score -= Math.min(20, (0.2 - ndwi) * 40); // low water index
    if (cloudCover > 60) score -= 4; // high observation uncertainty

    const healthScore = Math.max(25, Math.min(99, Math.round(score)));

    let healthGrade = 'Excellent';
    if (healthScore < 50) healthGrade = 'Poor';
    else if (healthScore < 70) healthGrade = 'Fair';
    else if (healthScore < 85) healthGrade = 'Good';

    // 6. Summary and Actionable Recommendations
    const areaChangePct = ((areaRatio - 1) * 100).toFixed(1);
    const changeSign = Number(areaChangePct) >= 0 ? '+' : '';

    const summary = `Remote sensing spectral observation confirms ${waterArea.toFixed(1)} km² surface water footprint (${changeSign}${areaChangePct}% vs baseline) with NDWI at ${ndwi > 0 ? '+' : ''}${ndwi.toFixed(3)}. Riparian buffer vegetative health (NDVI) is ${ndvi.toFixed(2)}. Water column turbidity stands at ${turbidity.toFixed(1)} NTU and surface temperature is ${temperature.toFixed(1)}°C. River width measured across main reach is ${riverWidth.toFixed(0)}m.`;

    let recommendation = 'Continue routine automated satellite monitoring. Water availability is stable and environmental indices align with seasonal thresholds.';
    if (floodStatus === 'Critical' || floodStatus === 'Moderate') {
      recommendation = 'Surge in surface reflectance detected across upstream catchment. Notify basin hydrology engineers and monitor reservoir discharge capacity.';
    } else if (pollutionRisk === 'Elevated' || pollutionRisk === 'High') {
      recommendation = 'Increased turbidity and particulate reflectance observed. Conduct targeted ground water sampling at industrial and agricultural confluence points.';
    } else if (waterAvailability === 'Stressed' || waterAvailability === 'Deficit') {
      recommendation = 'Surface water contraction detected. Implement water conservation measures in lower riparian distribution canals.';
    }

    return {
      healthScore,
      healthGrade,
      waterAvailability,
      floodStatus,
      floodRiskPct,
      pollutionRisk,
      summary,
      recommendation
    };
  }

  /**
   * Optional Gemini / OpenRouter live LLM prompt enrichment
   */
  async generateLlmAnalysis(riverName, metrics) {
    if (!config.ai.apiKey) {
      return null;
    }

    try {
      const prompt = `You are a satellite remote sensing and hydrology expert analyzing ${riverName}.
Current Satellite Metrics:
- NDWI: ${metrics.ndwi}
- Water Surface Area: ${metrics.waterArea} km²
- River Width: ${metrics.riverWidth} m
- Surface Temp: ${metrics.temperature} °C
- Turbidity: ${metrics.turbidity} NTU
- Cloud Cover: ${metrics.cloudCover}%

Provide a 2-sentence remote sensing summary and a 1-sentence actionable recommendation.`;

      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }]
      }, {
        headers: {
          'Authorization': `Bearer ${config.ai.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 6000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content.trim();
      }
    } catch (err) {
      console.warn('AI LLM enrichment request skipped:', err.message);
    }
    return null;
  }
}

export default new AiAnalysisService();
