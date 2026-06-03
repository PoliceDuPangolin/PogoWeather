import { translations } from "./translations.js"



let currentLang = localStorage.getItem("lang") || "fr";

function t(key) {
  return translations[currentLang]?.[key] || key;
}

const languageSelect = document.getElementById("languageSelect");
const languageButtons = document.querySelectorAll("[data-lang]");

function setLanguage(lang) {
  currentLang = lang === "en" ? "en" : "fr";
  localStorage.setItem("lang", currentLang);

  if (languageSelect) {
    languageSelect.value = currentLang;
  }

  languageButtons.forEach((button) => {
    const active = button.dataset.lang === currentLang;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  applyTranslations();
}

languageSelect?.addEventListener("change", (e) => {
  setLanguage(e.target.value);
});

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
  });
});
const searchModeButtons = document.querySelectorAll("[data-search-mode]");
const forecastHorizonButtons = document.querySelectorAll("[data-forecast-horizon]");
const $ = (id) => document.getElementById(id);
const pokemonInput = $("pokemonInput"),
  suggestions = $("pokemonSuggestions"),
  searchBtn = $("searchBtn"),
  refreshBtn = $("refreshBtn"),
  results = $("results"),
  statusText = $("statusText"),
  selectedPokemon = $("selectedPokemon"),
  useCityGrid = $("useCityGrid"),
  usePreviousDayForecast = $("usePreviousDayForecast"),
  searchMode = $("searchMode"),
  forecastCitySelectorWrap = $("forecastCitySelectorWrap"),
  forecastCitySelect = $("forecastCitySelect"),
  forecastPanelCitySelect = $("forecastPanelCitySelect"),
  loader = $("loader"),
  themeToggle = $("themeToggle"),
  cityNameInput = $("cityNameInput"),
  cityCountryInput = $("cityCountryInput"),
  cityLatInput = $("cityLatInput"),
  cityLonInput = $("cityLonInput"),
  addCityBtn = $("addCityBtn"),
  cityList = $("cityList"),
  pager = $("pager"),
  forecastSection = $("forecastSection"),
  forecastBtn = $("forecastBtn"),
  forecastHorizon = $("forecastHorizon"),
  forecastStatus = $("forecastStatus"),
  forecastResults = $("forecastResults");
let customCities = JSON.parse(localStorage.getItem("customCities") || "[]"),
  map,
  markersLayer,
  lastData = null,
  lastSearch = null,
  currentPage = 1;
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

function initTheme() {
  const s = localStorage.getItem("theme"),
    p =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (s === "dark" || (!s && p)) {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  } else themeToggle.textContent = "🌙";
}
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const d = document.body.classList.contains("dark");
  localStorage.setItem("theme", d ? "dark" : "light");
  themeToggle.textContent = d ? "☀️" : "🌙";
});

function getForecastCityOptions() {
  const map = new Map();

  [...DEFAULT_FORECAST_CITIES, ...customCities].forEach((city) => {
    const key = `${Number(city.lat).toFixed(4)},${Number(city.lon).toFixed(4)}`;
    map.set(key, city);
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

  if (forecastCitySelect) {
    const previous = forecastCitySelect.value;
    forecastCitySelect.innerHTML = options;
    if (previous && Number(previous) < cities.length) {
      forecastCitySelect.value = previous;
    }
  }

  if (forecastPanelCitySelect) {
    const previous = forecastPanelCitySelect.value;
    forecastPanelCitySelect.innerHTML = options;
    if (previous && Number(previous) < cities.length) {
      forecastPanelCitySelect.value = previous;
    }
  }
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
  updateForecastCitySelectorVisibility();

  const copy = HOME_COPY[currentLang] || HOME_COPY.fr;

  if (cleanMode === "now") {
    statusText.textContent = copy.currentSelected;
    return;
  }

  forecastSection?.classList.remove("hidden");

  if (forecastHorizon) {
    forecastHorizon.value = cleanMode === "7d" ? "7d" : "24h";
  }

  updateForecastCitySelectorVisibility();

  if (forecastStatus) {
    forecastStatus.textContent =
      cleanMode === "7d"
        ? copy.forecast7Selected
        : copy.forecast24Selected;
  }
}

function setForecastHorizonMode(mode) {
  if (!forecastHorizon) return;

  const cleanMode = mode === "7d" ? "7d" : "24h";
  forecastHorizon.value = cleanMode;
  updateForecastCitySelectorVisibility();

  if (cleanMode === "7d") {
    forecastStatus.textContent =
      currentLang === "en"
        ? "7-day mode analyzes one city only to stay fast."
        : "Le mode 7 jours analyse une seule ville pour rester rapide.";
  }
}

searchModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSearchMode(button.dataset.searchMode);
  });
});

forecastHorizonButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setForecastHorizonMode(button.dataset.forecastHorizon);
  });
});


forecastCitySelect?.addEventListener("change", () => syncForecastCitySelectors("search"));
forecastPanelCitySelect?.addEventListener("change", () => syncForecastCitySelectors("panel"));

searchBtn.addEventListener("click", searchPokemon);
refreshBtn.addEventListener("click", () =>
  lastSearch ? searchPokemon() : null,
);
pokemonInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchPokemon();
});
async function searchPokemon() {
  try {
    const pokemonName = pokemonInput.value.trim();
    if (!pokemonName) {
      statusText.textContent = "Tape un Pokémon.";
      return;
    }
    const mode = searchMode?.value || "now";
    if (mode !== "now") {
      lastSearch = pokemonName;
      currentPage = 1;
      results.innerHTML = "";
      pager.innerHTML = "";
      forecastSection?.classList.remove("hidden");
      statusText.textContent = mode === "7d" ? "Prévision sur 7 jours..." : "Prévision sur 24h...";
      if (mode === "7d") syncForecastCitySelectors("search");
      await loadForecast(mode);
      return;
    }

    lastSearch = pokemonName;
    currentPage = 1;
    setLoading(true);
    results.innerHTML = "";
    pager.innerHTML = "";
    statusText.textContent = "Analyse côté serveur...";
    track("search_started", { pokemon: pokemonName });
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pokemonName,
        customCities,
        preciseMode: useCityGrid.checked,
        previousDayMode: usePreviousDayForecast.checked,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur API.");
    lastData = data;
    renderPokemon(data.pokemon, data.targetWeathersFr);
    renderResultsPage();
    renderMap(data.cities);
    forecastSection?.classList.remove("hidden");
    if (forecastResults) forecastResults.innerHTML = "";
    if (forecastStatus) forecastStatus.textContent = "Tu peux maintenant calculer les meilleures fenêtres de boost météo.";
    statusText.textContent = `${data.cities.filter((c) => c.isBoosted).length} ville(s) semblent avoir la bonne météo.`;
    track("search_success", { pokemon: data.pokemon.name });
  } catch (e) {
    console.error(e);
    statusText.textContent = "Erreur.";
    results.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`;
    track("search_error", { message: e.message });
  } finally {
    setLoading(false);
  }
}
function renderPokemon(p, targetWeathersFr) {
  selectedPokemon.classList.remove("hidden");
  selectedPokemon.innerHTML = `<img loading="lazy" src="${p.image}" alt="${escapeHtml(p.frName)}"><div><h2>${escapeHtml(p.frName)} <small>(${escapeHtml(p.name)})</small></h2><div>${p.typesFr.map((t) => `<span class="type-badge">${escapeHtml(t)}</span>`).join("")}</div><div>${targetWeathersFr.map((w) => `<span class="weather-badge">${escapeHtml(w)}</span>`).join("")}</div></div>`;
}
function renderResultsPage() {
  if (!lastData) return;
  const total = lastData.cities.length,
    pages = Math.ceil(total / PAGE_SIZE),
    start = (currentPage - 1) * PAGE_SIZE,
    end = start + PAGE_SIZE;
  renderResults(lastData.cities.slice(start, end), lastData.targetWeathersFr);
  pager.innerHTML =
    pages > 1
      ? `<button ${currentPage === 1 ? "disabled" : ""} onclick="changePage(-1)">Précédent</button><span class="hint">Page ${currentPage}/${pages}</span><button ${currentPage === pages ? "disabled" : ""} onclick="changePage(1)">Suivant</button>`
      : "";
}
window.changePage = (dir) => {
  currentPage += dir;
  renderResultsPage();
  window.scrollTo({ top: results.offsetTop - 120, behavior: "smooth" });
};
function renderResults(cities, targetWeathersFr) {
  results.innerHTML = cities
    .map((city) => {
      const coords = `${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}`;
      const details = city.points
        .map((p) => {
          const m = p.meteoPublic || {};
          return `<div class="weather-debug-block"><strong>${escapeHtml(p.zone)} : ${escapeHtml(p.pogoWeatherFr)}</strong><div>code météo : ${escapeHtml(String(m.weatherCode ?? "N/A"))}</div><div>vent : ${escapeHtml(String(m.windSpeed ?? "N/A"))} km/h</div><div>max vent fenêtre : ${escapeHtml(String(m.windWindowMax ?? "N/A"))} km/h</div><div>nuages : ${escapeHtml(String(m.cloudCover ?? "N/A"))}%</div><div>moyenne nuages fenêtre : ${escapeHtml(String(m.cloudWindowAvg ?? "N/A"))}%</div><div>pluie : ${escapeHtml(String(m.precipitation ?? "N/A"))} mm</div><div>max pluie fenêtre : ${escapeHtml(String(m.rainWindowMax ?? "N/A"))} mm</div><div>Provider affiché : ${escapeHtml(m.source || "Unknown")}</div><div>Remarque :</div></div>`;
        })
        .join("");
      return `<article class="result-card ${city.isBoosted ? "match" : ""}"><h3>${escapeHtml(city.name)}, ${escapeHtml(city.country)}</h3><div class="coords">${coords}</div><div>Météo dominante estimée : <strong>${escapeHtml(city.dominantWeatherFr)}</strong></div><div>Boost recherché : <strong>${targetWeathersFr.map(escapeHtml).join(" / ")}</strong></div><div class="confidence"><span style="--score:${city.confidence}%"></span></div><strong>${city.isBoosted ? "✅ Boost probable" : "❌ Pas boosté"} — confiance ${city.confidence}%</strong><p class="detail">${city.targetVotes}/${city.totalPoints} point(s) analysé(s) ont la bonne météo.</p><details class="detail"><summary>Détails météo</summary>${details}</details><a class="maps-btn" href="https://www.google.com/maps?q=${city.lat},${city.lon}" target="_blank" rel="noopener noreferrer">Google Maps</a><button class="copy-btn" onclick="copyCoords('${coords}')">Copier coords</button></article>`;
    })
    .join("");
}
function initMap() {
  if (!window.L || map) return;
  map = L.map("map", { scrollWheelZoom: false }).setView([25, 10], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}
function renderMap(cities) {
  if (!window.L) return;
  initMap();
  markersLayer.clearLayers();
  const bounds = [];
  cities.forEach((city) => {
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${city.isBoosted ? "#22c55e" : "#ef4444"};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    L.marker([city.lat, city.lon], { icon })
      .addTo(markersLayer)
      .bindPopup(
        `<strong>${escapeHtml(city.name)}</strong><br>${escapeHtml(city.dominantWeatherFr)}<br>${city.confidence}% confiance<br>${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}`,
      );
    bounds.push([city.lat, city.lon]);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
}
window.copyCoords = async (coords) => {
  try {
    await navigator.clipboard.writeText(coords);
    alert("Coordonnées copiées : " + coords);
  } catch {
    prompt("Copie les coordonnées :", coords);
  }
};

forecastBtn?.addEventListener("click", loadForecast);

async function loadForecast(forcedHorizon = null) {
  if (!lastSearch) {
    forecastStatus.textContent = "Lance d'abord une recherche Pokémon.";
    forecastSection?.classList.remove("hidden");
    return;
  }

  if (forcedHorizon && forecastHorizon) {
    forecastHorizon.value = forcedHorizon;
    updateForecastCitySelectorVisibility();
  }

  try {
    if (forecastBtn) forecastBtn.disabled = true;
    forecastResults.innerHTML = "";
    forecastStatus.textContent = "Calcul des prévisions météo...";

    const res = await fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pokemonName: lastSearch,
        customCities,
        horizon: forcedHorizon || forecastHorizon.value || "24h",
        selectedCity:
          (forcedHorizon || forecastHorizon.value || "24h") === "7d"
            ? getSelectedForecastCity(forcedHorizon ? "search" : "panel")
            : null,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Erreur prévision.");

    renderPokemon(data.pokemon, data.targetWeathersFr);
    renderForecastResults(data);
    forecastStatus.textContent =
      data.horizon === "7d"
        ? `1 ville analysée sur 7 jours : ${data.cities[0]?.name || "ville sélectionnée"}.`
        : `${data.cities.length} ville(s) analysée(s) sur 24h.`;
  } catch (error) {
    console.error(error);
    forecastStatus.textContent = "Erreur prévision météo.";
    forecastResults.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  } finally {
    if (forecastBtn) forecastBtn.disabled = false;
  }
}

function renderForecastResults(data) {
  const isSevenDays = data.horizon === "7d";
  const targetLabel = data.targetWeathersFr.map(escapeHtml).join(" / ");

  forecastResults.innerHTML = data.cities
    .slice(0, 12)
    .map((city) => {
      const nextBoost = city.nextBoostTime
        ? `${formatForecastTime(city.nextBoostTime)} · ${escapeHtml(city.nextBoostWeatherFr || city.nextBoostWeather)}`
        : "Aucune fenêtre détectée";

      const windows = city.bestWindows?.length
        ? city.bestWindows
            .map((w) => `<li>${formatForecastTime(w.start)} → ${formatForecastTime(w.end)} · ${escapeHtml(w.weatherFr || w.weather)} · ${w.hours}h</li>`)
            .join("")
        : "<li>Aucune fenêtre boostée détectée.</li>";

      const summary = isSevenDays
        ? `<div class="daily-summary">${(city.dailySummary || [])
            .map((day) => `<div class="day-pill ${day.boostedHours ? "boosted" : ""}"><strong>${formatForecastDate(day.date)}</strong><span>${day.boostedHours}/${day.totalHours}h boost</span><small>${escapeHtml(day.dominantWeatherFr)}</small></div>`)
            .join("")}</div>`
        : "";

      const timeline = !isSevenDays
        ? `<div class="forecast-timeline">${(city.timeline || [])
            .slice(0, 24)
            .map((h) => `<span class="forecast-hour ${h.isBoosted ? "boosted" : ""}" title="${escapeHtml(h.pogoWeatherFr)}">
              <strong>${escapeHtml(h.hour)}</strong>
              <small>${h.isBoosted ? "✅" : "—"}</small>
            </span>`)
            .join("")}</div>`
        : "";

      return `<article class="forecast-card ${city.boostedHours ? "match" : ""}">
        <h3>${escapeHtml(city.name)}, ${escapeHtml(city.country)}</h3>
        <div class="coords">${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}</div>
        <p><strong>Boost recherché :</strong> ${targetLabel}</p>
        <p><strong>Heures boostées :</strong> ${city.boostedHours}/${city.totalHours}h · ${city.confidence}%</p>
        <p><strong>Prochaine fenêtre :</strong> ${nextBoost}</p>
        <p><strong>Météo dominante prévue :</strong> ${escapeHtml(city.dominantWeatherFr)}</p>
        ${timeline}
        ${summary}
        <details>
          <summary>Meilleures fenêtres</summary>
          <ul>${windows}</ul>
        </details>
        <a class="maps-btn" href="https://www.google.com/maps?q=${city.lat},${city.lon}" target="_blank" rel="noopener noreferrer">Google Maps</a>
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
  if (window.gtag) window.gtag("event", name, params);
}
function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[m],
  );
}

