import {readForecastCache} from "./WeatherWidget";
test("forecast cache retains retrieval time and rejects malformed metadata", () => {
  localStorage.clear();
  const key = '49.000:18.000';
  const at = Date.now() - 60 * 60 * 1000;
  localStorage.setItem('weather-forecast-v2:' + key, JSON.stringify({at, payload: {daily: {time: ['2026-10-28']}}}));
  expect(readForecastCache(key).at).toBe(at);
  expect(readForecastCache(key).payload.daily.time).toEqual(['2026-10-28']);
  localStorage.setItem('weather-forecast-v2:' + key, JSON.stringify({payload: {}}));
  expect(readForecastCache(key)).toBeNull();
  localStorage.setItem('weather-forecast-v2:' + key, 'invalid');
  expect(readForecastCache(key)).toBeNull();
});
