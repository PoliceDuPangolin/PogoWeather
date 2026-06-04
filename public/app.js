import { translations } from "./translations.js";

const $ = (id) => document.getElementById(id);
const searchModeButtons = document.querySelectorAll("[data-search-mode]");
const forecastHorizonButtons = document.querySelectorAll("[data-forecast-horizon]");
const languageButtons = document.querySelectorAll("[data-lang]");

const pokemonInput = $("pokemonInput");
const suggestions = $("pokemonSuggestions");
const searchBtn = $("searchBtn");
const refreshBtn = $("refreshBtn");
const results = $("results");
const statusText = $("statusText");
const selectedPokemon = $("selectedPokemon");
const useCityGrid = $("useCityGrid");
const usePreviousDayForecast = $("usePreviousDayForecast");
const searchMode = $("searchMode");
const forecastCitySelectorWrap = $("forecastCitySelectorWrap");
const forecastCitySelect = $("forecastCitySelect");
const forecastPanelCitySelect = $("forecastPanelCitySelect");
const loader = $("loader");
const themeToggle = $("themeToggle");
const cityNameInput = $("cityNameInput");
const cityCountryInput = $("cityCountryInput");
const cityLatInput = $("cityLatInput");
const cityLonInput = $("cityLonInput");
const addCityBtn = $("addCityBtn");
const cityList = $("cityList");
const pager = $("pager");
const forecastSection = $("forecastSection");
const forecastBtn = $("forecastBtn");
const forecastHorizon = $("forecastHorizon");
const forecastStatus = $("forecastStatus");
const forecastResults = $("forecastResults");

let customCities = safeJsonParse(localStorage.getItem("customCities"), []);
let currentLang = localStorage.getItem("lang") || "fr";
let map = null;
let markersLayer = null;
let lastData = null;
let lastSearch = null;
let currentPage = 1;
let suggestionTimer = null;

const PAGE_SIZE = 9;

const DEFAULT_FORECAST_CITIES = [
  { name: "Tokyo - Shibuya", country: "Japon", lat: 35.6595, lon: 139.7006 },
  { name: "New York - Central Park", country: "États-Unis", lat: 40.7851, lon: -73.9683 },
  { name: "San Francisco - Pier 39", country: "États-Unis", lat: 37.8086, lon: -122.4098 },
  { name: "Honolulu - Ala Moana", country: "États-Unis", lat: 21.291, lon: -157.844 },
  { name: "Sydney - Circular Quay", country: "Australie", lat: -33.861, lon: 151.2128 },
  { name: "Paris", country: "France", lat: 48.8566, lon: 2.3522 },
  { name: "London", country: "Royaume-Uni", lat: 51.5072, lon: -0.1276 },
  { name: "Zaragoza", country: "Espagne", lat: 41.6611, lon: -0.8938 },
  { name: "Dubai Marina", country: "Émirats arabes unis", lat: 25.0763, lon: 55.1324 },
  { name: "Taipei Main Station", country: "Taïwan", lat: 25.0478, lon: 121.517 },
  { name: "Singapore", country: "Singapour", lat: 1.3521, lon: 103.8198 },
  { name: "Seoul", country: "Corée du Sud", lat: 37.5665, lon: 126.978 },
  { name: "Bangkok", country: "Thaïlande", lat: 13.7563, lon: 100.5018 },
  { name: "São Paulo", country: "Brésil", lat: -23.5558, lon: -46.6396 },
  { name: "Mexico City", country: "Mexique", lat: 19.4326, lon: -99.1332 },
];

