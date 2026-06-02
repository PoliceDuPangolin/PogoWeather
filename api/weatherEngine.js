import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POKEMON_LIST_PATH = path.join(
  __dirname,
  "..",
  "data",
  "pokemon-list.json",
);

const VISUAL_CROSSING_API_KEY = process.env.VISUAL_CROSSING_API_KEY || "";

const DEFAULT_CITIES = [
  { name: "Tokyo - Shibuya", country: "Japon", lat: 35.6595, lon: 139.7006 },
  {
    name: "New York - Central Park",
    country: "États-Unis",
    lat: 40.7851,
    lon: -73.9683,
  },
  {
    name: "San Francisco - Pier 39",
    country: "États-Unis",
    lat: 37.8086,
    lon: -122.4098,
  },
  {
    name: "Honolulu - Ala Moana",
    country: "États-Unis",
    lat: 21.291,
    lon: -157.844,
  },
  {
    name: "Sydney - Circular Quay",
    country: "Australie",
    lat: -33.861,
    lon: 151.2128,
  },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "London", country: "Royaume-Uni", lat: 51.5072, lon: -0.1276 },
  { name: "Zaragoza", country: "Espagne", lat: 41.6611, lon: -0.8938 },
  {
    name: "Dubai Marina",
    country: "Émirats arabes unis",
    lat: 25.0763,
    lon: 55.1324,
  },
  {
    name: "Taipei Main Station",
    country: "Taïwan",
    lat: 25.0478,
    lon: 121.517,
  },
  { name: "Singapore", country: "Singapour", lat: 1.3521, lon: 103.8198 },
  { name: "Seoul", country: "Corée du Sud", lat: 37.5665, lon: 126.978 },
  { name: "Bangkok", country: "Thaïlande", lat: 13.7563, lon: 100.5018 },
  { name: "São Paulo", country: "Brésil", lat: -23.5558, lon: -46.6396 },
  { name: "Mexico City", country: "Mexique", lat: 19.4326, lon: -99.1332 },
];

const TYPE_TO_WEATHER = {
  normal: ["Partly Cloudy"],
  fire: ["Clear"],
  water: ["Rainy"],
  electric: ["Rainy"],
  grass: ["Clear"],
  ice: ["Snow"],
  fighting: ["Cloudy"],
  poison: ["Cloudy"],
  ground: ["Clear"],
  flying: ["Windy"],
  psychic: ["Windy"],
  bug: ["Rainy"],
  rock: ["Partly Cloudy"],
  ghost: ["Fog"],
  dragon: ["Windy"],
  dark: ["Fog"],
  steel: ["Snow"],
  fairy: ["Cloudy"],
};

const TYPE_FR = {
  normal: "Normal",
  fire: "Feu",
  water: "Eau",
  electric: "Électrik",
  grass: "Plante",
  ice: "Glace",
  fighting: "Combat",
  poison: "Poison",
  ground: "Sol",
  flying: "Vol",
  psychic: "Psy",
  bug: "Insecte",
  rock: "Roche",
  ghost: "Spectre",
  dragon: "Dragon",
  dark: "Ténèbres",
  steel: "Acier",
  fairy: "Fée",
};

const WEATHER_FR = {
  Clear: "Ensoleillé / clair",
  "Partly Cloudy": "Partiellement nuageux",
  Cloudy: "Nuageux",
  Rainy: "Pluvieux",
  Snow: "Neige",
  Windy: "Venteux",
  Fog: "Brouillard",
};

const weatherCache = new Map();
const pokemonCache = new Map();

let speciesListCache = null;

const WEATHER_CACHE_TTL_MS = 58 * 60 * 1000;
const POKEMON_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheGet(cache, key) {
  const item = cache.get(key);

  if (!item) return null;

  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }

  return item.value;
}

function cacheSet(cache, key, value, ttl) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl,
  });
}

