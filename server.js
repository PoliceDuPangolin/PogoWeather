import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { searchWeatherBoost, addCustomCityValidation, getPokemonSuggestions } from "./api/weatherEngine.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
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

app.use("/api", apiLimiter);

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

const pages = ["guide", "weather-boost", "best-cities", "windy-weather-rayquaza", "fog-weather", "raid-weather-boost", "privacy", "disclaimer", "about"];
for (const page of pages) {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, "public", `${page}.html`)));
}

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`PogoWeather running on http://localhost:${PORT}`);
});