const HOME_COPY = {
  fr: {
    heroEyebrow: "Outil non officiel Pokémon GO",
    heroSubtitle: "Trouve rapidement les villes où ton Pokémon a le plus de chances d’être boosté météo dans Pokémon GO.",
    searchTitle: "Weather Boost Finder",
    searchHint: "Tape un Pokémon, puis choisis le mode d’analyse.",
    pokemonLabel: "Pokémon",
    searchButton: "Rechercher",
    refreshButton: "Actualiser maintenant",
    modeLabel: "Mode d’analyse",
    modeNowTitle: "Maintenant",
    modeNowSub: "Météo actuelle",
    mode24Title: "24h",
    mode24Sub: "Toutes les villes",
    mode7Title: "7 jours",
    mode7Sub: "1 ville",
    city7Label: "Ville pour la prévision 7 jours",
    city7Help: "Le mode 7 jours analyse une seule ville pour rester rapide.",
    forecastTitle: "Prévision de boost météo",
    forecastHint: "La prévision se lance directement avec le mode choisi en haut : Maintenant, 24h ou 7 jours.",
    forecastBtn: "Voir la prévision",
    currentSelected: "Mode météo actuelle sélectionné.",
    forecast24Selected: "Mode prévision 24h sélectionné. Lance une recherche Pokémon.",
    forecast7Selected: "Mode prévision 7 jours sélectionné. Choisis une ville puis lance une recherche Pokémon.",
    typePokemon: "Tape un Pokémon.",
    serverAnalysis: "Analyse côté serveur...",
    forecast24Loading: "Prévision sur 24h...",
    forecast7Loading: "Prévision sur 7 jours...",
    forecastReady: "Tu peux maintenant calculer les meilleures fenêtres de boost météo.",
    searchError: "Erreur pendant la recherche.",
    suggestionError: "Suggestions indisponibles.",
    addCityInvalid: "Coordonnées invalides.",
    noForecastSearch: "Lance d'abord une recherche Pokémon.",
    forecastLoading: "Calcul des prévisions météo...",
    forecastError: "Erreur prévision météo.",
    maps: "Google Maps",
    copyCoords: "Copier coords",
    previous: "Précédent",
    next: "Suivant",
    page: "Page",
    boosted: "Boost probable",
    notBoosted: "Pas boosté",
    confidence: "confiance",
    details: "Détails météo",
    bestWindows: "Meilleures fenêtres",
    noWindow: "Aucune fenêtre boostée détectée.",
  },
  en: {
    heroEyebrow: "Unofficial Pokémon GO tool",
    heroSubtitle: "Quickly find cities where your Pokémon is more likely to be weather boosted in Pokémon GO.",
    searchTitle: "Weather Boost Finder",
    searchHint: "Enter a Pokémon, then choose an analysis mode.",
    pokemonLabel: "Pokémon",
    searchButton: "Search",
    refreshButton: "Refresh now",
    modeLabel: "Analysis mode",
    modeNowTitle: "Now",
    modeNowSub: "Current weather",
    mode24Title: "24h",
    mode24Sub: "All cities",
    mode7Title: "7 days",
    mode7Sub: "1 city",
    city7Label: "City for 7-day forecast",
    city7Help: "7-day mode analyzes only one city to stay fast.",
    forecastTitle: "Weather boost forecast",
    forecastHint: "Forecast runs directly from the mode selected above: Now, 24h or 7 days.",
    forecastBtn: "Show forecast",
    currentSelected: "Current weather mode selected.",
    forecast24Selected: "24h forecast mode selected. Search a Pokémon.",
    forecast7Selected: "7-day forecast mode selected. Choose a city, then search a Pokémon.",
    typePokemon: "Enter a Pokémon.",
    serverAnalysis: "Server-side analysis...",
    forecast24Loading: "24h forecast...",
    forecast7Loading: "7-day forecast...",
    forecastReady: "You can now calculate the best weather boost windows.",
    searchError: "Search error.",
    suggestionError: "Suggestions unavailable.",
    addCityInvalid: "Invalid coordinates.",
    noForecastSearch: "Search a Pokémon first.",
    forecastLoading: "Calculating weather forecast...",
    forecastError: "Weather forecast error.",
    maps: "Google Maps",
    copyCoords: "Copy coords",
    previous: "Previous",
    next: "Next",
    page: "Page",
    boosted: "Likely boost",
    notBoosted: "Not boosted",
    confidence: "confidence",
    details: "Weather details",
    bestWindows: "Best windows",
    noWindow: "No boosted window detected.",
  },
};

function copy(key) {
  return HOME_COPY[currentLang]?.[key] || HOME_COPY.fr[key] || key;
}

