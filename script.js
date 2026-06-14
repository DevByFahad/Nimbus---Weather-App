// ─────────────────────────────────────────────
//  Nimbus Weather App — app.js
//  API: OpenWeatherMap (free tier)
// ─────────────────────────────────────────────

const API_KEY = 'cae3227763cb101026abd150cb7f9458';
const BASE = 'https://api.openweathermap.org/data/2.5';

let unitC = true;   // true = Celsius, false = Fahrenheit
let cache = null;   // stores last successful fetch

// ── DOM helpers ──────────────────────────────
const $ = id => document.getElementById(id);

// ── Weather emoji map ─────────────────────────
function weatherEmoji(id) {
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 500) return '🌦️';
    if (id >= 500 && id < 600) return '🌧️';
    if (id >= 600 && id < 700) return '❄️';
    if (id >= 700 && id < 800) return '🌫️';
    if (id === 800) return '☀️';
    if (id === 801) return '🌤️';
    return '☁️';
}

// ── Utility functions ─────────────────────────
function windDirLabel(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(v) {
    if (v <= 2) return 'Low';
    if (v <= 5) return 'Moderate';
    if (v <= 7) return 'High';
    if (v <= 10) return 'Very high';
    return 'Extreme';
}

function toF(c) { return Math.round(c * 9 / 5 + 32); }
function T(c) { return unitC ? Math.round(c) + '°' : toF(c) + '°'; }

function fmtTime(ts, offset) {
    const d = new Date((ts + offset) * 1000);
    return d.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC'
    });
}

function fmtHour(ts, offset) {
    const d = new Date((ts + offset) * 1000);
    const h = d.getUTCHours();
    const h12 = h % 12 || 12;
    return h12 + (h >= 12 ? 'PM' : 'AM');
}

