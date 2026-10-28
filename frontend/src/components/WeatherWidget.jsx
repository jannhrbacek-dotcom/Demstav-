/**
 * Widget Počasí – kompaktní řádek 4 dnů + hodinový graf srážek pro dnešek.
 *
 * Zdroj polohy (v tomto pořadí):
 *   1. `preferredWorkplaceId` → GPS z /workplaces.
 *   2. První aktivní pracoviště s GPS.
 *   3. Geolokace zařízení (po klepnutí na tlačítko).
 *
 * Předpověď se cachuje v localStorage na 45 min, aby fungovala i offline.
 */
import React, { useEffect, useMemo, useState } from "react";
import { MapPin, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Sun, Loader2, Droplets, ChevronDown, ChevronUp } from "lucide-react";

const CACHE_PREFIX = "weather-forecast-v2:";
const TTL_MS = 45 * 60 * 1000;

const CODE = {
  0: { icon: Sun, label: "Jasno" },
  1: { icon: CloudSun, label: "Většinou jasno" },
  2: { icon: CloudSun, label: "Polojasno" },
  3: { icon: Cloud, label: "Zataženo" },
  45: { icon: CloudFog, label: "Mlha" },
  48: { icon: CloudFog, label: "Mrznoucí mlha" },
  51: { icon: CloudRain, label: "Mrholení" },
  53: { icon: CloudRain, label: "Mrholení" },
  55: { icon: CloudRain, label: "Silné mrholení" },
  61: { icon: CloudRain, label: "Slabý déšť" },
  63: { icon: CloudRain, label: "Déšť" },
  65: { icon: CloudRain, label: "Silný déšť" },
  66: { icon: CloudRain, label: "Mrznoucí déšť" },
  67: { icon: CloudRain, label: "Silný mrznoucí déšť" },
  71: { icon: CloudSnow, label: "Slabé sněžení" },
  73: { icon: CloudSnow, label: "Sněžení" },
  75: { icon: CloudSnow, label: "Silné sněžení" },
  77: { icon: CloudSnow, label: "Krupky" },
  80: { icon: CloudRain, label: "Přeháňky" },
  81: { icon: CloudRain, label: "Přeháňky" },
  82: { icon: CloudRain, label: "Silné přeháňky" },
  85: { icon: CloudSnow, label: "Sněhové přeháňky" },
  86: { icon: CloudSnow, label: "Sněhové přeháňky" },
  95: { icon: CloudLightning, label: "Bouřka" },
  96: { icon: CloudLightning, label: "Bouřka s krupobitím" },
  99: { icon: CloudLightning, label: "Silná bouřka" },
};
function describe(code) { return CODE[code] || { icon: Cloud, label: "Neznámé" }; }

const DAY_SHORT = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
function labelFor(dateStr, idx) {
  if (idx === 0) return "Dnes";
  if (idx === 1) return "Zítra";
  const d = new Date(dateStr + "T00:00:00");
  return DAY_SHORT[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1) + ".";
}

export function readForecastCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.payload && Number.isFinite(data.at) ? data : null;
  } catch (_) { return null; }
}
function writeCache(key, payload) { try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), payload })); } catch (_) { /* ignore */ } }

async function fetchForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    + "&hourly=precipitation_probability,precipitation,weathercode,temperature_2m"
    + "&current=temperature_2m,weather_code&forecast_days=4&timezone=Europe%2FPrague";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Nepodařilo se načíst předpověď počasí (" + res.status + ").");
  return res.json();
}

/** Vyrobí 24 hodinových slotů od začátku dnešního dne v časové zóně Europe/Prague. */
function hourlyForDay(data, day) {
  if (!data?.hourly?.time) return [];
  const indexes = [];
  data.hourly.time.forEach((t, i) => { if (t.startsWith(day)) indexes.push(i); });
  return indexes.map(i => ({
    hour: parseInt(data.hourly.time[i].slice(11, 13), 10),
    pop: Number(data.hourly.precipitation_probability?.[i] ?? 0),
    mm: Number(data.hourly.precipitation?.[i] ?? 0),
    temp: data.hourly.temperature_2m?.[i] == null ? null : Math.round(data.hourly.temperature_2m[i]),
    code: Number(data.hourly.weathercode?.[i] ?? 0),
  }));
}

