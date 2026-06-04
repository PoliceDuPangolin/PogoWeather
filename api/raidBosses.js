import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POKEMON_LIST_PATH = path.join(__dirname, "..", "data", "pokemon-list.json");
const RAID_BOSS_API_URL = "https://pokemon-go-api.github.io/pokemon-go-api/api/raidboss.json";
const RAID_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const POKEMON_DETAILS_TTL_MS = 24 * 60 * 60 * 1000;

let raidCache = null;
let speciesListCache = null;
const pokemonDetailsCache = new Map();

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

const WEATHER_FR = {
  Clear: "Clair / Ensoleillé",
  "Partly Cloudy": "Partiellement nuageux",
  Cloudy: "Nuageux",
  Rainy: "Pluvieux",
  Snow: "Neige",
  Windy: "Venteux",
  Fog: "Brouillard"
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
  fairy: "Fée"
};

export async function getCurrentRaidBosses() {
  if (raidCache && Date.now() < raidCache.expiresAt) {
    return raidCache.value;
  }

  const response = await fetch(RAID_BOSS_API_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PogoWeather/1.0 (contact@pogoweather.com)"
    }
  });

  if (!response.ok) {
    throw new Error(`Raid boss API unavailable (${response.status})`);
  }

  const rawData = await response.json();
  const flattened = flattenRaidBossData(rawData);
  const enriched = await enrichRaidBosses(flattened);

  const result = {
    source: "pokemon-go-api.github.io",
    sourceUrl: RAID_BOSS_API_URL,
    note: "Community data. Always verify raid availability in Pokémon GO.",
    updatedAt: new Date().toISOString(),
    count: enriched.length,
    raids: enriched
  };

  raidCache = {
    value: result,
    expiresAt: Date.now() + RAID_CACHE_TTL_MS
  };

  return result;
}

function flattenRaidBossData(rawData) {
  const raids = [];

  const walk = (value, tierHint = "") => {
    if (!value) return;

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, tierHint);
      }
      return;
    }

    if (typeof value !== "object") return;

    if (looksLikeRaidBoss(value)) {
      raids.push(normalizeRaidBoss(value, tierHint));
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      const nextTier = looksLikeTierKey(key) ? key : tierHint;
      walk(child, nextTier);
    }
  };

  walk(rawData);

  const seen = new Set();
  return raids.filter((raid) => {
    const key = `${raid.name}|${raid.tier}|${raid.form || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return raid.name;
  });
}

function looksLikeRaidBoss(value) {
  return Boolean(
    value.name ||
    value.names ||
    value.pokemon ||
    value.pokemonName ||
    value.pokemon_name ||
    value.templateId ||
    value.id
  );
}

function looksLikeTierKey(key) {
  return /raid|tier|lvl|level|mega|shadow|ultra|legendary|elite|star|1|3|5/i.test(String(key));
}

function normalizeRaidBoss(item, tierHint = "") {
  const name = getName(item);
  const id = getPokemonId(item);
  const types = getTypes(item);
  const tier = normalizeTier(
    item.raidLevel ||
    item.raid_level ||
    item.raidTier ||
    item.raid_tier ||
    item.tier ||
    item.level ||
    item.rarity ||
    item.egg ||
    item.pokemonClass ||
    tierHint
  );

  return {
    id,
    name,
    form: cleanText(item.form || item.formName || item.form_name || ""),
    tier,
    types,
    image:
      item.image ||
      item.imageUrl ||
      item.icon ||
      item.sprite ||
      (id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png` : ""),
    perfectCp: extractCp(item, ["perfectCp", "perfectCP", "maxCP", "max_cp", "cp", "cpRange", "normalCp", "normal_cp"]),
    boostedCp: String(Math.ceil(Number(extractCp(item, ["perfectCp", "perfectCP", "maxCP", "max_cp", "cp", "cpRange", "normalCp", "normal_cp"]).split("-")[0]*1.2501))) + " - " + String(Math.ceil(Number(extractCp(item, ["perfectCp", "perfectCP", "maxCP", "max_cp", "cp", "cpRange", "normalCp", "normal_cp"]).split("-")[1]*1.2501))),
    shiny: Boolean(item.shiny || item.canBeShiny || item.shinyAvailable),
    rawTier: String(tierHint || item.raidLevel || item.raid_level || item.tier || "")
  };
}

function getName(item) {
  if (typeof item.name === "string") return cleanPokemonName(item.name);
  if (typeof item.pokemonName === "string") return cleanPokemonName(item.pokemonName);
  if (typeof item.pokemon_name === "string") return cleanPokemonName(item.pokemon_name);
  if (typeof item.pokemon === "string") return cleanPokemonName(item.pokemon);
  if (item.names) {
    return cleanPokemonName(
      item.names.English ||
      item.names.english ||
      item.names.en ||
      Object.values(item.names).find((v) => typeof v === "string") ||
      ""
    );
  }
  if (typeof item.templateId === "string") {
    return cleanPokemonName(item.templateId.replace(/^V\d+_POKEMON_?/i, "").replace(/_/g, " "));
  }
  return "";
}

