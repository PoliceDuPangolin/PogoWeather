const $ = id => document.getElementById(id);

const pokemonInput = $("pokemonInput");
const suggestions = $("pokemonSuggestions");
const searchBtn = $("searchBtn");
const refreshBtn = $("refreshBtn");
const results = $("results");
const statusText = $("statusText");
const selectedPokemon = $("selectedPokemon");
const useCityGrid = $("useCityGrid");
const usePreviousDayForecast = $("usePreviousDayForecast");
const loader = $("loader");
const themeToggle = $("themeToggle");
const cityNameInput = $("cityNameInput");
const cityCountryInput = $("cityCountryInput");
const cityLatInput = $("cityLatInput");
const cityLonInput = $("cityLonInput");
const addCityBtn = $("addCityBtn");
const cityList = $("cityList");
const pager = $("pager");

let customCities = JSON.parse(localStorage.getItem("customCities") || "[]");
let map;
let markersLayer;
let lastData = null;
let lastSearch = null;
let currentPage = 1;

const PAGE_SIZE = 9;

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  if (saved === "dark" || (!saved && prefersDark)) {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  } else {
    themeToggle.textContent = "🌙";
  }
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  themeToggle.textContent = isDark ? "☀️" : "🌙";
});

function setLoading(isLoading) {
  loader.classList.toggle("hidden", !isLoading);
  searchBtn.disabled = isLoading;
  refreshBtn.disabled = isLoading;
}

function renderCityList() {
  cityList.innerHTML = customCities
    .map((city, index) => `
      <span class="city-pill">
        ${escapeHtml(city.name)}
        <button data-i="${index}" aria-label="Remove ${escapeHtml(city.name)}">×</button>
      </span>
    `)
    .join("");

  cityList.querySelectorAll("[data-i]").forEach(button => {
    button.addEventListener("click", () => {
      customCities.splice(Number(button.dataset.i), 1);
      localStorage.setItem("customCities", JSON.stringify(customCities));
      renderCityList();
    });
  });
}

addCityBtn.addEventListener("click", () => {
  const name = cityNameInput.value.trim();
  const country = cityCountryInput.value.trim() || "Custom";
  const lat = Number(cityLatInput.value);
  const lon = Number(cityLonInput.value);

  if (!name || Number.isNaN(lat) || Number.isNaN(lon)) {
    alert("Please enter a valid city name, latitude, and longitude.");
    return;
  }

  customCities.push({ name, country, lat, lon });
  localStorage.setItem("customCities", JSON.stringify(customCities));

  cityNameInput.value = "";
  cityCountryInput.value = "";
  cityLatInput.value = "";
  cityLonInput.value = "";

  renderCityList();
});

let suggestionTimer = null;

pokemonInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);

  const query = pokemonInput.value.trim();

  if (query.length < 2) {
    suggestions.innerHTML = "";
    return;
  }

  suggestionTimer = setTimeout(() => loadSuggestions(query), 180);
});

