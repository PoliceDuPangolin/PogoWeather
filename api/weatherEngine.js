import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POKEMON_LIST_PATH = path.join(__dirname, "..", "data", "pokemon-list.json");

const DEFAULT_CITIES = [
  { name: "Tokyo - Shibuya", country: "Japon", lat: 35.6595, lon: 139.7006 },
  { name: "New York - Central Park", country: "États-Unis", lat: 40.7851, lon: -73.9683 },
  { name: "San Francisco - Pier 39", country: "États-Unis", lat: 37.8086, lon: -122.4098 },
  { name: "Honolulu - Ala Moana", country: "États-Unis", lat: 21.2910, lon: -157.8440 },
  { name: "Sydney - Circular Quay", country: "Australie", lat: -33.8610, lon: 151.2128 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "London", country: "Royaume-Uni", lat: 51.5072, lon: -0.1276 },
  { name: "Zaragoza", country: "Espagne", lat: 41.6611, lon: -0.8938 },
  { name: "Dubai Marina", country: "Émirats arabes unis", lat: 25.0763, lon: 55.1324 },
  { name: "Taipei Main Station", country: "Taïwan", lat: 25.0478, lon: 121.5170 },
  { name: "Singapore", country: "Singapour", lat: 1.3521, lon: 103.8198 },
  { name: "Seoul", country: "Corée du Sud", lat: 37.5665, lon: 126.9780 },
  { name: "Bangkok", country: "Thaïlande", lat: 13.7563, lon: 100.5018 },
  { name: "São Paulo", country: "Brésil", lat: -23.5558, lon: -46.6396 },
  { name: "Mexico City", country: "Mexique", lat: 19.4326, lon: -99.1332 }
];

const TYPE_TO_WEATHER = {
  normal: ["Partly Cloudy"], fire: ["Clear"], water: ["Rainy"], electric: ["Rainy"],
  grass: ["Clear"], ice: ["Snow"], fighting: ["Cloudy"], poison: ["Cloudy"],
  ground: ["Clear"], flying: ["Windy"], psychic: ["Windy"], bug: ["Rainy"],
  rock: ["Partly Cloudy"], ghost: ["Fog"], dragon: ["Windy"], dark: ["Fog"],
  steel: ["Snow"], fairy: ["Cloudy"]
};

const TYPE_FR = {
  normal: "Normal", fire: "Feu", water: "Eau", electric: "Électrik",
  grass: "Plante", ice: "Glace", fighting: "Combat", poison: "Poison",
  ground: "Sol", flying: "Vol", psychic: "Psy", bug: "Insecte",
  rock: "Roche", ghost: "Spectre", dragon: "Dragon", dark: "Ténèbres",
  steel: "Acier", fairy: "Fée"
};

const WEATHER_FR = {
  Clear: "Ensoleillé / clair",
  "Partly Cloudy": "Partiellement nuageux",
  Cloudy: "Nuageux",
  Rainy: "Pluvieux",
  Snow: "Neige",
  Windy: "Venteux",
  Fog: "Brouillard"
};

const weatherCache = new Map();
const pokemonCache = new Map();
let speciesListCache = null;
let speciesListPromise = null;

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
  cache.set(key, { value, expiresAt: Date.now() + ttl });
}