export function addCustomCityValidation(city) {
  if (!city || typeof city !== "object") return null;

  const name = String(city.name || "")
    .trim()
    .slice(0, 60);
  const country = String(city.country || "Personnalisé")
    .trim()
    .slice(0, 60);

  const lat = Number(city.lat);
  const lon = Number(city.lon);

  if (!name || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  return {
    name,
    country,
    lat,
    lon,
    custom: true,
  };
}

export async function getPokemonSuggestions(query) {
  const q = normalizeText(query);

  if (q.length < 2) return [];

  const list = await getPokemonSpeciesList();

  return list
    .filter(
      (p) =>
        normalizeText(p.name).includes(q) ||
        normalizeText(p.frName).includes(q),
    )
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      frName: p.frName,
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`,
    }));
}

export async function searchWeatherBoost({
  pokemonName,
  customCities,
  preciseMode,
  previousDayMode,
}) {
  const pokemon = await getPokemonData(pokemonName);

  const targetWeathers = [
    ...new Set(pokemon.types.flatMap((type) => TYPE_TO_WEATHER[type] || [])),
  ];

  const cities = [...DEFAULT_CITIES, ...customCities].slice(0, 35);

  const cityResults = [];

  const batchSize = preciseMode ? 2 : 4;

  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);

    const partial = await Promise.all(
      batch.map((city) =>
        analyzeCity({
          city,
          targetWeathers,
          preciseMode,
          previousDayMode,
        }),
      ),
    );

    cityResults.push(...partial);
  }

  cityResults.sort((a, b) => {
    if (b.isBoosted !== a.isBoosted) {
      return Number(b.isBoosted) - Number(a.isBoosted);
    }

    return b.confidence - a.confidence;
  });

  return {
    pokemon: {
      ...pokemon,
      typesFr: pokemon.types.map((t) => TYPE_FR[t] || t),
    },
    targetWeathers,
    targetWeathersFr: targetWeathers.map((w) => WEATHER_FR[w] || w),
    cities: cityResults,
    generatedAt: new Date().toISOString(),
    mode: {
      preciseMode,
      previousDayMode,
    },
  };
}

async function getPokemonData(rawName) {
  const normalizedName = normalizeText(rawName);

  const cached = cacheGet(pokemonCache, normalizedName);

  if (cached) return cached;

  const list = await getPokemonSpeciesList();

  const match =
    list.find((p) => normalizeText(p.frName) === normalizedName) ||
    list.find((p) => normalizeText(p.name) === normalizedName) ||
    list.find((p) => normalizeText(p.frName).includes(normalizedName)) ||
    list.find((p) => normalizeText(p.name).includes(normalizedName));

  if (!match) {
    throw new Error("Pokémon introuvable.");
  }

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${match.id}`);

  if (!res.ok) {
    throw new Error("Impossible de récupérer les types.");
  }

  const data = await res.json();

  const pokemon = {
    id: match.id,
    name: match.name,
    frName: match.frName,
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${match.id}.png`,
    types: data.types.map((t) => t.type.name),
  };

  cacheSet(pokemonCache, normalizedName, pokemon, POKEMON_CACHE_TTL_MS);

  return pokemon;
}

async function getPokemonSpeciesList() {
  if (speciesListCache) return speciesListCache;

  const raw = fs.readFileSync(POKEMON_LIST_PATH, "utf-8");

  speciesListCache = JSON.parse(raw);

  return speciesListCache;
}

async function analyzeCity({
  city,
  targetWeathers,
  preciseMode,
  previousDayMode,
}) {
  const points = preciseMode
    ? createCityGrid(city)
    : [{ ...city, zone: "centre" }];

  const pointResults = [];

  for (const point of points) {
    const meteoPack = await fetchWeatherPack(
      point.lat,
      point.lon,
      previousDayMode,
    );

    const decision = estimateHybridPokemonWeather(meteoPack);

    const pogoWeather =
      typeof decision === "string" ? decision : decision.weather;

    const decisionReason =
      typeof decision === "string" ? "legacy decision" : decision.reason;

    pointResults.push({
      zone: point.zone || "centre",
      lat: point.lat,
      lon: point.lon,
      meteoPublic: {
        ...sanitizeMeteo(meteoPack.primary),
        decisionReason,
        current: meteoPack.current ? sanitizeMeteo(meteoPack.current) : null,
        previous: meteoPack.previous ? sanitizeMeteo(meteoPack.previous) : null,
      },
      pogoWeather,
      pogoWeatherFr: WEATHER_FR[pogoWeather] || pogoWeather,
      isTarget: targetWeathers.includes(pogoWeather),
    });
  }

  const vote = voteWeather(pointResults);

  const targetVotes = pointResults.filter((p) => p.isTarget).length;
  const totalPoints = pointResults.length;
  const confidence = Math.round((targetVotes / totalPoints) * 100);

  const dominantWeather = vote.weather;

  return {
    name: city.name,
    country: city.country,
    lat: city.lat,
    lon: city.lon,
    dominantWeather,
    dominantWeatherFr: WEATHER_FR[dominantWeather] || dominantWeather,
    confidence,
    targetVotes,
    totalPoints,
    isBoosted: targetVotes > 0,
    points: pointResults,
  };
}

function sanitizeMeteo(meteo) {
  const window = meteo.window || {};

  return {
    source: meteo.source,
    time: meteo.time,
    weatherCode: meteo.weather_code,
    windSpeed: Math.round(Number(meteo.wind_speed_10m || 0)),
    windWindowMax: Math.round(
      Number(window.windMax ?? meteo.wind_speed_10m ?? 0),
    ),
    cloudCover: Math.round(Number(meteo.cloud_cover || 0)),
    cloudWindowAvg: Math.round(
      Number(window.cloudAvg ?? meteo.cloud_cover ?? 0),
    ),
    precipitation: Number(meteo.precipitation || meteo.rain || 0).toFixed(1),
    rainWindowMax: Number(
      window.rainMax ?? meteo.precipitation ?? meteo.rain ?? 0,
    ).toFixed(1),
  };
}

function createCityGrid(city) {
  const km = 15;

  const latOffset = km / 111;

  const lonOffset = km / (111 * Math.cos((city.lat * Math.PI) / 180));

  return [
    { ...city, zone: "centre" },
    {
      ...city,
      lat: city.lat + latOffset,
      zone: "nord",
    },
    {
      ...city,
      lat: city.lat - latOffset,
      zone: "sud",
    },
    {
      ...city,
      lon: city.lon + lonOffset,
      zone: "est",
    },
    {
      ...city,
      lon: city.lon - lonOffset,
      zone: "ouest",
    },
  ];
}

async function fetchWeatherPack(lat, lon, previousDayMode) {
  const current = await fetchCurrentForecast(lat, lon);

  let previous = null;

  if (previousDayMode) {
    try {
      previous = await fetchPreviousDayForecast(lat, lon);
    } catch {
      previous = null;
    }
  }

  return {
    primary: previous || current,
    previous,
    current,
  };
}

async function fetchPreviousDayForecast(lat, lon) {
  const currentHourKey = new Date().toISOString().slice(0, 13);

  const cacheKey = `${roundCoord(lat)}_${roundCoord(
    lon,
  )}_previous_day1_${currentHourKey}`;

  const cached = cacheGet(weatherCache, cacheKey);

  if (cached) return cached;

  const variables = [
    "weather_code_previous_day1",
    "precipitation_previous_day1",
    "rain_previous_day1",
    "snowfall_previous_day1",
    "cloud_cover_previous_day1",
    "wind_speed_10m_previous_day1",
  ].join(",");

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "GMT",
    forecast_days: "1",
    hourly: variables,
  });

  const res = await fetch(
    `https://previous-runs-api.open-meteo.com/v1/forecast?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error("Previous Runs indisponible.");
  }

  const data = await res.json();

  const meteo = pickPreviousDayHourlyData(data.hourly);

  cacheSet(weatherCache, cacheKey, meteo, WEATHER_CACHE_TTL_MS);

  return meteo;
}