const HOME_COPY = {
  fr: {
    heroEyebrow: "Outil non officiel Pokémon GO",
    heroSubtitle: "Trouve rapidement les villes où ton Pokémon a le plus de chances d’être boosté météo dans Pokémon GO.",
    searchTitle: "Weather Boost Finder",
    searchHint: "Tape un Pokémon, puis PogoWeather analyse les hotspots configurés côté serveur.",
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
    forecastBtn: "Voir la prévision",
    currentSelected: "Mode météo actuelle sélectionné.",
    forecast24Selected: "Mode prévision 24h sélectionné. Lance une recherche Pokémon.",
    forecast7Selected: "Mode prévision 7 jours sélectionné. Choisis une ville puis lance une recherche Pokémon.",
  },
  en: {
    heroEyebrow: "Unofficial Pokémon GO tool",
    heroSubtitle: "Quickly find cities where your Pokémon is more likely to be weather boosted in Pokémon GO.",
    searchTitle: "Weather Boost Finder",
    searchHint: "Enter a Pokémon, then PogoWeather analyzes configured hotspots server-side.",
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
    forecastBtn: "Show forecast",
    currentSelected: "Current weather mode selected.",
    forecast24Selected: "24h forecast mode selected. Search a Pokémon.",
    forecast7Selected: "7-day forecast mode selected. Choose a city, then search a Pokémon.",
  },
};