export function addCustomCityValidation(city) {
  if (!city || typeof city !== "object") return null;
  const name = String(city.name || "").trim().slice(0, 60);
  const country = String(city.country || "Personnalisé").trim().slice(0, 60);
  const lat = Number(city.lat);
  const lon = Number(city.lon);
  if (!name || Number.isNaN(lat) || Number.isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { name, country, lat, lon, custom: true };
}

export async function getPokemonSuggestions(query) {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const list = await getPokemonSpeciesList();
  return list
    .filter(p => normalizeText(p.name).includes(q) || normalizeText(p.frName).includes(q))
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      name: p.name,
      frName: p.frName,
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`
    }));
}

export async function searchWeatherBoost({ pokemonName, customCities, preciseMode, previousDayMode }) {
  const pokemon = await getPokemonData(pokemonName);
  const targetWeathers = [...new Set(pokemon.types.flatMap(type => TYPE_TO_WEATHER[type] || []))];

  const cities = [...DEFAULT_CITIES, ...customCities].slice(0, 35);
  const cityResults = [];

  // Concurrence contrôlée pour éviter le spam météo.
  const batchSize = preciseMode ? 2 : 4;
  for (let i = 0; i < cities.length; i += batchSize) {
    const batch = cities.slice(i, i + batchSize);
    const partial = await Promise.all(batch.map(city => analyzeCity({ city, targetWeathers, preciseMode, previousDayMode })));
    cityResults.push(...partial);
  }

  cityResults.sort((a, b) => {
    if (b.isBoosted !== a.isBoosted) return Number(b.isBoosted) - Number(a.isBoosted);
    return b.confidence - a.confidence;
  });

  return {
    pokemon: { ...pokemon, typesFr: pokemon.types.map(t => TYPE_FR[t] || t) },
    targetWeathers,
    targetWeathersFr: targetWeathers.map(w => WEATHER_FR[w] || w),
    cities: cityResults,
    generatedAt: new Date().toISOString(),
    mode: { preciseMode, previousDayMode }
  };
}

async function getPokemonData(rawName) {
  const normalizedName = normalizeText(rawName);
  const cached = cacheGet(pokemonCache, normalizedName);
  if (cached) return cached;

  const list = await getPokemonSpeciesList();
  const match =
    list.find(p => normalizeText(p.frName) === normalizedName) ||
    list.find(p => normalizeText(p.name) === normalizedName) ||
    list.find(p => normalizeText(p.frName).includes(normalizedName)) ||
    list.find(p => normalizeText(p.name).includes(normalizedName));

  if (!match) throw new Error("Pokémon introuvable.");

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${match.id}`);
  if (!res.ok) throw new Error("Impossible de récupérer les types du Pokémon.");
  const data = await res.json();

  const pokemon = {
    id: match.id,
    name: match.name,
    frName: match.frName,
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${match.id}.png`,
    types: data.types.map(t => t.type.name)
  };

  cacheSet(pokemonCache, normalizedName, pokemon, POKEMON_CACHE_TTL_MS);
  cacheSet(pokemonCache, match.name, pokemon, POKEMON_CACHE_TTL_MS);
  cacheSet(pokemonCache, normalizeText(match.frName), pokemon, POKEMON_CACHE_TTL_MS);
  return pokemon;
}

async function getPokemonSpeciesList() {
  if (speciesListCache) return speciesListCache;

  const raw = fs.readFileSync(POKEMON_LIST_PATH, "utf-8");
  speciesListCache = JSON.parse(raw);

  return speciesListCache;
}

async function analyzeCity({ city, targetWeathers, preciseMode, previousDayMode }) {
  const points = preciseMode ? createCityGrid(city) : [{ ...city, zone: "centre" }];
  const pointResults = [];

  for (const point of points) {
    const meteoPack = await fetchWeatherPack(point.lat, point.lon, previousDayMode);
    const pogoWeather = estimateHybridPokemonWeather(meteoPack);
    pointResults.push({
      zone: point.zone || "centre",
      lat: point.lat,
      lon: point.lon,
      meteoPublic: sanitizeMeteo(meteoPack.primary),
      pogoWeather,
      pogoWeatherFr: WEATHER_FR[pogoWeather] || pogoWeather,
      isTarget: targetWeathers.includes(pogoWeather)
    });
  }

  const vote = voteWeather(pointResults);
  const targetVotes = pointResults.filter(p => p.isTarget).length;
  const confidence = Math.round((targetVotes / pointResults.length) * 100);

  return {
    name: city.name,
    country: city.country,
    lat: city.lat,
    lon: city.lon,
    dominantWeather: vote.weather,
    dominantWeatherFr: WEATHER_FR[vote.weather] || vote.weather,
    isBoosted: targetVotes > 0,
    confidence,
    targetVotes,
    totalPoints: pointResults.length,
    points: pointResults
  };
}

function sanitizeMeteo(meteo) {
  return {
    source: meteo.source,
    time: meteo.time,
    windSpeed: Math.round(Number(meteo.wind_speed_10m || 0)),
    cloudCover: Math.round(Number(meteo.cloud_cover || 0)),
    precipitation: Number(meteo.precipitation || meteo.rain || 0).toFixed(1)
  };
}

function createCityGrid(city) {
  const km = 15;
  const latOffset = km / 111;
  const lonOffset = km / (111 * Math.cos(city.lat * Math.PI / 180));
  return [
    { ...city, zone: "centre" },
    { ...city, lat: city.lat + latOffset, zone: "nord" },
    { ...city, lat: city.lat - latOffset, zone: "sud" },
    { ...city, lon: city.lon + lonOffset, zone: "est" },
    { ...city, lon: city.lon - lonOffset, zone: "ouest" }
  ];
}

async function fetchWeather(lat, lon, previousDayMode) {
  if (previousDayMode) {
    try { return await fetchPreviousDayForecast(lat, lon); }
    catch { return fetchCurrentForecast(lat, lon); }
  }
  return fetchCurrentForecast(lat, lon);
}

async function fetchPreviousDayForecast(lat, lon) {
  const currentHourKey = new Date().toISOString().slice(0, 13);
  const cacheKey = `${roundCoord(lat)}_${roundCoord(lon)}_previous_day1_${currentHourKey}`;
  const cached = cacheGet(weatherCache, cacheKey);
  if (cached) return cached;

  const variables = [
    "weather_code_previous_day1",
    "precipitation_previous_day1",
    "rain_previous_day1",
    "snowfall_previous_day1",
    "cloud_cover_previous_day1",
    "wind_speed_10m_previous_day1"
  ].join(",");

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    forecast_days: "1",
    hourly: variables
  });

  const res = await fetch(`https://previous-runs-api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error("Previous Runs indisponible.");
  const data = await res.json();
  const meteo = pickPreviousDayHourlyData(data.hourly);
  cacheSet(weatherCache, cacheKey, meteo, WEATHER_CACHE_TTL_MS);
  return meteo;
}

async function fetchCurrentForecast(lat, lon) {
  const currentHourKey = new Date().toISOString().slice(0, 13);
  const cacheKey = `${roundCoord(lat)}_${roundCoord(lon)}_current_${currentHourKey}`;
  const cached = cacheGet(weatherCache, cacheKey);
  if (cached) return cached;

  const variables = ["weather_code", "precipitation", "rain", "snowfall", "cloud_cover", "wind_speed_10m", "visibility"].join(",");
  const params = new URLSearchParams({ latitude: lat, longitude: lon, timezone: "auto", forecast_days: "1", hourly: variables });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!res.ok) throw new Error("Erreur météo.");
  const data = await res.json();
  const meteo = pickCurrentHourlyData(data.hourly);
  cacheSet(weatherCache, cacheKey, meteo, WEATHER_CACHE_TTL_MS);
  return meteo;
}

