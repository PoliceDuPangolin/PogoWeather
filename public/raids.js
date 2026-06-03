const raidTool = document.querySelector(".raid-tool");

if (raidTool) {
  const lang = raidTool.dataset.lang || "en";
  const statusEl = document.getElementById("raidStatus");
  const tableBody = document.getElementById("raidTableBody");
  const cardsEl = document.getElementById("raidCards");
  const searchInput = document.getElementById("raidSearchInput");
  const tierFilter = document.getElementById("raidTierFilter");
  const weatherFilter = document.getElementById("raidWeatherFilter");
  const refreshBtn = document.getElementById("raidRefreshBtn");

  const WEATHER_FR = {
    Clear: "Clair",
    "Partly Cloudy": "Partiellement nuageux",
    Cloudy: "Nuageux",
    Rainy: "Pluvieux",
    Snow: "Neige",
    Windy: "Venteux",
    Fog: "Brouillard"
  };

  const texts = {
    en: {
      loading: "Loading current raid bosses...",
      loaded: (count, date) => `${count} raid bosses loaded. Last refresh: ${date}.`,
      error: "Unable to load current raid bosses. Please try again later.",
      noResult: "No raid boss matches your filters.",
      check: "Check weather boost",
      source: "Community data source"
    },
    fr: {
      loading: "Chargement des raids actuels...",
      loaded: (count, date) => `${count} boss de raid chargés. Dernière actualisation : ${date}.`,
      error: "Impossible de charger les raids actuels. Réessaie plus tard.",
      noResult: "Aucun boss de raid ne correspond aux filtres.",
      check: "Vérifier le boost météo",
      source: "Source de données communautaire"
    }
  };

  let raidData = [];

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  function labelWeather(weather) {
    return lang === "fr" ? WEATHER_FR[weather] || weather : weather;
  }

  function labelTypes(raid) {
    const types = lang === "fr" && raid.typesFr?.length ? raid.typesFr : raid.types;
    return (types || []).map((type) => `<span class="type-badge">${escapeHtml(type)}</span>`).join("");
  }

  function labelWeatherBoosts(raid) {
    const boosts = lang === "fr" && raid.weatherBoostsFr?.length ? raid.weatherBoostsFr : raid.weatherBoosts;
    return (boosts || []).map((weather) => `<span class="weather-badge">${escapeHtml(weather)}</span>`).join("");
  }

  function getDisplayName(raid) {
    return lang === "fr" && raid.frName ? raid.frName : raid.name;
  }

  function populateTierFilter() {
    const tiers = [...new Set(raidData.map((raid) => raid.tier).filter(Boolean))];

    const current = tierFilter.value || "all";
    const firstLabel = lang === "fr" ? "Tous les niveaux" : "All tiers";

    tierFilter.innerHTML = `<option value="all">${firstLabel}</option>` +
      tiers.map((tier) => `<option value="${escapeHtml(tier)}">${escapeHtml(tier)}</option>`).join("");

    tierFilter.value = tiers.includes(current) ? current : "all";
  }

  function getFilteredRaids() {
    const q = normalize(searchInput.value);
    const tier = tierFilter.value;
    const weather = weatherFilter.value;

    return raidData.filter((raid) => {
      const haystack = normalize(`${raid.name} ${raid.frName || ""} ${raid.tier} ${(raid.types || []).join(" ")} ${(raid.weatherBoosts || []).join(" ")}`);

      if (q && !haystack.includes(q)) return false;
      if (tier !== "all" && raid.tier !== tier) return false;
      if (weather !== "all" && !(raid.weatherBoosts || []).includes(weather)) return false;

      return true;
    });
  }

  function render() {
    const raids = getFilteredRaids();

    if (!raids.length) {
      tableBody.innerHTML = `<tr><td colspan="7">${texts[lang].noResult}</td></tr>`;
      cardsEl.innerHTML = `<p class="hint">${texts[lang].noResult}</p>`;
      return;
    }

    tableBody.innerHTML = raids.map((raid) => {
      const name = getDisplayName(raid);
      const img = raid.image ? `<img class="raid-sprite" src="${escapeHtml(raid.image)}" alt="">` : "";
      const url = `/?pokemon=${encodeURIComponent(raid.name)}`;

      return `<tr>
        <td><strong>${escapeHtml(raid.tier || "Raid")}</strong></td>
        <td><div class="raid-name">${img}<span>${escapeHtml(name)}</span>${raid.shiny ? '<span class="shiny-badge">★</span>' : ""}</div></td>
        <td>${labelTypes(raid) || "N/A"}</td>
        <td>${labelWeatherBoosts(raid) || "N/A"}</td>
        <td>${escapeHtml(raid.perfectCp || "N/A")}</td>
        <td>${escapeHtml(raid.boostedCp || "N/A")}</td>
        <td><a class="primary-link" href="${url}">${texts[lang].check}</a></td>
      </tr>`;
    }).join("");

    cardsEl.innerHTML = raids.map((raid) => {
      const name = getDisplayName(raid);
      const img = raid.image ? `<img class="raid-card-img" src="${escapeHtml(raid.image)}" alt="">` : "";
      const url = `/?pokemon=${encodeURIComponent(raid.name)}`;

      return `<article class="raid-card">
        <div class="raid-card-head">
          ${img}
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(raid.tier || "Raid")}</span>
          </div>
        </div>
        <div class="raid-card-row">${labelTypes(raid)}</div>
        <div class="raid-card-row">${labelWeatherBoosts(raid)}</div>
        <p class="detail">Perfect CP: ${escapeHtml(raid.perfectCp || "N/A")} · Boosted CP: ${escapeHtml(raid.boostedCp || "N/A")}</p>
        <a class="primary-link" href="${url}">${texts[lang].check}</a>
      </article>`;
    }).join("");
  }

  async function loadRaids(force = false) {
    try {
      statusEl.textContent = texts[lang].loading;
      refreshBtn.disabled = true;

      const response = await fetch(`/api/raid-bosses${force ? `?t=${Date.now()}` : ""}`);

      if (!response.ok) {
        throw new Error("Raid API error");
      }

      const data = await response.json();

      raidData = Array.isArray(data.raids) ? data.raids : [];
      populateTierFilter();
      render();

      const date = data.updatedAt ? new Date(data.updatedAt).toLocaleString(lang === "fr" ? "fr-FR" : "en-US") : "N/A";
      statusEl.textContent = `${texts[lang].loaded(raidData.length, date)} ${texts[lang].source}: ${data.source || "community API"}.`;
    } catch (error) {
      console.error(error);
      statusEl.textContent = texts[lang].error;
      tableBody.innerHTML = `<tr><td colspan="7">${texts[lang].error}</td></tr>`;
      cardsEl.innerHTML = "";
    } finally {
      refreshBtn.disabled = false;
    }
  }

  searchInput.addEventListener("input", render);
  tierFilter.addEventListener("change", render);
  weatherFilter.addEventListener("change", render);
  refreshBtn.addEventListener("click", () => loadRaids(true));

  loadRaids();
}
