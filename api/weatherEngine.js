import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POKEMON_LIST_PATH = path.join(
  __dirname,
  "..",
  "data",
  "pokemon-list.json"
);

const VISUAL_CROSSING_API_KEY = process.env.VISUAL_CROSSING_API_KEY || "";

const DEFAULT_CITIES = [
  { name: "Tokyo - Shibuya", country: "Japan", lat: 35.6595, lon: 139.7006 },
  { name: "New York - Central Park", country: "United States", lat: 40.7851, lon: -73.9683 },
  { name: "San Francisco - Pier 39", country: "United States", lat: 37.8086, lon: -122.4098 },
  { name: "Honolulu - Ala Moana", country: "United States", lat: 21.2910, lon: -157.8440 },
  { name: "Sydney - Circular Quay", country: "Australia", lat: -33.8610, lon: 151.2128 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "London", country: "United Kingdom", lat: 51.5072, lon: -0.1276 },
  { name: "Zaragoza", country: "Spain", lat: 41.6611, lon: -0.8938 },
  { name: "Dubai Marina", country: "United Arab Emirates", lat: 25.0763, lon: 55.1324 },
  { name: "Taipei Main Station", country: "Taiwan", lat: 25.0478, lon: 121.5170 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.9780 },
  { name: "Bangkok", country: "Thailand", lat: 13.7563, lon: 100.5018 },
  { name: "São Paulo", country: "Brazil", lat: -23.5558, lon: -46.6396 },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lon: -99.1332 }
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
  fairy: ["Cloudy"]
};

const TYPE_FR = {
  normal: "Normal",
  fire: "Fire",
  water: "Water",
  electric: "Electric",
  grass: "Grass",
  ice: "Ice",
  fighting: "Fighting",
  poison: "Poison",
  ground: "Ground",
  flying: "Flying",
  psychic: "Psychic",
  bug: "Bug",
  rock: "Rock",
  ghost: "Ghost",
  dragon: "Dragon",
  dark: "Dark",
  steel: "Steel",
  fairy: "Fairy"
};

const WEATHER_FR = {
  Clear: "Clear",
  "Partly Cloudy": "Partly Cloudy",
  Cloudy: "Cloudy",
  Rainy: "Rainy",
  Snow: "Snow",
  Windy: "Windy",
  Fog: "Fog"
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
    expiresAt: Date.now() + ttl
  });
}