/** Decentní sparklinový sloupcový graf 24 h pravděpodobnosti srážek. */
function HourlyChart({ hours, nowHour }) {
  if (!hours || !hours.length) return null;
  const maxPop = Math.max(10, ...hours.map((h) => h.pop));
  const maxMm = Math.max(0.4, ...hours.map((h) => h.mm));
  const total = hours.reduce((a, h) => a + h.mm, 0);
  return (
    <div className="mt-2 rounded-md bg-slate-50 p-2" data-testid="weather-hourly">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
        <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-sky-700" />Pravděpodobnost srážek během dne</span>
        <span className="tabular-nums">Celkem {total.toFixed(1)} mm</span>
      </div>
      <div className="flex items-end gap-[2px]" style={{ height: 42 }}>
        {hours.map((h) => {
          const ph = Math.max(2, Math.round((h.pop / maxPop) * 36));
          const isNow = h.hour === nowHour;
          return (
            <div key={h.hour} className="flex flex-1 flex-col items-center justify-end" title={`${h.hour}:00 · ${h.pop}% · ${h.mm.toFixed(1)} mm`}>
              <div
                className={`w-full rounded-sm ${h.mm > 0 ? "bg-sky-600" : "bg-sky-300"} ${isNow ? "ring-2 ring-amber-500" : ""}`}
                style={{ height: `${ph}px`, opacity: 0.35 + 0.65 * (h.pop / 100) }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
        {[0, 6, 12, 18, 23].map((h) => <span key={h}>{h}:00</span>)}
      </div>
    </div>
  );
}

export function WeatherWidget({ workplaces = [], preferredWorkplaceId = "" }) {
  const [location, setLocation] = useState(null); // {name, lat, lon}
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(null);
  const [stale, setStale] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  const activeWpWithGps = useMemo(() => {
    const list = (workplaces || []).filter((w) => w.active !== false && w.has_location && w.latitude && w.longitude);
    const preferred = list.find((w) => w.id === preferredWorkplaceId);
    return preferred ? [preferred, ...list.filter((w) => w.id !== preferred.id)] : list;
  }, [workplaces, preferredWorkplaceId]);

  useEffect(() => {
    if (location) return;
    if (activeWpWithGps.length) {
      const w = activeWpWithGps[0];
      setLocation({ name: w.name, lat: w.latitude, lon: w.longitude });
    }
  }, [activeWpWithGps, location]);

  const askDeviceLocation = () => {
    if (!("geolocation" in navigator)) { setError("Prohlížeč nepodporuje geolokaci."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocation({ name: "Moje poloha", lat: p.coords.latitude, lon: p.coords.longitude }); setLoading(false); },
      () => { setLoading(false); setError("Polohu zařízení nelze zjistit – povolte v prohlížeči přístup k poloze."); },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  };

  useEffect(() => {
    if (!location) return;
    const key = `${location.lat.toFixed(3)}:${location.lon.toFixed(3)}`;
    let active = true;
    const cached = readForecastCache(key);
    setData(cached?.payload || null); setLoadedAt(cached?.at || null);
    setStale(!!cached && Date.now() - cached.at > TTL_MS);
    setLoading(true); setError("");
    fetchForecast(location.lat, location.lon)
      .then((payload) => { if (!active) return; setData(payload); writeCache(key, payload); setLoadedAt(Date.now()); setStale(false); })
      .catch((e) => { if (active) setError(e.message || "Chyba načítání počasí."); })
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [location]);
  useEffect(() => {
    const timer = setInterval(() => setStale(!!loadedAt && Date.now() - loadedAt > TTL_MS), 60000);
    return () => clearInterval(timer);
  }, [loadedAt]);

  const days = useMemo(() => data?.daily?.time || [], [data]);
  const hours = useMemo(() => hourlyForDay(data, days[selectedDay]), [data, days, selectedDay]);
  const nowHour = new Date().getHours();

  if (!location) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm" data-testid="weather-widget-empty">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-slate-700"><CloudSun className="h-4 w-4 text-sky-700" />Počasí: žádné pracoviště s GPS</span>
          <button type="button" onClick={askDeviceLocation} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold hover:bg-slate-50" data-testid="weather-use-device">Použít moji polohu</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm" data-testid="weather-widget">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
          <CloudSun className="h-3.5 w-3.5 shrink-0 text-sky-700" />
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate" data-testid="weather-location">{location.name}</span>
        </div>
        {activeWpWithGps.length > 1 && (
          <select data-testid="weather-location-select" value={location.name}
            onChange={(e) => { const w = activeWpWithGps.find((x) => x.name === e.target.value); if (w) setLocation({ name: w.name, lat: w.latitude, lon: w.longitude }); }}
            className="h-7 max-w-[160px] rounded-md border border-slate-300 bg-white px-1 text-[11px]">
            {activeWpWithGps.map((w) => <option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        )}
      </div>
      {loading && !data && <div className="mt-1 flex items-center gap-2 text-xs text-slate-600"><Loader2 className="h-3 w-3 animate-spin" />Načítám…</div>}
      {error && <div role="alert" className="mt-1 rounded border border-rose-200 bg-rose-50 p-1 text-xs text-rose-900">{error}{data ? ' Zobrazuji uloženou předpověď.' : ''}</div>}
      {loadedAt && <p className="mt-1 text-xs text-slate-600">Načteno {new Date(loadedAt).toLocaleString('cs-CZ', {timeZone: 'Europe/Prague'})}{stale ? ' · starší předpověď, aktualizace je potřeba' : ''}</p>}
      {data && <button type="button" onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded} aria-controls="weather-details" data-testid="weather-expand"
        className="mt-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-sky-50 px-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {React.createElement(describe(data.current?.weather_code ?? data.daily.weathercode[0]).icon, { className: "h-5 w-5 text-sky-700" })}
          {describe(data.current?.weather_code ?? data.daily.weathercode[0]).label} · {Math.round(data.current?.temperature_2m ?? data.daily.temperature_2m_max[0])}°
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-700">Předpověď {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>}
      {data && expanded && <div id="weather-details" className="mt-2 space-y-3" data-testid="weather-details">
        <div className="grid grid-cols-4 gap-1" data-testid="weather-days">
          {days.map((d, i) => {
            const { icon: Icon, label } = describe(data.daily.weathercode[i]);
            return <button key={d} type="button" onClick={() => setSelectedDay(i)}
              className={`min-h-16 rounded-lg border p-1 text-center ${i === selectedDay ? "border-sky-700 bg-sky-100" : "border-slate-200 bg-slate-50"}`}
              aria-pressed={selectedDay === i} data-testid={`weather-day-${i}`} title={label}>
              <Icon className="mx-auto h-5 w-5 text-sky-700" />
              <span className="block text-xs font-bold">{labelFor(d, i)}</span>
              <span className="block text-[11px]">{Math.round(data.daily.temperature_2m_max[i])}° / {Math.round(data.daily.temperature_2m_min[i])}°</span>
            </button>;
          })}
        </div>
        <p className="text-sm font-semibold">Hodinová předpověď · {labelFor(days[selectedDay], selectedDay)}</p>
        <div className="flex gap-2 overflow-x-auto pb-2" data-testid="weather-hourly-timeline">
          {hours.map((h) => {
            const { icon: Icon, label } = describe(h.code);
            return <div key={h.hour} className="min-w-[78px] rounded-lg border bg-white p-2 text-center" title={label}>
              <b className="text-xs">{String(h.hour).padStart(2, "0")}:00</b>
              <Icon className="mx-auto my-1 h-5 w-5 text-sky-700" />
              <div className="text-sm font-bold">{h.temp == null ? "–" : h.temp + "°"}</div>
              <div className="text-xs text-sky-700">{h.pop}% déšť</div>
              <div className="text-[11px] text-slate-500">{h.mm.toFixed(1)} mm</div>
            </div>;
          })}
        </div>
        <HourlyChart hours={hours} nowHour={selectedDay === 0 ? nowHour : -1} />
      </div>}
    </div>
  );
}

export default WeatherWidget;