async function loadSuggestions(query) {
  try {
    const response = await fetch(`/api/pokemon-suggestions?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    suggestions.innerHTML = (data.suggestions || [])
      .map(pokemon => `
        <div class="suggestion" data-name="${escapeHtml(pokemon.name)}">
          <img loading="lazy" src="${pokemon.image}" alt="${escapeHtml(pokemon.name)}">
          <div>
            <strong>${escapeHtml(capitalizePokemonName(pokemon.name))}</strong><br>
            <small>${escapeHtml(pokemon.frName)} #${pokemon.id}</small>
          </div>
        </div>
      `)
      .join("");

    suggestions.querySelectorAll(".suggestion").forEach(element => {
      element.addEventListener("click", () => {
        pokemonInput.value = element.dataset.name;
        suggestions.innerHTML = "";
        searchPokemon();
      });
    });
  } catch {
    suggestions.innerHTML = "";
  }
}

document.addEventListener("click", event => {
  if (suggestions && !suggestions.contains(event.target) && event.target !== pokemonInput) {
    suggestions.innerHTML = "";
  }
});

searchBtn.addEventListener("click", searchPokemon);
refreshBtn.addEventListener("click", () => lastSearch ? searchPokemon() : null);

pokemonInput.addEventListener("keydown", event => {
  if (event.key === "Enter") searchPokemon();
});

async function searchPokemon() {
  try {
    const pokemonName = pokemonInput.value.trim();

    if (!pokemonName) {
      statusText.textContent = "Type a Pokémon first.";
      return;
    }

    lastSearch = pokemonName;
    currentPage = 1;

    setLoading(true);
    results.innerHTML = "";
    pager.innerHTML = "";
    statusText.textContent = "Analyzing weather on the server...";

    track("search_started", { pokemon: pokemonName });

    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pokemonName,
        customCities,
        preciseMode: useCityGrid.checked,
        previousDayMode: usePreviousDayForecast.checked
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "API error.");
    }

    lastData = data;

    renderPokemon(data.pokemon, data.targetWeathersFr);
    renderResultsPage();
    renderMap(data.cities);

    const boostedCount = data.cities.filter(city => city.isBoosted).length;
    statusText.textContent = `${boostedCount} city/cities appear to have the right weather.`;

    track("search_success", { pokemon: data.pokemon.name });
  } catch (error) {
    console.error(error);
    statusText.textContent = "Error.";
    results.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    track("search_error", { message: error.message });
  } finally {
    setLoading(false);
  }
}

function renderPokemon(pokemon, targetWeathers) {
  selectedPokemon.classList.remove("hidden");

  selectedPokemon.innerHTML = `
    <img loading="lazy" src="${pokemon.image}" alt="${escapeHtml(pokemon.name)}">
    <div>
      <h2>${escapeHtml(capitalizePokemonName(pokemon.name))} <small>#${pokemon.id}</small></h2>
      <div>${pokemon.typesFr.map(type => `<span class="type-badge">${escapeHtml(type)}</span>`).join("")}</div>
      <div>${targetWeathers.map(weather => `<span class="weather-badge">${escapeHtml(weather)}</span>`).join("")}</div>
    </div>
  `;
}

function renderResultsPage() {
  if (!lastData) return;

  const total = lastData.cities.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  renderResults(lastData.cities.slice(start, end), lastData.targetWeathersFr);

  pager.innerHTML = pages > 1
    ? `
      <button ${currentPage === 1 ? "disabled" : ""} onclick="changePage(-1)">Previous</button>
      <span class="hint">Page ${currentPage}/${pages}</span>
      <button ${currentPage === pages ? "disabled" : ""} onclick="changePage(1)">Next</button>
    `
    : "";
}

window.changePage = direction => {
  currentPage += direction;
  renderResultsPage();
  window.scrollTo({ top: results.offsetTop - 120, behavior: "smooth" });
};

function renderResults(cities, targetWeathers) {
  results.innerHTML = cities
    .map(city => {
      const coords = `${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}`;

      const details = city.points
        .map(point => `
          <div>
            <strong>${escapeHtml(point.zone)}:</strong>
            ${escapeHtml(point.pogoWeatherFr)}
            — ${escapeHtml(point.meteoPublic.source)}
            — weather code ${escapeHtml(point.meteoPublic.weatherCode)}
            — wind ${point.meteoPublic.windSpeed} km/h,
            clouds ${point.meteoPublic.cloudCover}%,
            rain ${point.meteoPublic.precipitation} mm
          </div>
        `)
        .join("");

      return `
        <article class="result-card ${city.isBoosted ? "match" : ""}">
          <h3>${escapeHtml(city.name)}, ${escapeHtml(city.country)}</h3>
          <div class="coords">${coords}</div>

          <div>Estimated dominant weather: <strong>${escapeHtml(city.dominantWeatherFr)}</strong></div>
          <div>Target boost: <strong>${targetWeathers.map(escapeHtml).join(" / ")}</strong></div>

          <div class="confidence">
            <span style="--score:${city.confidence}%"></span>
          </div>

          <strong>${city.isBoosted ? "✅ Likely boosted" : "❌ Not boosted"} — ${city.confidence}% confidence</strong>

          <p class="detail">${city.targetVotes}/${city.totalPoints} analyzed point(s) match the target weather.</p>

          <details class="detail">
            <summary>Weather details</summary>
            ${details}
          </details>

          <a class="maps-btn" href="https://www.google.com/maps?q=${city.lat},${city.lon}" target="_blank" rel="noopener noreferrer">Google Maps</a>
          <button class="copy-btn" onclick="copyCoords('${coords}')">Copy coords</button>
        </article>
      `;
    })
    .join("");
}

function initMap() {
  if (!window.L || map) return;

  map = L.map("map", { scrollWheelZoom: false }).setView([25, 10], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function renderMap(cities) {
  if (!window.L) return;

  initMap();
  markersLayer.clearLayers();

  const bounds = [];

  cities.forEach(city => {
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:50%;background:${city.isBoosted ? "#22c55e" : "#ef4444"};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    L.marker([city.lat, city.lon], { icon })
      .addTo(markersLayer)
      .bindPopup(`
        <strong>${escapeHtml(city.name)}</strong><br>
        ${escapeHtml(city.dominantWeatherFr)}<br>
        ${city.confidence}% confidence<br>
        ${city.lat.toFixed(4)}, ${city.lon.toFixed(4)}
      `);

    bounds.push([city.lat, city.lon]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
}

window.copyCoords = async coords => {
  try {
    await navigator.clipboard.writeText(coords);
    alert("Coordinates copied: " + coords);
  } catch {
    prompt("Copy the coordinates:", coords);
  }
};

function track(name, params = {}) {
  if (window.gtag) window.gtag("event", name, params);
}

function capitalizePokemonName(name) {
  return String(name)
    .split("-")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

initTheme();
renderCityList();

window.addEventListener("load", initMap);