function pickPreviousDayHourlyData(hourly) {
  const index = findCurrentHourIndex(hourly.time);
  return {
    source: "Prévision d’hier",
    time: hourly.time[index],
    weather_code: hourly.weather_code_previous_day1[index],
    precipitation: hourly.precipitation_previous_day1[index],
    rain: hourly.rain_previous_day1[index],
    snowfall: hourly.snowfall_previous_day1[index],
    cloud_cover: hourly.cloud_cover_previous_day1[index],
    wind_speed_10m: hourly.wind_speed_10m_previous_day1[index],
    visibility: 99999
  };
}

function pickCurrentHourlyData(hourly) {
  const index = findCurrentHourIndex(hourly.time);
  return {
    source: "Prévision actuelle",
    time: hourly.time[index],
    weather_code: hourly.weather_code[index],
    precipitation: hourly.precipitation[index],
    rain: hourly.rain[index],
    snowfall: hourly.snowfall[index],
    cloud_cover: hourly.cloud_cover[index],
    wind_speed_10m: hourly.wind_speed_10m[index],
    visibility: hourly.visibility ? hourly.visibility[index] : 99999
  };
}

function findCurrentHourIndex(times) {
  const now = new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);
  let bestIndex = 0, bestDiff = Infinity;
  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time) - currentHour);
    if (diff < bestDiff) { bestDiff = diff; bestIndex = index; }
  });
  return bestIndex;
}