function t(key) {
  return translations[currentLang]?.[key] || copy(key) || key;
}

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value || "");
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function applyTranslations() {
  const c = HOME_COPY[currentLang] || HOME_COPY.fr;

  document.documentElement.lang = currentLang;

  setText(".hero .eyebrow", c.heroEyebrow);
  setText(".hero .hero-subtitle", c.heroSubtitle);
  setText(".search-card h2", c.searchTitle);
  setText(".search-card .hint", c.searchHint);
  setText("label[for='pokemonInput']", c.pokemonLabel);
  setText("#searchBtn", c.searchButton);
  setText("#refreshBtn", c.refreshButton);
  setText("#searchModeLabel", c.modeLabel);
  setText("[data-search-mode='now'] strong", c.modeNowTitle);
  setText("[data-search-mode='now'] span", c.modeNowSub);
  setText("[data-search-mode='24h'] strong", c.mode24Title);
  setText("[data-search-mode='24h'] span", c.mode24Sub);
  setText("[data-search-mode='7d'] strong", c.mode7Title);
  setText("[data-search-mode='7d'] span", c.mode7Sub);
  setText("label[for='forecastCitySelect']", c.city7Label);
  setText("#forecastCitySelectorWrap small", c.city7Help);
  setText("#forecastSection h2", c.forecastTitle);
  setText("#forecastBtn", c.forecastBtn);
  setText("[data-forecast-horizon='24h'] strong", c.mode24Title);
  setText("[data-forecast-horizon='24h'] span", c.mode24Sub);
  setText("[data-forecast-horizon='7d'] strong", c.mode7Title);
  setText("[data-forecast-horizon='7d'] span", c.mode7Sub);

  if (pokemonInput) {
    pokemonInput.placeholder =
      currentLang === "en"
        ? "Example: Rayquaza, Charizard, Pikachu..."
        : "Ex : Rayquaza, Dracaufeu, Pikachu...";
  }

  languageButtons.forEach((button) => {
    const active = button.dataset.lang === currentLang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  updateForecastCitySelectorVisibility();
}

function setLanguage(lang) {
  currentLang = lang === "en" ? "en" : "fr";
  localStorage.setItem("lang", currentLang);
  applyTranslations();
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") document.body.classList.add("dark");

  if (themeToggle) {
    themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
  }
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  const dark = document.body.classList.contains("dark");
  localStorage.setItem("theme", dark ? "dark" : "light");
  if (themeToggle) themeToggle.textContent = dark ? "☀️" : "🌙";
}

function setLoading(v) {
  loader?.classList.toggle("hidden", !v);
  if (searchBtn) searchBtn.disabled = v;
  if (refreshBtn) refreshBtn.disabled = v;
}

function getForecastCityOptions() {
  const map = new Map();

  [...DEFAULT_FORECAST_CITIES, ...customCities].forEach((city) => {
    const lat = Number(city.lat);
    const lon = Number(city.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    map.set(key, {
      name: String(city.name || "Selected city"),
      country: String(city.country || "Custom"),
      lat,
      lon,
    });
  });

  return [...map.values()];
}

function renderForecastCitySelectors() {
  const cities = getForecastCityOptions();
  const options = cities
    .map((city, index) => {
      const label = `${city.name}, ${city.country}`;
      return `<option value="${index}">${escapeHtml(label)}</option>`;
    })
    .join("");

  [forecastCitySelect, forecastPanelCitySelect].forEach((select) => {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = options;
    if (previous && Number(previous) < cities.length) {
      select.value = previous;
    }
  });
}

function getSelectedForecastCity(source = "search") {
  const cities = getForecastCityOptions();
  const select = source === "panel" ? forecastPanelCitySelect : forecastCitySelect;
  const index = Number(select?.value || 0);
  return cities[index] || cities[0];
}

function syncForecastCitySelectors(source = "search") {
  if (!forecastCitySelect || !forecastPanelCitySelect) return;

  if (source === "panel") {
    forecastCitySelect.value = forecastPanelCitySelect.value;
  } else {
    forecastPanelCitySelect.value = forecastCitySelect.value;
  }
}

function updateForecastCitySelectorVisibility() {
  const searchModeValue = searchMode?.value || "now";
  const panelHorizonValue = forecastHorizon?.value || "24h";

  forecastCitySelectorWrap?.classList.toggle("hidden", searchModeValue !== "7d");
  forecastPanelCitySelect?.classList.toggle("hidden", panelHorizonValue !== "7d");

  searchModeButtons.forEach((button) => {
    const active = button.dataset.searchMode === searchModeValue;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  forecastHorizonButtons.forEach((button) => {
    const active = button.dataset.forecastHorizon === panelHorizonValue;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setSearchMode(mode) {
  if (!searchMode) return;

  const cleanMode = ["now", "24h", "7d"].includes(mode) ? mode : "now";
  searchMode.value = cleanMode;

  if (forecastHorizon) {
    forecastHorizon.value = cleanMode === "7d" ? "7d" : "24h";
  }

  updateForecastCitySelectorVisibility();

  if (cleanMode === "now") {
    if (statusText) statusText.textContent = copy("currentSelected");
    return;
  }

  forecastSection?.classList.remove("hidden");

  if (forecastStatus) {
    forecastStatus.textContent =
      cleanMode === "7d" ? copy("forecast7Selected") : copy("forecast24Selected");
  }
}

function setForecastHorizonMode(mode) {
  if (!forecastHorizon) return;

  forecastHorizon.value = mode === "7d" ? "7d" : "24h";
  updateForecastCitySelectorVisibility();

  if (forecastHorizon.value === "7d" && forecastStatus) {
    forecastStatus.textContent =
      currentLang === "en"
        ? "7-day mode analyzes one city only to stay fast."
        : "Le mode 7 jours analyse une seule ville pour rester rapide.";
  }
}

function renderCityList() {
  if (!cityList) return;

  cityList.innerHTML = customCities
    .map(
      (c, i) =>
        `<span class="city-pill">${escapeHtml(c.name)}
          <button type="button" data-i="${i}" aria-label="Supprimer ${escapeHtml(c.name)}">×</button>
        </span>`,
    )
    .join("");

  cityList.querySelectorAll("[data-i]").forEach((button) => {
    button.addEventListener("click", () => {
      customCities.splice(Number(button.dataset.i), 1);
      localStorage.setItem("customCities", JSON.stringify(customCities));
      renderCityList();
      renderForecastCitySelectors();
      updateForecastCitySelectorVisibility();
    });
  });
}

function addCustomCity() {
  const name = cityNameInput?.value.trim();
  const country = cityCountryInput?.value.trim() || (currentLang === "en" ? "Custom" : "Personnalisé");
  const lat = Number(cityLatInput?.value);
  const lon = Number(cityLonInput?.value);

  if (!name || Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    alert(copy("addCityInvalid"));
    return;
  }

  customCities.push({ name, country, lat, lon });
  localStorage.setItem("customCities", JSON.stringify(customCities));

  if (cityNameInput) cityNameInput.value = "";
  if (cityCountryInput) cityCountryInput.value = "";
  if (cityLatInput) cityLatInput.value = "";
  if (cityLonInput) cityLonInput.value = "";

  renderCityList();
  renderForecastCitySelectors();
  updateForecastCitySelectorVisibility();
}

async function loadSuggestions(query) {
  if (!suggestions) return;

  const q = String(query || "").trim();

  if (q.length < 2) {
    suggestions.innerHTML = "";
    return;
  }

  try {
    const res = await fetch(`/api/pokemon-suggestions?q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || copy("suggestionError"));

    const items = Array.isArray(data.suggestions) ? data.suggestions : [];

    suggestions.innerHTML = items
      .map(
        (p) =>
          `<button type="button" class="suggestion" data-name="${escapeHtml(p.frName || p.name)}">
            <img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.frName || p.name)}">
            <span><strong>${escapeHtml(p.frName || p.name)}</strong><small>${escapeHtml(p.name || "")} #${escapeHtml(p.id || "")}</small></span>
          </button>`,
      )
      .join("");

    suggestions.querySelectorAll(".suggestion").forEach((button) => {
      button.addEventListener("click", () => {
        pokemonInput.value = button.dataset.name || "";
        suggestions.innerHTML = "";
        searchPokemon();
      });
    });
  } catch (error) {
    console.error(error);
    suggestions.innerHTML = "";
  }
}

function clearSuggestionsIfOutside(event) {
  if (!suggestions || !pokemonInput) return;

  if (!suggestions.contains(event.target) && event.target !== pokemonInput) {
    suggestions.innerHTML = "";
  }
}

async function searchPokemon() {
  try {
    const pokemonName = pokemonInput?.value.trim();

    if (!pokemonName) {
      if (statusText) statusText.textContent = copy("typePokemon");
      return;
    }

    const mode = searchMode?.value || "now";
    lastSearch = pokemonName;
    currentPage = 1;
    suggestions.innerHTML = "";

    if (mode !== "now") {
      if (results) results.innerHTML = "";
      if (pager) pager.innerHTML = "";
      forecastSection?.classList.remove("hidden");
      if (statusText) {
        statusText.textContent = mode === "7d" ? copy("forecast7Loading") : copy("forecast24Loading");
      }
      if (mode === "7d") syncForecastCitySelectors("search");
      await loadForecast(mode);
      return;
    }

    setLoading(true);
    if (results) results.innerHTML = "";
    if (pager) pager.innerHTML = "";
    if (forecastResults) forecastResults.innerHTML = "";
    if (statusText) statusText.textContent = copy("serverAnalysis");
    track("search_started", { pokemon: pokemonName });

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pokemonName,
        customCities,
        preciseMode: Boolean(useCityGrid?.checked),
        previousDayMode: Boolean(usePreviousDayForecast?.checked),
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || copy("searchError"));

    lastData = data;
    renderPokemon(data.pokemon, data.targetWeathersFr);
    renderResultsPage();
    renderMap(data.cities || []);

    forecastSection?.classList.remove("hidden");
    if (forecastStatus) forecastStatus.textContent = copy("forecastReady");

    const boostedCount = (data.cities || []).filter((c) => c.isBoosted).length;
    if (statusText) {
      statusText.textContent =
        currentLang === "en"
          ? `${boostedCount} city/cities may have the right weather.`
          : `${boostedCount} ville(s) semblent avoir la bonne météo.`;
    }

    track("search_success", { pokemon: pokemonName, boosted: boostedCount });
  } catch (error) {
    console.error(error);
    if (statusText) statusText.textContent = `${copy("searchError")} ${error.message || ""}`.trim();
    track("search_error", { message: error.message || "unknown" });
  } finally {
    setLoading(false);
  }
}

function renderPokemon(p, targetWeathersFr = []) {
  if (!selectedPokemon || !p) return;

  selectedPokemon.classList.remove("hidden");
  selectedPokemon.innerHTML = `
    <img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.frName || p.name)}">
    <div>
      <h2>${escapeHtml(p.frName || p.name)} <small>(${escapeHtml(p.name || "")})</small></h2>
      <div>${(p.typesFr || p.types || []).map((type) => `<span class="type-badge">${escapeHtml(type)}</span>`).join("")}</div>
      <div>${targetWeathersFr.map((weather) => `<span class="weather-badge">${escapeHtml(weather)}</span>`).join("")}</div>
    </div>
  `;
}

function renderResultsPage() {
  if (!lastData || !results) return;

  const cities = Array.isArray(lastData.cities) ? lastData.cities : [];
  const total = cities.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), pages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  renderResults(cities.slice(start, end), lastData.targetWeathersFr || []);

  if (!pager) return;

  pager.innerHTML =
    pages > 1
      ? `<button ${currentPage === 1 ? "disabled" : ""} onclick="changePage(-1)">${copy("previous")}</button>
         <span class="hint">${copy("page")} ${currentPage}/${pages}</span>
         <button ${currentPage === pages ? "disabled" : ""} onclick="changePage(1)">${copy("next")}</button>`
      : "";
}

window.changePage = (dir) => {
  currentPage += dir;
  renderResultsPage();
  if (results) window.scrollTo({ top: results.offsetTop - 120, behavior: "smooth" });
};

function renderResults(cities, targetWeathersFr = []) {
  if (!results) return;

  results.innerHTML = cities
    .map((city) => {
      const coords = `${Number(city.lat).toFixed(4)}, ${Number(city.lon).toFixed(4)}`;
      const details = (city.points || [])
        .map((p) => {
          const m = p.meteoPublic || {};
          const current = m.current || m;
          const previous = m.previous;

          const renderBlock = (title, data) => {
            if (!data) return `<div>${title} : N/A</div>`;

            return `<div class="weather-debug-block">
              <strong>${title}</strong>
              <div>code météo : ${escapeHtml(String(data.weatherCode ?? "N/A"))}</div>
              <div>vent : ${escapeHtml(String(data.windSpeed ?? "N/A"))} km/h</div>
              <div>max vent fenêtre : ${escapeHtml(String(data.windWindowMax ?? "N/A"))} km/h</div>
              <div>nuages : ${escapeHtml(String(data.cloudCover ?? "N/A"))}%</div>
              <div>moyenne nuages fenêtre : ${escapeHtml(String(data.cloudWindowAvg ?? "N/A"))}%</div>
              <div>pluie : ${escapeHtml(String(data.precipitation ?? "N/A"))} mm</div>
              <div>max pluie fenêtre : ${escapeHtml(String(data.rainWindowMax ?? "N/A"))} mm</div>
              <div>Provider : ${escapeHtml(data.source || "Unknown")}</div>
            </div>`;
          };

          return `<div class="weather-debug-block">
            <strong>${escapeHtml(p.zone || "zone")} : ${escapeHtml(p.pogoWeatherFr || p.pogoWeather || "N/A")}</strong>
            <div>Décision : ${escapeHtml(m.decisionReason || "N/A")}</div>
            ${renderBlock("CURRENT FORECAST", current)}
            ${renderBlock("PREVIOUS FORECAST", previous)}
          </div>`;
        })
        .join("");

      return `<article class="result-card ${city.isBoosted ? "match" : ""}">
        <h3>${escapeHtml(city.name)}, ${escapeHtml(city.country)}</h3>
        <div class="coords">${coords}</div>
        <div>Météo dominante estimée : <strong>${escapeHtml(city.dominantWeatherFr || city.dominantWeather || "N/A")}</strong></div>
        <div>Boost recherché : <strong>${targetWeathersFr.map(escapeHtml).join(" / ")}</strong></div>
        <div class="confidence"><span style="--score:${Number(city.confidence || 0)}%"></span></div>
        <strong>${city.isBoosted ? "✅ " + copy("boosted") : "❌ " + copy("notBoosted")} — ${copy("confidence")} ${Number(city.confidence || 0)}%</strong>
        <p class="detail">${city.targetVotes ?? 0}/${city.totalPoints ?? 0} point(s) analysé(s) ont la bonne météo.</p>
        <details class="detail"><summary>${copy("details")}</summary>${details}</details>
        <a class="maps-btn" href="https://www.google.com/maps?q=${city.lat},${city.lon}" target="_blank" rel="noopener noreferrer">${copy("maps")}</a>
        <button class="copy-btn" type="button" onclick="copyCoords('${coords}')">${copy("copyCoords")}</button>
      </article>`;
    })
    .join("");
}

function initMap() {
  if (!window.L || map || !$("map")) return;

  map = L.map("map", { scrollWheelZoom: false }).setView([25, 10], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function renderMap(cities = []) {
  if (!window.L || !$("map")) return;

  initMap();
  if (!markersLayer) return;

  markersLayer.clearLayers();
  const bounds = [];

  cities.forEach((city) => {
    const lat = Number(city.lat);
    const lon = Number(city.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${city.isBoosted ? "#22c55e" : "#ef4444"};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    L.marker([lat, lon], { icon })
      .addTo(markersLayer)
      .bindPopup(
        `<strong>${escapeHtml(city.name)}</strong><br>${escapeHtml(city.dominantWeatherFr || city.dominantWeather || "N/A")}<br>${Number(city.confidence || 0)}% ${copy("confidence")}<br>${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      );

    bounds.push([lat, lon]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

window.copyCoords = async (coords) => {
  try {
    await navigator.clipboard.writeText(coords);
    alert("Coordonnées copiées : " + coords);
  } catch {
    prompt("Copie les coordonnées :", coords);
  }
};

async function loadForecast(forcedHorizon = null) {
  if (!lastSearch) {
    if (forecastStatus) forecastStatus.textContent = copy("noForecastSearch");
    forecastSection?.classList.remove("hidden");
    return;
  }

  const horizon = forcedHorizon || forecastHorizon?.value || "24h";

  if (forecastHorizon) forecastHorizon.value = horizon;
  updateForecastCitySelectorVisibility();

  try {
    if (forecastBtn) forecastBtn.disabled = true;
    if (forecastResults) forecastResults.innerHTML = "";
    if (forecastStatus) forecastStatus.textContent = copy("forecastLoading");

    const res = await fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pokemonName: lastSearch,
        customCities,
        horizon,
        selectedCity: horizon === "7d" ? getSelectedForecastCity(forcedHorizon ? "search" : "panel") : null,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || copy("forecastError"));

    renderPokemon(data.pokemon, data.targetWeathersFr || []);
    renderForecastResults(data);

    if (forecastStatus) {
      forecastStatus.textContent =
        data.horizon === "7d"
          ? currentLang === "en"
            ? `7-day forecast for ${data.cities?.[0]?.name || "selected city"}.`
            : `Prévision 7 jours pour ${data.cities?.[0]?.name || "la ville sélectionnée"}.`
          : currentLang === "en"
            ? `24h forecast across ${data.cities?.length || 0} cities.`
            : `Prévision 24h sur ${data.cities?.length || 0} ville(s).`;
    }
  } catch (error) {
    console.error(error);
    if (forecastStatus) forecastStatus.textContent = copy("forecastError");
    if (forecastResults) {
      forecastResults.innerHTML = `<div class="error">${escapeHtml(error.message || copy("forecastError"))}</div>`;
    }
  } finally {
    if (forecastBtn) forecastBtn.disabled = false;
  }
}

function renderForecastResults(data) {
  if (!forecastResults) return;

  const isSevenDays = data.horizon === "7d";
  const cities = Array.isArray(data.cities) ? data.cities : [];
  const targetLabel = (data.targetWeathersFr || []).map(escapeHtml).join(" / ");

  const labels =
    currentLang === "en"
      ? {
          boostedHours: "Boosted hours",
          analyzedHours: "analyzed hours",
          target: "Target weather",
          best: "Best window",
          noBest: "No clear boost window detected",
          byDay: "Daily summary",
          details: "More details",
          maps: "Google Maps",
          dominant: "Most common weather",
          next: "Next possible boost",
          confidence: "Estimated chance",
        }
      : {
          boostedHours: "Heures boostées",
          analyzedHours: "heures analysées",
          target: "Météo recherchée",
          best: "Meilleur créneau",
          noBest: "Aucun créneau clair détecté",
          byDay: "Résumé par jour",
          details: "Plus de détails",
          maps: "Google Maps",
          dominant: "Météo la plus fréquente",
          next: "Prochain boost possible",
          confidence: "Chance estimée",
        };

  forecastResults.innerHTML = cities
    .slice(0, 12)
    .map((city) => {
      const boostedHours = Number(city.boostedHours || 0);
      const totalHours = Number(city.totalHours || 0);
      const hasBoost = boostedHours > 0;
      const bestWindow = city.bestWindows?.[0] || null;

      const bestText = bestWindow
        ? `${formatForecastTime(bestWindow.start)} → ${formatForecastTime(bestWindow.end)}`
        : labels.noBest;

      const bestWeather = bestWindow
        ? `${escapeHtml(bestWindow.weatherFr || bestWindow.weather)} · ${bestWindow.hours}h`
        : "";

      const nextBoost = city.nextBoostTime
        ? `${formatForecastTime(city.nextBoostTime)} · ${escapeHtml(city.nextBoostWeatherFr || city.nextBoostWeather)}`
        : labels.noBest;

      const timeline = !isSevenDays
        ? `<div class="simple-timeline">${(city.timeline || [])
            .slice(0, 24)
            .map(
              (h) =>
                `<span class="${h.isBoosted ? "on" : ""}" title="${escapeHtml(h.pogoWeatherFr || h.pogoWeather)}">
                  <strong>${escapeHtml(h.hour || String(h.time || "").slice(11, 16))}</strong>
                  <small>${h.isBoosted ? "boost" : escapeHtml(h.pogoWeatherFr || h.pogoWeather || "")}</small>
                </span>`,
            )
            .join("")}</div>`
        : "";

      const daily = isSevenDays
        ? `<section class="forecast-simple-section">
            <h4>${labels.byDay}</h4>
            <div class="simple-days">${(city.dailySummary || [])
              .map(
                (day) =>
                  `<div class="${day.boostedHours ? "on" : ""}">
                    <strong>${formatForecastDate(day.date)}</strong>
                    <span>${day.boostedHours}h boost</span>
                    <small>${escapeHtml(day.dominantWeatherFr || day.dominantWeather || "N/A")}</small>
                  </div>`,
              )
              .join("")}</div>
          </section>`
        : "";

      const windows = city.bestWindows?.length
        ? city.bestWindows
            .map(
              (w) =>
                `<li>
                  <span>${formatForecastTime(w.start)} → ${formatForecastTime(w.end)}</span>
                  <strong>${escapeHtml(w.weatherFr || w.weather)}</strong>
                  <em>${w.hours}h</em>
                </li>`,
            )
            .join("")
        : `<li><span>${labels.noBest}</span></li>`;

      return `<article class="forecast-simple-card ${hasBoost ? "match" : ""}">
        <header>
          <div>
            <h3>${escapeHtml(city.name)}</h3>
            <p>${escapeHtml(city.country)} · ${Number(city.lat).toFixed(4)}, ${Number(city.lon).toFixed(4)}</p>
          </div>
          <div class="forecast-main-score ${hasBoost ? "good" : ""}">
            <strong>${boostedHours}h</strong>
            <span>/${totalHours}h</span>
          </div>
        </header>

        <div class="forecast-big-summary">
          <div>
            <span>${labels.target}</span>
            <strong>${targetLabel}</strong>
          </div>
          <div>
            <span>${labels.boostedHours}</span>
            <strong>${boostedHours} ${labels.analyzedHours}</strong>
          </div>
          <div>
            <span>${labels.best}</span>
            <strong>${bestText}</strong>
            ${bestWeather ? `<small>${bestWeather}</small>` : ""}
          </div>
        </div>

        ${timeline}
        ${daily}

        <details class="forecast-simple-details">
          <summary>${labels.details}</summary>
          <div class="forecast-extra-grid">
            <div><span>${labels.next}</span><strong>${nextBoost}</strong></div>
            <div><span>${labels.dominant}</span><strong>${escapeHtml(city.dominantWeatherFr || city.dominantWeather || "N/A")}</strong></div>
            <div><span>${labels.confidence}</span><strong>${Number(city.confidence || 0)}%</strong></div>
          </div>
          <ul class="best-window-list">${windows}</ul>
        </details>

        <a class="maps-btn forecast-map-btn" href="https://www.google.com/maps?q=${city.lat},${city.lon}" target="_blank" rel="noopener noreferrer">${labels.maps}</a>
      </article>`;
    })
    .join("");
}

function formatForecastTime(time) {
  if (!time) return "N/A";
  const raw = String(time);
  const date = raw.slice(5, 10);
  const hour = raw.slice(11, 16);
  return `${date} ${hour}`;
}

function formatForecastDate(date) {
  if (!date) return "N/A";
  return String(date).slice(5);
}

function track(name, params = {}) {
  try {
    window.gtag?.("event", name, params);
  } catch {
    // analytics must never break the app
  }
}


function getInitialUrlState() {
  const params = new URLSearchParams(window.location.search);

  const pokemon = params.get("pokemon") || params.get("q") || "";
  const mode = params.get("mode") || "now";
  const autoSearch = params.get("autoSearch") === "1" || Boolean(pokemon);

  return {
    pokemon: pokemon.trim(),
    mode: ["now", "24h", "7d"].includes(mode) ? mode : "now",
    autoSearch,
  };
}

function applyInitialUrlState() {
  const state = getInitialUrlState();

  if (!state.pokemon || !pokemonInput) return;

  pokemonInput.value = state.pokemon;
  setSearchMode(state.mode);

  if (state.autoSearch) {
    window.setTimeout(() => {
      searchPokemon();
    }, 150);
  }
}

function bindEvents() {
  languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.lang));
  });

  searchModeButtons.forEach((button) => {
    button.addEventListener("click", () => setSearchMode(button.dataset.searchMode));
  });

  forecastHorizonButtons.forEach((button) => {
    button.addEventListener("click", () => setForecastHorizonMode(button.dataset.forecastHorizon));
  });

  forecastCitySelect?.addEventListener("change", () => syncForecastCitySelectors("search"));
  forecastPanelCitySelect?.addEventListener("change", () => syncForecastCitySelectors("panel"));
  searchBtn?.addEventListener("click", searchPokemon);
  refreshBtn?.addEventListener("click", () => (lastSearch ? searchPokemon() : null));
  forecastBtn?.addEventListener("click", () => loadForecast());

  pokemonInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      suggestions.innerHTML = "";
      searchPokemon();
    }
  });

  pokemonInput?.addEventListener("input", () => {
    clearTimeout(suggestionTimer);
    const query = pokemonInput.value.trim();

    if (query.length < 2) {
      if (suggestions) suggestions.innerHTML = "";
      return;
    }

    suggestionTimer = setTimeout(() => loadSuggestions(query), 180);
  });

  document.addEventListener("click", clearSuggestionsIfOutside);
  themeToggle?.addEventListener("click", toggleTheme);
  addCityBtn?.addEventListener("click", addCustomCity);
}

function boot() {
  bindEvents();
  initTheme();
  renderCityList();
  renderForecastCitySelectors();
  applyTranslations();
  updateForecastCitySelectorVisibility();

  if (forecastStatus && !lastSearch) {
    forecastStatus.textContent = copy("forecastHint");
  }

  applyInitialUrlState();

  window.addEventListener("load", initMap);
}

boot();
