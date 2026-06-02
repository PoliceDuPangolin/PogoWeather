import { translations } from "./translations.js"



let currentLang = localStorage.getItem("lang") || "fr";

function t(key) {
  return translations[currentLang][key] || key;
}
const languageSelect = document.getElementById("languageSelect");

languageSelect.value = currentLang;

languageSelect.addEventListener("change", (e) => {
  currentLang = e.target.value;

  localStorage.setItem("lang", currentLang);

  applyTranslations();
});
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
  loader = $("loader"),
  themeToggle = $("themeToggle"),
  cityNameInput = $("cityNameInput"),
  cityCountryInput = $("cityCountryInput"),
  cityLatInput = $("cityLatInput"),
  cityLonInput = $("cityLonInput"),
  addCityBtn = $("addCityBtn"),
  cityList = $("cityList"),
  pager = $("pager");
let customCities = JSON.parse(localStorage.getItem("customCities") || "[]"),
  map,
  markersLayer,
  lastData = null,
  lastSearch = null,
  currentPage = 1;
const PAGE_SIZE = 9;
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
function setLoading(v) {
  loader.classList.toggle("hidden", !v);
  searchBtn.disabled = v;
  refreshBtn.disabled = v;
}
function renderCityList() {
  cityList.innerHTML = customCities
    .map(
      (c, i) =>
        `<span class="city-pill">${escapeHtml(c.name)}<button data-i="${i}">×</button></span>`,
    )
    .join("");
  cityList.querySelectorAll("[data-i]").forEach((b) =>
    b.addEventListener("click", () => {
      customCities.splice(Number(b.dataset.i), 1);
      localStorage.setItem("customCities", JSON.stringify(customCities));
      renderCityList();
    }),
  );
}
addCityBtn.addEventListener("click", () => {
  const name = cityNameInput.value.trim(),
    country = cityCountryInput.value.trim() || "Personnalisé",
    lat = Number(cityLatInput.value),
    lon = Number(cityLonInput.value);
  if (!name || Number.isNaN(lat) || Number.isNaN(lon))
    return alert("Coordonnées invalides.");
  customCities.push({ name, country, lat, lon });
  localStorage.setItem("customCities", JSON.stringify(customCities));
  cityNameInput.value =
    cityCountryInput.value =
    cityLatInput.value =
    cityLonInput.value =
      "";
  renderCityList();
});
let suggestionTimer = null;
pokemonInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  const q = pokemonInput.value.trim();
  if (q.length < 2) {
    suggestions.innerHTML = "";
    return;
  }
  suggestionTimer = setTimeout(() => loadSuggestions(q), 180);
});
async function loadSuggestions(q) {
  try {
    const res = await fetch(
        `/api/pokemon-suggestions?q=${encodeURIComponent(q)}`,
      ),
      data = await res.json();
    suggestions.innerHTML = (data.suggestions || [])
      .map(
        (p) =>
          `<div class="suggestion" data-name="${p.frName}"><img loading="lazy" src="${p.image}" alt="${escapeHtml(p.frName)}"><div><strong>${escapeHtml(p.frName)}</strong><br><small>${escapeHtml(p.name)} #${p.id}</small></div></div>`,
      )
      .join("");
    suggestions.querySelectorAll(".suggestion").forEach((el) =>
      el.addEventListener("click", () => {
        pokemonInput.value = el.dataset.name;
        suggestions.innerHTML = "";
        searchPokemon();
      }),
    );
  } catch {}
}
document.addEventListener("click", (e) => {
  if (
    suggestions &&
    !suggestions.contains(e.target) &&
    e.target !== pokemonInput
  )
    suggestions.innerHTML = "";
});
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
initTheme();
renderCityList();
window.addEventListener("load", initMap);
