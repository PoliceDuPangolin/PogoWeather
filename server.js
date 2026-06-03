import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { searchWeatherBoost, searchWeatherForecast, addCustomCityValidation, getPokemonSuggestions } from "./api/weatherEngine.js";
import { getCurrentRaidBosses } from "./api/raidBosses.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: {
  policy: "strict-origin-when-cross-origin",
}
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: "700kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 45,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de requêtes. Réessaie dans une minute." }
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Trop de recherches. Attends un peu avant de relancer." }
});

app.get("/translations", (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "public", "translations.js"));
});

app.get("/translations.js", (req, res) => {
  res.type("application/javascript");
  res.sendFile(path.join(__dirname, "public", "translations.js"));
});

app.use("/api", apiLimiter);


const redirects = {
  "/guide": "/weather-boost-guide",
  "/weather-boost": "/weather-boost-guide",
  "/windy-weather-rayquaza": "/best-weather-rayquaza",
  "/raid-weather-boost": "/gofest-raid-weather-boosts",
  "/fog-weather": "/best-weather-darkrai",
  "/best-cities": "/gofest-live-weather"
};

for (const [oldPath, newPath] of Object.entries(redirects)) {
  app.get(oldPath, (req, res) => {
    res.redirect(301, newPath);
  });
}

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: isProd ? "7d" : 0,
  etag: true,
  lastModified: true
}));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, name: "PogoWeather API", env: process.env.NODE_ENV || "dev" });
});

app.get("/api/pokemon-suggestions", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const suggestions = await getPokemonSuggestions(q);
    res.json({ suggestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur suggestions Pokémon." });
  }
});


app.get("/api/raid-bosses", async (req, res) => {
  try {
    const data = await getCurrentRaidBosses();
    res.set("Cache-Control", "public, max-age=1800");
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Unable to fetch current raid bosses.",
      message: error.message || "Raid API unavailable"
    });
  }
});


app.post("/api/forecast", searchLimiter, async (req, res) => {
  try {
    const {
      pokemonName,
      customCities = [],
      horizon = "24h",
    } = req.body || {};

    if (!pokemonName || typeof pokemonName !== "string") {
      return res.status(400).json({ error: "pokemonName est obligatoire." });
    }

    const cleanCustomCities = [];
    for (const city of customCities.slice(0, 20)) {
      const valid = addCustomCityValidation(city);
      if (valid) cleanCustomCities.push(valid);
    }

    const cleanHorizon = horizon === "7d" ? "7d" : "24h";

    const data = await searchWeatherForecast({
      pokemonName,
      customCities: cleanCustomCities,
      horizon: cleanHorizon,
    });

    res.set("Cache-Control", "private, max-age=600");
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erreur prévision météo." });
  }
});

app.post("/api/search", searchLimiter, async (req, res) => {
  try {
    const { pokemonName, customCities = [], preciseMode = false, previousDayMode = true } = req.body || {};

    if (!pokemonName || typeof pokemonName !== "string") {
      return res.status(400).json({ error: "pokemonName est obligatoire." });
    }

    const cleanCustomCities = [];
    for (const city of customCities.slice(0, 20)) {
      const valid = addCustomCityValidation(city);
      if (valid) cleanCustomCities.push(valid);
    }

    const data = await searchWeatherBoost({
      pokemonName,
      customCities: cleanCustomCities,
      preciseMode: Boolean(preciseMode),
      previousDayMode: Boolean(previousDayMode)
    });

    res.set("Cache-Control", "private, max-age=120");
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Erreur serveur." });
  }
});

const pages = ["guide", "weather-boost", "best-cities", "windy-weather-rayquaza", "fog-weather", "raid-weather-boost", "privacy", "disclaimer", "about", "best-weather-rayquaza", "fr/meilleure-meteo-rayquaza", "best-weather-necrozma", "fr/meilleure-meteo-necrozma", "best-weather-kyogre", "fr/meilleure-meteo-kyogre", "best-weather-groudon", "fr/meilleure-meteo-groudon", "best-weather-darkrai", "fr/meilleure-meteo-darkrai", "weather-boost-guide", "fr/guide-boost-meteo-pokemon-go", "pokemon-go-weather-explained", "fr/meteo-pokemon-go-expliquee", "why-pokemon-go-weather-is-wrong", "fr/pourquoi-meteo-pokemon-go-differente", "gofest-weather", "fr/gofest-meteo", "gofest-live-weather", "fr/gofest-meteo-live", "fr/a-propos", "contact", "fr/contact", "gofest-raid-weather-boosts", "fr/gofest-boost-meteo-raids", "gofest-windy-weather-guide", "fr/gofest-guide-meteo-venteux", "gofest-weather-preparation-checklist", "fr/gofest-checklist-meteo", "fr/confidentialite", "cookie-policy", "fr/politique-cookies", "pokemon-go-current-raids", "fr/raids-actuels-pokemon-go", "pokemon-go-weather-forecast", "fr/prevision-meteo-pokemon-go"];
for (const page of pages) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, "public", `${page}.html`)));
}

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`PogoWeather running on http://localhost:${PORT}`);
});