export function addCustomCityValidation(city) {
  if (!city || typeof city !== "object") return null;

  const name = String(city.name || "").trim().slice(0, 60);
  const country = String(city.country || "Custom")
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
    custom: true
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
        normalizeText(p.frName).includes(q)
    )
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      name: p.name,
      frName: p.frName,
      image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`
    }));
}

export async function searchWeatherBoost({
  pokemonName,
  customCities,
  preciseMode,
  previousDayMode
}) {
  const pokemon = await getPokemonData(pokemonName);

  const targetWeathers = [
    ...new Set(
      pokemon.types.flatMap(
        (type) => TYPE_TO_WEATHER[type] || []
      )
    )
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
          previousDayMode
        })
      )
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
      typesFr: pokemon.types.map(
        (t) => TYPE_FR[t] || t
      )
    },
    targetWeathers,
    targetWeathersFr: targetWeathers.map(
      (w) => WEATHER_FR[w] || w
    ),
    cities: cityResults,
    generatedAt: new Date().toISOString(),
    mode: {
      preciseMode,
      previousDayMode
    }
  };
}

async function getPokemonData(rawName) {
  const normalizedName = normalizeText(rawName);

  const cached = cacheGet(
    pokemonCache,
    normalizedName
  );

  if (cached) return cached;

  const list = await getPokemonSpeciesList();

  const match =
    list.find(
      (p) =>
        normalizeText(p.frName) === normalizedName
    ) ||
    list.find(
      (p) =>
        normalizeText(p.name) === normalizedName
    ) ||
    list.find((p) =>
      normalizeText(p.frName).includes(
        normalizedName
      )
    ) ||
    list.find((p) =>
      normalizeText(p.name).includes(
        normalizedName
      )
    );

  if (!match) {
    throw new Error("Pokémon not found.");
  }

  const res = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${match.id}`
  );

  if (!res.ok) {
    throw new Error(
      "Could not fetch Pokémon types."
    );
  }

  const data = await res.json();

  const pokemon = {
    id: match.id,
    name: match.name,
    frName: match.frName,
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${match.id}.png`,
    types: data.types.map((t) => t.type.name)
  };

  cacheSet(
    pokemonCache,
    normalizedName,
    pokemon,
    POKEMON_CACHE_TTL_MS
  );

  return pokemon;
}

async function getPokemonSpeciesList() {
  if (speciesListCache) return speciesListCache;

  const raw = fs.readFileSync(
    POKEMON_LIST_PATH,
    "utf-8"
  );

  speciesListCache = JSON.parse(raw);

  return speciesListCache;
}

async function analyzeCity({
  city,
  targetWeathers,
  preciseMode,
  previousDayMode
}) {
  const points = preciseMode
    ? createCityGrid(city)
    : [{ ...city, zone: "centre" }];

  const pointResults = [];

  for (const point of points) {
    const meteoPack = await fetchWeatherPack(
      point.lat,
      point.lon,
      previousDayMode
    );

    const pogoWeather =
      estimateHybridPokemonWeather(
        meteoPack
      );

    pointResults.push({
      zone: point.zone || "centre",
      lat: point.lat,
      lon: point.lon,
      meteoPublic: sanitizeMeteo(
        meteoPack.current
      ),
      pogoWeather,
      pogoWeatherFr:
        WEATHER_FR[pogoWeather] || pogoWeather,
      isTarget: targetWeathers.includes(
        pogoWeather
      )
    });
  }

  const vote = voteWeather(pointResults);

  const targetVotes = pointResults.filter(
    (p) => p.isTarget
  ).length;

  const confidence = Math.round(
    (targetVotes / pointResults.length) * 100
  );

  return {
    name: city.name,
    country: city.country,
    lat: city.lat,
    lon: city.lon,
    dominantWeather: vote.weather,
    dominantWeatherFr:
      WEATHER_FR[vote.weather] || vote.weather,
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
    weatherCode: meteo.weather_code,
    windSpeed: Math.round(
      Number(meteo.wind_speed_10m || 0)
    ),
    cloudCover: Math.round(
      Number(meteo.cloud_cover || 0)
    ),
    precipitation: Number(
      meteo.precipitation ||
        meteo.rain ||
        0
    ).toFixed(1)
  };
}

function createCityGrid(city) {
  const km = 15;

  const latOffset = km / 111;

  const lonOffset =
    km /
    (111 *
      Math.cos(
        (city.lat * Math.PI) / 180
      ));

  return [
    { ...city, zone: "centre" },
    {
      ...city,
      lat: city.lat + latOffset,
      zone: "nord"
    },
    {
      ...city,
      lat: city.lat - latOffset,
      zone: "sud"
    },
    {
      ...city,
      lon: city.lon + lonOffset,
      zone: "est"
    },
    {
      ...city,
      lon: city.lon - lonOffset,
      zone: "ouest"
    }
  ];
}

async function fetchWeatherPack(
  lat,
  lon,
  previousDayMode
) {
  const current = await fetchCurrentForecast(
    lat,
    lon
  );

  if (!previousDayMode) {
    return {
      primary: current,
      previous: null,
      current
    };
  }

  try {
    const previous =
      await fetchPreviousDayForecast(
        lat,
        lon
      );

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

async function fetchPreviousDayForecast(
  lat,
  lon
) {
  const currentHourKey = new Date()
    .toISOString()
    .slice(0, 13);

  const cacheKey = `${roundCoord(
    lat
  )}_${roundCoord(
    lon
  )}_previous_day1_${currentHourKey}`;

  const cached = cacheGet(
    weatherCache,
    cacheKey
  );

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

  const res = await fetch(
    `https://previous-runs-api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error(
      "Previous forecast unavailable."
    );
  }

  const data = await res.json();

  const meteo = pickPreviousDayHourlyData(
    data.hourly
  );

  cacheSet(
    weatherCache,
    cacheKey,
    meteo,
    WEATHER_CACHE_TTL_MS
  );

  return meteo;
}