function estimatePokemonWeather(w) {
  const code = Number(w.weather_code);
  const wind = Number(w.wind_speed_10m || 0);
  const rain = Number(w.rain || 0);
  const snow = Number(w.snowfall || 0);
  const precip = Number(w.precipitation || 0);
  const clouds = Number(w.cloud_cover || 0);
  const visibility = Number(w.visibility || 99999);

  // Neige : assez fiable
  if (snow >= 0.2 || [71, 73, 75, 77, 85, 86].includes(code)) {
    return "Snow";
  }

  // Pluie : éviter les faux positifs avec micro-pluie / drizzle
  const realRain =
    rain >= 0.8 ||
    precip >= 0.8 ||
    ([61, 63, 65, 80, 81, 82].includes(code) && precip >= 0.5);

  const realThunderstorm =
    [95, 96, 99].includes(code) && precip >= 0.5;

  if (realRain || realThunderstorm) {
    return "Rainy";
  }

  // Brouillard
  if ([45, 48].includes(code) || visibility < 1000) {
    return "Fog";
  }

  // Vent : 25 était trop bas, on remonte
  if (wind >= 30) {
    return "Windy";
  }

  // Nuages
  if (clouds >= 80 || code === 3) {
    return "Cloudy";
  }

  if (clouds >= 25 || code === 1 || code === 2) {
    return "Partly Cloudy";
  }

  return "Clear";
}

function voteWeather(pointResults) {
  const counts = {};
  for (const p of pointResults) counts[p.pogoWeather] = (counts[p.pogoWeather] || 0) + 1;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { weather: sorted[0]?.[0] || "Unknown", count: sorted[0]?.[1] || 0 };
}

function normalizeText(str) {
  return String(str).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

async function fetchWeatherPack(lat, lon, previousDayMode) {
  const current = await fetchCurrentForecast(lat, lon);

  if (!previousDayMode) {
    return {
      primary: current,
      previous: null,
      current
    };
  }

  try {
    const previous = await fetchPreviousDayForecast(lat, lon);

    return {
      primary: previous,
      previous,
      current
    };
  } catch {
    return {
      primary: current,
      previous: null,
      current
    };
  }
}

function estimateHybridPokemonWeather(pack) {
  const previousWeather = pack.previous ? estimatePokemonWeather(pack.previous) : null;
  const currentWeather = estimatePokemonWeather(pack.current);

  if (!previousWeather) return currentWeather;

  const previous = pack.previous;
  const current = pack.current;

  const currentClouds = Number(current.cloud_cover || 0);
  const previousClouds = Number(previous.cloud_cover || 0);
  const currentWind = Number(current.wind_speed_10m || 0);
  const currentRain = Number(current.rain || current.precipitation || 0);
  const currentCode = Number(current.weather_code);

  const currentLooksClear =
    currentClouds <= 20 &&
    currentWind < 25 &&
    currentRain < 0.4 &&
    [0, 1].includes(currentCode);

  const previousOnlyCloudy =
    previousWeather === "Cloudy" &&
    currentWeather === "Clear" &&
    previousClouds >= 70 &&
    currentClouds <= 20;

  if (currentLooksClear && previousOnlyCloudy) {
    return "Clear";
  }

  const currentLooksPartlyCloudy =
    currentClouds > 20 &&
    currentClouds < 75 &&
    currentRain < 0.4 &&
    currentWind < 25;

  if (previousWeather === "Cloudy" && currentLooksPartlyCloudy) {
    return "Partly Cloudy";
  }

  return previousWeather;
}

function roundCoord(value) { return Number(value).toFixed(3); }
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}


