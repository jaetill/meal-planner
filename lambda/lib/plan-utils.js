'use strict';

const WMO_CONDITIONS = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers',
  82: 'Heavy rain showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ hail',
};

function formatForecast(forecast) {
  return forecast.map(d => {
    const cond = WMO_CONDITIONS[d.code] || 'Unknown';
    const rain = d.precipMm > 0 ? `, ${d.precipMm}mm precip` : '';
    return `${d.date}: High ${d.highF}°F / Low ${d.lowF}°F, ${cond}${rain}`;
  }).join('\n');
}

module.exports = { formatForecast };