function dayName(ts, offset) {
    const d = new Date((ts + offset) * 1000);
    return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

// ── UI state manager ──────────────────────────
function setState(s) {
    $('stateLoading').classList.toggle('visible', s === 'loading');
    $('stateError').classList.toggle('visible', s === 'error');
    $('content').classList.toggle('visible', s === 'content');
}

// ── Render ────────────────────────────────────
function render(data) {
    const { cur, fc, uv } = data;
    const off = cur.timezone;
    const nowTs = Math.floor(Date.now() / 1000);

    // Hero
    $('heroDate').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    $('heroCity').textContent = `${cur.name}, ${cur.sys.country}`;
    $('heroCondition').textContent = cur.weather[0].description;
    $('heroEmoji').textContent = weatherEmoji(cur.weather[0].id);
    $('heroTemp').textContent = T(cur.main.temp);
    $('heroFeels').textContent = `Feels like ${T(cur.main.feels_like)}`;
    $('mHumidity').textContent = cur.main.humidity;
    $('mWind').textContent = Math.round(cur.wind.speed * 3.6);
    $('mVis').textContent = (cur.visibility / 1000).toFixed(1);

    // Stats
    const hum = cur.main.humidity;
    const wkph = Math.round(cur.wind.speed * 3.6);
    const pres = cur.main.pressure;
    const vis = (cur.visibility / 1000).toFixed(1);

    $('sHumidity').innerHTML = `${hum}<sub>%</sub>`;
    $('bHumidity').style.width = hum + '%';

    $('sWind').innerHTML = `${wkph}<sub> km/h</sub>`;
    $('bWind').style.width = Math.min(wkph / 120 * 100, 100) + '%';

    $('sPressure').innerHTML = `${pres}<sub> hPa</sub>`;
    $('bPressure').style.width = Math.min((pres - 950) / 100 * 100, 100) + '%';

    $('sVis').innerHTML = `${vis}<sub> km</sub>`;
    $('bVis').style.width = Math.min(cur.visibility / 10000 * 100, 100) + '%';

    // Hourly (next 12 slots)
    $('hourlyScroll').innerHTML = fc.list.slice(0, 12).map((h, i) => {
        const pop = h.pop ? Math.round(h.pop * 100) : 0;
        return `
      <div class="card hour-card${i === 0 ? ' now' : ''}" role="listitem">
        <div class="hour-time">${i === 0 ? 'Now' : fmtHour(h.dt, off)}</div>
        <span class="hour-emoji" aria-hidden="true">${weatherEmoji(h.weather[0].id)}</span>
        <div class="hour-temp">${T(h.main.temp)}</div>
        ${pop > 0 ? `<div class="hour-pop">💧${pop}%</div>` : ''}
      </div>`;
    }).join('');

    // 5-day forecast
    const days = {};
    fc.list.forEach(item => {
        const d = dayName(item.dt, off);
        if (!days[d]) days[d] = { hi: -999, lo: 999, id: item.weather[0].id };
        days[d].hi = Math.max(days[d].hi, item.main.temp_max);
        days[d].lo = Math.min(days[d].lo, item.main.temp_min);
    });

    const dayKeys = Object.keys(days).slice(0, 5);
    const absHi = Math.max(...dayKeys.map(d => days[d].hi));
    const absLo = Math.min(...dayKeys.map(d => days[d].lo));
    const range = absHi - absLo || 1;

    $('forecastList').innerHTML = dayKeys.map((d, i) => {
        const dd = days[d];
        const left = ((dd.lo - absLo) / range * 80).toFixed(1);
        const width = ((dd.hi - dd.lo) / range * 80).toFixed(1);
        return `
      <div class="fc-row" role="listitem">
        <div class="fc-day-name">${i === 0 ? 'Today' : d}</div>
        <div class="fc-emoji" aria-hidden="true">${weatherEmoji(dd.id)}</div>
        <div class="fc-bar-wrap">
          <div class="fc-bar" style="left:${left}%;width:${width}%"></div>
        </div>
        <div class="fc-lo">${T(dd.lo)}</div>
        <div class="fc-hi">${T(dd.hi)}</div>
      </div>`;
    }).join('');

    // UV Index
    const uvV = uv ? Math.round(uv.value) : 0;
    $('uvNum').textContent = uvV;
    $('uvLbl').textContent = uvLabel(uvV);
    $('uvBar').style.width = Math.min(uvV / 11 * 100, 100) + '%';

    // Sunrise / Sunset
    $('sunriseT').textContent = fmtTime(cur.sys.sunrise, off);
    $('sunsetT').textContent = fmtTime(cur.sys.sunset, off);
    const total = cur.sys.sunset - cur.sys.sunrise;
    const elapsed = Math.max(0, Math.min(nowTs - cur.sys.sunrise, total));
    $('sunProg').style.width = Math.round(elapsed / total * 100) + '%';

    // Wind compass
    const wdeg = cur.wind.deg || 0;
    $('windNeedle').style.transform = `translateX(-50%) rotate(${wdeg}deg)`;
    $('windBig').textContent = `${wkph} km/h`;
    $('windDir').textContent = windDirLabel(wdeg);

    setState('content');
}

// ── Fetch weather data ────────────────────────
async function loadWeather(city) {
    setState('loading');
    try {
        const [cur, fc] = await Promise.all([
            fetch(`${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`).then(r => r.json()),
            fetch(`${BASE}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`).then(r => r.json())
        ]);

        if (cur.cod !== 200) throw new Error(cur.message || 'City not found');

        // UV index (best effort — may fail on free tier)
        let uv = null;
        try {
            uv = await fetch(`${BASE}/uvi?lat=${cur.coord.lat}&lon=${cur.coord.lon}&appid=${API_KEY}`).then(r => r.json());
        } catch (_) { }

        cache = { cur, fc, uv };
        render(cache);
    } catch (err) {
        $('stateErrorMsg').textContent = err.message || 'Something went wrong. Try again.';
        setState('error');
    }
}

// ── Event listeners ───────────────────────────

// Unit toggle
$('btnC').addEventListener('click', () => {
    unitC = true;
    $('btnC').classList.add('active'); $('btnC').setAttribute('aria-pressed', 'true');
    $('btnF').classList.remove('active'); $('btnF').setAttribute('aria-pressed', 'false');
    if (cache) render(cache);
});

$('btnF').addEventListener('click', () => {
    unitC = false;
    $('btnF').classList.add('active'); $('btnF').setAttribute('aria-pressed', 'true');
    $('btnC').classList.remove('active'); $('btnC').setAttribute('aria-pressed', 'false');
    if (cache) render(cache);
});

// Search
function doSearch() {
    const city = $('cityInput').value.trim();
    if (city) {
        loadWeather(city);
        $('cityInput').value = '';
    }
}

$('searchBtn').addEventListener('click', doSearch);
$('cityInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
});

// ── Boot ──────────────────────────────────────
loadWeather('Karachi');