function applyTranslations() {
  const copy = HOME_COPY[currentLang] || HOME_COPY.fr;
  document.documentElement.lang = currentLang;

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  };

  setText(".hero .eyebrow", copy.heroEyebrow);
  setText(".hero .hero-subtitle", copy.heroSubtitle);
  setText(".search-card h2", copy.searchTitle);
  setText(".search-card .hint", copy.searchHint);
  setText("label[for='pokemonInput']", copy.pokemonLabel);
  setText("#searchBtn", copy.searchButton);
  setText("#refreshBtn", copy.refreshButton);
  setText("#searchModeLabel", copy.modeLabel);

  setText("[data-search-mode='now'] strong", copy.modeNowTitle);
  setText("[data-search-mode='now'] span", copy.modeNowSub);
  setText("[data-search-mode='24h'] strong", copy.mode24Title);
  setText("[data-search-mode='24h'] span", copy.mode24Sub);
  setText("[data-search-mode='7d'] strong", copy.mode7Title);
  setText("[data-search-mode='7d'] span", copy.mode7Sub);

  setText("[data-forecast-horizon='24h'] strong", copy.mode24Title);
  setText("[data-forecast-horizon='24h'] span", copy.mode24Sub);
  setText("[data-forecast-horizon='7d'] strong", copy.mode7Title);
  setText("[data-forecast-horizon='7d'] span", copy.mode7Sub);

  setText("label[for='forecastCitySelect']", copy.city7Label);
  setText("#forecastCitySelectorWrap small", copy.city7Help);
  setText("#forecastSection h2", copy.forecastTitle);
  setText("#forecastBtn", copy.forecastBtn);

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

function setLoading(v) {
  loader?.classList.toggle("hidden", !v);

  if (searchBtn) searchBtn.disabled = v;
  if (refreshBtn) refreshBtn.disabled = v;
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

initTheme();
renderCityList();
renderForecastCitySelectors();
setLanguage(currentLang);
updateForecastCitySelectorVisibility();
window.addEventListener("load", initMap);