async function fetchCurrentForecast(
  lat,
  lon
) {
  const currentHourKey = new Date()
    .toISOString()
    .slice(0, 13);

  const cacheKey = `${roundCoord(
    lat
  )}_${roundCoord(
    lon
  )}_current_${currentHourKey}`;

  const cached = cacheGet(
    weatherCache,
    cacheKey
  );

  if (cached) return cached;

  const variables = [
    "weather_code",
    "precipitation",
    "rain",
    "snowfall",
    "cloud_cover",
    "wind_speed_10m",
    "visibility"
  ].join(",");

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone: "auto",
    forecast_days: "1",
    hourly: variables
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Weather API error.");
  }

  const data = await res.json();

  let meteo = pickCurrentHourlyData(
    data.hourly
  );

  // VISUAL CROSSING FALLBACK
  if (
    VISUAL_CROSSING_API_KEY &&
    meteo.cloud_cover >= 90 &&
    meteo.rain < 0.2 &&
    meteo.wind_speed_10m < 15
  ) {
    try {
      const vc =
        await fetchVisualCrossingWeather(
          lat,
          lon
        );

      if (vc) {
        meteo = vc;
      }
    } catch (e) {
      console.error(
        "Visual Crossing fallback error",
        e
      );
    }
  }

  cacheSet(
    weatherCache,
    cacheKey,
    meteo,
    WEATHER_CACHE_TTL_MS
  );

  return meteo;
}

async function fetchVisualCrossingWeather(
  lat,
  lon
) {
  const cacheKey = `${roundCoord(
    lat
  )}_${roundCoord(
    lon
  )}_visual_crossing`;

  const cached = cacheGet(
    weatherCache,
    cacheKey
  );

  if (cached) return cached;

  const url =
    `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/` +
    `${lat},${lon}/today?unitGroup=metric&include=current&key=${VISUAL_CROSSING_API_KEY}&contentType=json`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      "Visual Crossing error"
    );
  }

  const data = await res.json();

  const current =
    data.currentConditions || {};

  const cloudCover = Number(
    current.cloudcover || 0
  );

  const wind = Number(
    current.windspeed || 0
  );

  const precip = Number(
    current.precip || 0
  );

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
    time:
      current.datetime ||
      new Date().toISOString(),
    weather_code: weatherCode,
    precipitation: precip,
    rain: precip,
    snowfall: 0,
    cloud_cover: cloudCover,
    wind_speed_10m: wind,
    visibility: 99999
  };

  cacheSet(
    weatherCache,
    cacheKey,
    result,
    WEATHER_CACHE_TTL_MS
  );

  return result;
}

function pickPreviousDayHourlyData(hourly) {
  const index = findCurrentHourIndex(
    hourly.time
  );

  return {
    source: "Previous forecast",
    time: hourly.time[index],
    weather_code:
      hourly.weather_code_previous_day1[
        index
      ],
    precipitation:
      hourly.precipitation_previous_day1[
        index
      ],
    rain:
      hourly.rain_previous_day1[index],
    snowfall:
      hourly.snowfall_previous_day1[
        index
      ],
    cloud_cover:
      hourly.cloud_cover_previous_day1[
        index
      ],
    wind_speed_10m:
      hourly.wind_speed_10m_previous_day1[
        index
      ],
    visibility: 99999
  };
}

function pickCurrentHourlyData(hourly) {
  const index = findCurrentHourIndex(
    hourly.time
  );

  return {
    source: "Current forecast",
    time: hourly.time[index],
    weather_code:
      hourly.weather_code[index],
    precipitation:
      hourly.precipitation[index],
    rain: hourly.rain[index],
    snowfall: hourly.snowfall[index],
    cloud_cover:
      hourly.cloud_cover[index],
    wind_speed_10m:
      hourly.wind_speed_10m[index],
    visibility: hourly.visibility
      ? hourly.visibility[index]
      : 99999
  };
}