async function fetchCurrentForecast(lat, lon) {
  const currentHourKey = new Date().toISOString().slice(0, 13);

  const cacheKey = `${roundCoord(lat)}_${roundCoord(
    lon,
  )}_current_${currentHourKey}`;

  const cached = cacheGet(weatherCache, cacheKey);

  if (cached) return cached;

  const variables = [
    "weather_code",
    "precipitation",
    "rain",
    "snowfall",
    "cloud_cover",
    "wind_speed_10m",
    "visibility",
  ].join(",");

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "GMT",
    forecast_days: "1",
    hourly: variables,
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );

  if (!res.ok) {
    throw new Error("Erreur météo.");
  }

  const data = await res.json();

  let meteo = pickCurrentHourlyData(data.hourly);

  // VISUAL CROSSING FALLBACK
  if (
    VISUAL_CROSSING_API_KEY &&
    meteo.cloud_cover >= 90 &&
    meteo.rain < 0.2 &&
    meteo.wind_speed_10m < 15
  ) {
    try {
      const vc = await fetchVisualCrossingWeather(lat, lon);

      if (vc) {
        meteo = vc;
      }
    } catch (e) {
      console.error("Visual Crossing fallback error", e);
    }
  }

  cacheSet(weatherCache, cacheKey, meteo, WEATHER_CACHE_TTL_MS);

  return meteo;
}