function getPokemonId(item) {
  const id =
    item.id ||
    item.pokemonId ||
    item.pokemon_id ||
    item.dex ||
    item.dexId ||
    item.pokedexNumber ||
    item.pokedex_number;

  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTypes(item) {
  const rawTypes = item.types || item.type || [item.type1, item.type2].filter(Boolean);

  if (!rawTypes) return [];

  const arr = Array.isArray(rawTypes) ? rawTypes : [rawTypes];

  return arr
    .map((type) => {
      if (!type) return "";
      if (typeof type === "string") return normalizeType(type);
      if (typeof type === "object") {
        return normalizeType(type.name || type.type || type.English || type.english || type.en || "");
      }
      return "";
    })
    .filter(Boolean);
}

async function enrichRaidBosses(raids) {
  const result = [];
  const limitedRaids = raids.slice(0, 80);

  for (const raid of limitedRaids) {
    const details = await getPokemonDetails(raid);

    const types = raid.types.length ? raid.types : details.types;
    const weatherBoosts = [...new Set(types.flatMap((type) => TYPE_TO_WEATHER[type] || []))];

    result.push({
      ...raid,
      id: raid.id || details.id,
      name: raid.name || details.name,
      frName: details.frName || raid.name,
      image: raid.image || details.image,
      types,
      typesFr: types.map((type) => TYPE_FR[type] || type),
      weatherBoosts,
      weatherBoostsFr: weatherBoosts.map((weather) => WEATHER_FR[weather] || weather),
      searchUrl: `/?pokemon=${encodeURIComponent(raid.name || details.name)}`
    });
  }

  return sortRaids(result);
}

async function getPokemonDetails(raid) {
  const key = normalizeText(raid.name || String(raid.id || ""));

  const cached = pokemonDetailsCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  const list = getPokemonSpeciesList();
  const normalizedName = normalizeText(raid.name);

  const match =
    (raid.id && list.find((p) => Number(p.id) === Number(raid.id))) ||
    list.find((p) => normalizeText(p.name) === normalizedName) ||
    list.find((p) => normalizeText(p.frName) === normalizedName) ||
    list.find((p) => normalizedName.includes(normalizeText(p.name))) ||
    list.find((p) => normalizeText(p.name).includes(normalizedName));

  if (!match) {
    return {
      id: raid.id || null,
      name: raid.name,
      frName: raid.name,
      image: raid.image || "",
      types: raid.types || []
    };
  }

  const cacheKey = String(match.id);
  const cachedById = pokemonDetailsCache.get(cacheKey);
  if (cachedById && Date.now() < cachedById.expiresAt) return cachedById.value;

  let details = {
    id: match.id,
    name: match.name,
    frName: match.frName,
    image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${match.id}.png`,
    types: raid.types || []
  };

  if (!details.types.length) {
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${match.id}`);
      if (res.ok) {
        const data = await res.json();
        details.types = data.types.map((t) => t.type.name);
      }
    } catch {
      // Keep partial details if PokeAPI is unavailable.
    }
  }

  pokemonDetailsCache.set(key, {
    value: details,
    expiresAt: Date.now() + POKEMON_DETAILS_TTL_MS
  });
  pokemonDetailsCache.set(cacheKey, {
    value: details,
    expiresAt: Date.now() + POKEMON_DETAILS_TTL_MS
  });

  return details;
}

function getPokemonSpeciesList() {
  if (speciesListCache) return speciesListCache;
  const raw = fs.readFileSync(POKEMON_LIST_PATH, "utf-8");
  speciesListCache = JSON.parse(raw);
  return speciesListCache;
}

function extractCp(item, keys) {
  for (const key of keys) {
    const value = item[key];

    if (value === null || value === undefined || value === "") continue;

    if (Array.isArray(value)) {
      return value.filter(Boolean).join(" - ");
    }

    if (typeof value === "object") {
      const values = Object.values(value).filter((v) => v !== null && v !== undefined && v !== "");
      if (values.length) return values.join(" - ");
    }

    return String(value);
  }

  return "N/A";
}

function sortRaids(raids) {
  const tierWeight = (tier) => {
    const t = String(tier).toLowerCase();
    if (t.includes("mega")) return 1;
    if (t.includes("shadow") && t.includes("5")) return 2;
    if (t.includes("5") || t.includes("legendary") || t.includes("ultra")) return 3;
    if (t.includes("3")) return 4;
    if (t.includes("1")) return 5;
    if (t.includes("shadow")) return 6;
    return 9;
  };

  return raids.sort((a, b) => {
    const diff = tierWeight(a.tier) - tierWeight(b.tier);
    if (diff !== 0) return diff;
    return String(a.name).localeCompare(String(b.name));
  });
}

function normalizeTier(value) {
  const raw = String(value || "").replace(/_/g, " ").trim();
  const lower = raw.toLowerCase();

  if (!raw) return "Current raid";
  if (lower.includes("mega")) return "Mega";
  if (lower.includes("ultra")) return "Ultra Beast";
  if (lower.includes("legendary")) return "5-Star";
  if (lower.includes("shadow") && lower.match(/5|lvl5|level 5/)) return "Shadow 5-Star";
  if (lower.includes("shadow") && lower.match(/3|lvl3|level 3/)) return "Shadow 3-Star";
  if (lower.includes("shadow") && lower.match(/1|lvl1|level 1/)) return "Shadow 1-Star";
  if (lower.includes("shadow")) return "Shadow";
  if (lower.match(/5|lvl5|level 5/)) return "5-Star";
  if (lower.match(/4|lvl4|level 4/)) return "4-Star";
  if (lower.match(/3|lvl3|level 3/)) return "3-Star";
  if (lower.match(/2|lvl2|level 2/)) return "2-Star";
  if (lower.match(/1|lvl1|level 1/)) return "1-Star";

  return raw;
}

function cleanPokemonName(name) {
  return cleanText(name)
    .replace(/\bAlola\b/gi, "Alolan")
    .replace(/\bGalar\b/gi, "Galarian")
    .replace(/\bHisui\b/gi, "Hisuian");
}

function cleanText(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeType(type) {
  return cleanText(type).toLowerCase();
}

function normalizeText(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