function findCurrentHourIndex(times) {
  const now = new Date();

  const currentHour = new Date(now);

  currentHour.setMinutes(0, 0, 0);

  let bestIndex = 0;
  let bestDiff = Infinity;

  times.forEach((time, index) => {
    const diff = Math.abs(
      new Date(time) - currentHour
    );

    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function estimatePokemonWeather(w) {
  const code = Number(w.weather_code);

  const wind = Number(
    w.wind_speed_10m || 0
  );

  const rain = Number(w.rain || 0);

  const snow = Number(
    w.snowfall || 0
  );

  const precip = Number(
    w.precipitation || 0
  );

  const clouds = Number(
    w.cloud_cover || 0
  );

  const visibility = Number(
    w.visibility || 99999
  );

  if (
    snow >= 0.2 ||
    [71, 73, 75, 77, 85, 86].includes(
      code
    )
  ) {
    return "Snow";
  }

  const realRain =
    rain >= 0.8 ||
    precip >= 0.8 ||
    ([61, 63, 65, 80, 81, 82].includes(
      code
    ) &&
      precip >= 0.5);

  const realThunderstorm =
    [95, 96, 99].includes(code) &&
    precip >= 0.5;

  if (
    realRain ||
    realThunderstorm
  ) {
    return "Rainy";
  }

  if (
    [45, 48].includes(code) ||
    visibility < 1000
  ) {
    return "Fog";
  }

  if (wind >= 30) {
    return "Windy";
  }

  if (
    clouds >= 80 ||
    code === 3
  ) {
    return "Cloudy";
  }

  if (
    clouds >= 25 ||
    code === 1 ||
    code === 2
  ) {
    return "Partly Cloudy";
  }

  return "Clear";
}

function estimateHybridPokemonWeather(
  pack
) {
  const previousWeather = pack.previous
    ? estimatePokemonWeather(
        pack.previous
      )
    : null;

  const currentWeather =
    estimatePokemonWeather(
      pack.current
    );

  if (!previousWeather) {
    return currentWeather;
  }

  const current = pack.current;

  const currentClouds = Number(
    current.cloud_cover || 0
  );

  const currentWind = Number(
    current.wind_speed_10m || 0
  );

  const currentRain = Number(
    current.rain ||
      current.precipitation ||
      0
  );

  const currentSnow = Number(
    current.snowfall || 0
  );

  const currentCode = Number(
    current.weather_code
  );

  const currentVisibility = Number(
    current.visibility || 99999
  );

  const currentHasBadWeather =
    currentRain >= 0.5 ||
    currentSnow >= 0.2 ||
    [
      61,
      63,
      65,
      80,
      81,
      82,
      95,
      96,
      99
    ].includes(currentCode) ||
    [45, 48].includes(currentCode) ||
    currentVisibility < 1000 ||
    currentWind >= 30;

  if (currentHasBadWeather) {
    return currentWeather;
  }

  if (
    previousWeather === "Cloudy" &&
    currentClouds <= 35 &&
    [0, 1, 2].includes(
      currentCode
    )
  ) {
    return "Clear";
  }

  if (
    previousWeather === "Cloudy" &&
    currentClouds < 75 &&
    currentRain < 0.5 &&
    currentWind < 30
  ) {
    return "Partly Cloudy";
  }

  if (
    [
      "Clear",
      "Partly Cloudy"
    ].includes(currentWeather) &&
    [
      "Cloudy",
      "Rainy",
      "Windy"
    ].includes(previousWeather)
  ) {
    return currentWeather;
  }

  return previousWeather;
}

function voteWeather(pointResults) {
  const counts = {};

  for (const p of pointResults) {
    counts[p.pogoWeather] =
      (counts[p.pogoWeather] || 0) + 1;
  }

  const sorted = Object.entries(
    counts
  ).sort((a, b) => b[1] - a[1]);

  return {
    weather:
      sorted[0]?.[0] || "Unknown",
    count: sorted[0]?.[1] || 0
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