async function fetchVisualCrossingWeather(lat, lon) {
  const cacheKey = `${roundCoord(lat)}_${roundCoord(lon)}_visual_crossing`;

  const cached = cacheGet(weatherCache, cacheKey);

  if (cached) return cached;

  const url =
    `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/` +
    `${lat},${lon}/today?unitGroup=metric&include=current&key=${VISUAL_CROSSING_API_KEY}&contentType=json`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error("Visual Crossing error");
  }

  const data = await res.json();

  const current = data.currentConditions || {};

  const cloudCover = Number(current.cloudcover || 0);

  const wind = Number(current.windspeed || 0);

  const precip = Number(current.precip || 0);

  let weatherCode = 0;

  if (cloudCover >= 85) {
    weatherCode = 3;
  } else if (cloudCover >= 45) {
    weatherCode = 2;
  } else if (cloudCover >= 20) {
    weatherCode = 1;
  }

  if (precip >= 0.5) {
    weatherCode = 61;
  }

  const result = {
    source: "Visual Crossing",
    time: current.datetime || new Date().toISOString(),
    weather_code: weatherCode,
    precipitation: precip,
    rain: precip,
    snowfall: 0,
    cloud_cover: cloudCover,
    wind_speed_10m: wind,
    visibility: 99999,
  };

  cacheSet(weatherCache, cacheKey, result, WEATHER_CACHE_TTL_MS);

  return result;
}

function pickPreviousDayHourlyData(hourly) {
  const index = findCurrentHourIndex(hourly.time);
  const windowIndexes = getWindowIndexes(hourly.time, index);

  return {
    source: "Previous-day forecast",
    time: hourly.time[index],
    weather_code: hourly.weather_code_previous_day1[index],
    precipitation: hourly.precipitation_previous_day1[index],
    rain: hourly.rain_previous_day1[index],
    snowfall: hourly.snowfall_previous_day1[index],
    cloud_cover: hourly.cloud_cover_previous_day1[index],
    wind_speed_10m: hourly.wind_speed_10m_previous_day1[index],
    visibility: 99999,

    window: buildWeatherWindow({
      times: hourly.time,
      indexes: windowIndexes,
      weatherCode: hourly.weather_code_previous_day1,
      precipitation: hourly.precipitation_previous_day1,
      rain: hourly.rain_previous_day1,
      snowfall: hourly.snowfall_previous_day1,
      cloudCover: hourly.cloud_cover_previous_day1,
      windSpeed: hourly.wind_speed_10m_previous_day1,
      visibility: null,
    }),
  };
}

function pickCurrentHourlyData(hourly) {
  const index = findCurrentHourIndex(hourly.time);
  const windowIndexes = getWindowIndexes(hourly.time, index);

  return {
    source: "Current forecast",
    time: hourly.time[index],
    weather_code: hourly.weather_code[index],
    precipitation: hourly.precipitation[index],
    rain: hourly.rain[index],
    snowfall: hourly.snowfall[index],
    cloud_cover: hourly.cloud_cover[index],
    wind_speed_10m: hourly.wind_speed_10m[index],
    visibility: hourly.visibility ? hourly.visibility[index] : 99999,

    window: buildWeatherWindow({
      times: hourly.time,
      indexes: windowIndexes,
      weatherCode: hourly.weather_code,
      precipitation: hourly.precipitation,
      rain: hourly.rain,
      snowfall: hourly.snowfall,
      cloudCover: hourly.cloud_cover,
      windSpeed: hourly.wind_speed_10m,
      visibility: hourly.visibility || null,
    }),
  };
}

function findCurrentHourIndex(times) {
  const currentHourKey = new Date().toISOString().slice(0, 13);

  const exactIndex = times.findIndex((time) =>
    String(time).slice(0, 13) === currentHourKey
  );

  if (exactIndex !== -1) {
    return exactIndex;
  }

  let bestIndex = 0;
  let bestDiff = Infinity;

  times.forEach((time, index) => {
    const diff = Math.abs(
      new Date(`${time}:00Z`) - new Date(`${currentHourKey}:00Z`)
    );

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function getWindowIndexes(times, centerIndex) {
  const indexes = [];

  for (const offset of [-1, 0, 1, 2]) {
    const idx = centerIndex + offset;

    if (idx >= 0 && idx < times.length) {
      indexes.push(idx);
    }
  }

  return indexes;
}

function buildWeatherWindow({
  times,
  indexes,
  weatherCode,
  precipitation,
  rain,
  snowfall,
  cloudCover,
  windSpeed,
  visibility,
}) {
  const values = indexes.map((idx) => {
    const code = Number(weatherCode?.[idx] ?? 0);

    return {
      time: times?.[idx],
      code,
      precipitation: Number(precipitation?.[idx] || 0),
      rain: Number(rain?.[idx] || precipitation?.[idx] || 0),
      snowfall: Number(snowfall?.[idx] || 0),
      cloudCover: Number(cloudCover?.[idx] || 0),
      windSpeed: Number(windSpeed?.[idx] || 0),
      visibility: visibility ? Number(visibility?.[idx] || 99999) : 99999,
    };
  });

  const windMax = max(values.map((v) => v.windSpeed));
  const rainMax = max(values.map((v) => Math.max(v.rain, v.precipitation)));
  const snowMax = max(values.map((v) => v.snowfall));
  const cloudAvg = average(values.map((v) => v.cloudCover));
  const cloudMax = max(values.map((v) => v.cloudCover));
  const visibilityMin = min(values.map((v) => v.visibility));

  return {
    values,
    windMax,
    rainMax,
    snowMax,
    cloudAvg,
    cloudMax,
    visibilityMin,
    hasRainCode: values.some((v) =>
      [61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(v.code),
    ),
    hasSnowCode: values.some((v) => [71, 73, 75, 77, 85, 86].includes(v.code)),
    hasFogCode: values.some(
      (v) => [45, 48].includes(v.code) || v.visibility < 1000,
    ),
  };
}

function max(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? Math.max(...clean) : 0;
}

function min(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? Math.min(...clean) : 99999;
}

function average(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function estimatePokemonWeather(w) {
  const code = Number(w.weather_code);
  const wind = Number(w.wind_speed_10m || 0);
  const rain = Number(w.rain || 0);
  const snow = Number(w.snowfall || 0);
  const precip = Number(w.precipitation || 0);
  const clouds = Number(w.cloud_cover || 0);
  const visibility = Number(w.visibility || 99999);

  const window = w.window || {};
  const windWindowMax = Number(window.windMax ?? wind);
  const rainWindowMax = Number(window.rainMax ?? Math.max(rain, precip));
  const snowWindowMax = Number(window.snowMax ?? snow);
  const cloudWindowAvg = Number(window.cloudAvg ?? clouds);
  const hasRainCode = Boolean(window.hasRainCode);
  const hasSnowCode = Boolean(window.hasSnowCode);
  const hasFogCode = Boolean(window.hasFogCode);

  if (
    snowWindowMax >= 0.2 ||
    hasSnowCode ||
    [71, 73, 75, 77, 85, 86].includes(code)
  ) {
    return "Snow";
  }

  const realRain =
    rainWindowMax >= 1.0 ||
    (hasRainCode && rainWindowMax >= 0.5) ||
    ([61, 63, 65, 80, 81, 82].includes(code) && Math.max(rain, precip) >= 0.6);

  const realThunderstorm =
    [95, 96, 99].includes(code) && Math.max(rain, precip, rainWindowMax) >= 0.5;

  if (realRain || realThunderstorm) {
    return "Rainy";
  }

  if (hasFogCode || [45, 48].includes(code) || visibility < 1000) {
    return "Fog";
  }

  // Important: this is the generic estimator.
  // The hybrid estimator below gives previous-day forecast extra priority for Windy.
  if (windWindowMax >= 28) {
    return "Windy";
  }

  // Recalibrated cloud logic:
  // Pokémon GO Cloudy seems to trigger before "fully overcast" in some cities,
  // so we do not wait for 90-100% clouds.
  if (clouds >= 75 || cloudWindowAvg >= 78 || (code === 3 && clouds >= 70)) {
    return "Cloudy";
  }

  if (
    clouds >= 25 ||
    cloudWindowAvg >= 30 ||
    code === 1 ||
    code === 2 ||
    code === 3
  ) {
    return "Partly Cloudy";
  }

  return "Clear";
}

function estimateHybridPokemonWeather(pack) {
  const previous = pack.previous;
  const current = pack.current;

  const previousWeather = previous ? estimatePokemonWeather(previous) : null;
  const currentWeather = estimatePokemonWeather(current);

  if (!previousWeather) {
    return {
      weather: currentWeather,
      reason: "current forecast only",
    };
  }

  const previousWindow = previous.window || {};
  const currentWindow = current.window || {};

  const previousWindMax = Number(
    previousWindow.windMax ?? previous.wind_speed_10m ?? 0,
  );
  const currentWindMax = Number(
    currentWindow.windMax ?? current.wind_speed_10m ?? 0,
  );

  const previousRainMax = Number(
    previousWindow.rainMax ??
      Math.max(previous.rain || 0, previous.precipitation || 0),
  );
  const currentRainMax = Number(
    currentWindow.rainMax ??
      Math.max(current.rain || 0, current.precipitation || 0),
  );

  const previousSnowMax = Number(
    previousWindow.snowMax ?? previous.snowfall ?? 0,
  );
  const currentSnowMax = Number(currentWindow.snowMax ?? current.snowfall ?? 0);

  const currentClouds = Number(current.cloud_cover || 0);
  const currentCode = Number(current.weather_code);
  const currentVisibility = Number(current.visibility || 99999);

  if (previousWindMax >= 21) {
    return {
      weather: "Windy",
      reason: `previous wind window >= 21 km/h (${Math.round(previousWindMax)} km/h)`,
    };
  }

  if (currentWindMax >= 28) {
    return {
      weather: "Windy",
      reason: `current wind window >= 28 km/h (${Math.round(currentWindMax)} km/h)`,
    };
  }

  if (
    previousSnowMax >= 0.2 ||
    currentSnowMax >= 0.2 ||
    previousWindow.hasSnowCode ||
    currentWindow.hasSnowCode
  ) {
    return {
      weather: "Snow",
      reason: "snow detected in forecast window",
    };
  }

  if (
    previousRainMax >= 1.0 ||
    currentRainMax >= 1.0 ||
    (previousWindow.hasRainCode && previousRainMax >= 0.5) ||
    (currentWindow.hasRainCode && currentRainMax >= 0.5)
  ) {
    return {
      weather: "Rainy",
      reason: `rain threshold reached, current ${currentRainMax.toFixed(1)} mm / previous ${previousRainMax.toFixed(1)} mm`,
    };
  }

  if (
    previousWindow.hasFogCode ||
    currentWindow.hasFogCode ||
    [45, 48].includes(currentCode) ||
    currentVisibility < 1000
  ) {
    return {
      weather: "Fog",
      reason: "fog code or low visibility detected",
    };
  }

  if (currentWeather === "Cloudy") {
    return {
      weather: "Cloudy",
      reason: `current forecast cloudy, clouds ${Math.round(currentClouds)}%, code ${currentCode}`,
    };
  }

  if (
    previousWeather === "Cloudy" &&
    ["Clear", "Partly Cloudy"].includes(currentWeather)
  ) {
    if (currentClouds >= 75 || currentCode === 3) {
      return {
        weather: "Cloudy",
        reason: `previous cloudy kept because current clouds are high, ${Math.round(currentClouds)}%`,
      };
    }

    if (currentClouds >= 25) {
      return {
        weather: "Partly Cloudy",
        reason: `current forecast partly cloudy, clouds ${Math.round(currentClouds)}%`,
      };
    }

    return {
      weather: "Clear",
      reason: `current forecast clear, clouds ${Math.round(currentClouds)}%`,
    };
  }

  return {
    weather: previousWeather,
    reason: `previous forecast selected: ${previousWeather}`,
  };
}

function voteWeather(pointResults) {
  const counts = {};

  for (const p of pointResults) {
    counts[p.pogoWeather] = (counts[p.pogoWeather] || 0) + 1;
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return {
    weather: sorted[0]?.[0] || "Unknown",
    count: sorted[0]?.[1] || 0,
  };
}

function normalizeText(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function roundCoord(value) {
  return Number(value).toFixed(3);
}
