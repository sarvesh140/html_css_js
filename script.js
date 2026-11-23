// Weather Dashboard
// Weather data from Open-Meteo (https://open-meteo.com) - free, no API key needed.

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "dew_point_2m",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "pressure_msl",
  "uv_index",
  "visibility",
].join(",");

const STORAGE_KEY = "recentSearches";
const MAX_RECENT_SEARCHES = 5;

// Maps an Open-Meteo weather code to a short description and an ionicon name
const weatherCodes = {
  0: { description: "Clear sky", icon: "sunny-outline" },
  1: { description: "Mainly clear", icon: "partly-sunny-outline" },
  2: { description: "Partly cloudy", icon: "partly-sunny-outline" },
  3: { description: "Cloudy", icon: "cloud-outline" },
  45: { description: "Fog", icon: "cloudy-outline" },
  48: { description: "Fog", icon: "cloudy-outline" },
  51: { description: "Light drizzle", icon: "rainy-outline" },
  53: { description: "Drizzle", icon: "rainy-outline" },
  55: { description: "Heavy drizzle", icon: "rainy-outline" },
  61: { description: "Light rain", icon: "rainy-outline" },
  63: { description: "Rain", icon: "rainy-outline" },
  65: { description: "Heavy rain", icon: "rainy-outline" },
  71: { description: "Light snow", icon: "snow-outline" },
  73: { description: "Snow", icon: "snow-outline" },
  75: { description: "Heavy snow", icon: "snow-outline" },
  80: { description: "Rain showers", icon: "rainy-outline" },
  81: { description: "Rain showers", icon: "rainy-outline" },
  82: { description: "Heavy showers", icon: "rainy-outline" },
  95: { description: "Thunderstorm", icon: "thunderstorm-outline" },
  96: { description: "Thunderstorm", icon: "thunderstorm-outline" },
  99: { description: "Thunderstorm", icon: "thunderstorm-outline" },
};

// DOM elements
const searchForm = document.querySelector("#search-form");
const cityInput = document.querySelector("#city-input");
const searchButton = document.querySelector(".search-button");
const popularLinks = document.querySelectorAll(".popular-search-link");

const resultsMessage = document.querySelector(".results-message");
const resultsWeather = document.querySelector(".results-weather");
const weatherIcon = document.querySelector("#weather-icon");
const uvBadge = document.querySelector("#stat-uv-level");

const recentList = document.querySelector("#recent-list");
const recentEmpty = document.querySelector("#recent-empty");
const clearHistoryButton = document.querySelector("#clear-history");

// ---------- Fetching ----------

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error("Network error. Check your internet connection and try again.");
  }

  if (!response.ok) {
    throw new Error(`The weather service returned an error (${response.status}). Please try again.`);
  }

  return response.json();
}

async function getLocation(city) {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}&count=5&format=json`;
  const data = await fetchJson(url);

  if (!data.results || data.results.length === 0) {
    throw new Error(`No city found for "${city}". Check the spelling and try again.`);
  }

  return data.results[0];
}

async function getWeather(latitude, longitude) {
  const url =
    `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}` +
    `&current=${CURRENT_FIELDS}` +
    "&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto";

  return fetchJson(url);
}

async function searchCity(city) {
  cityInput.value = city;
  showMessage(`Loading weather for "${city}"…`);
  searchButton.disabled = true;

  try {
    const place = await getLocation(city);
    const weather = await getWeather(place.latitude, place.longitude);
    renderWeather(place, weather);
    saveRecentSearch(city, place, weather);
  } catch (error) {
    console.error(error);
    showMessage(error.message, true);
  } finally {
    searchButton.disabled = false;
  }
}

// ---------- Rendering ----------

function showMessage(text, isError = false) {
  resultsWeather.classList.add("hidden");
  resultsMessage.classList.remove("hidden");
  resultsMessage.classList.toggle("error", isError);
  resultsMessage.textContent = text;
}

function setText(selector, text) {
  document.querySelector(selector).textContent = text;
}

function renderWeather(place, weather) {
  const current = weather.current;
  const daily = weather.daily;
  const condition = getCondition(current.weather_code);
  const uv = getUvLevel(current.uv_index);
  const localTime = current.time.split("T")[1];

  setText("#weather-city", getPlaceLabel(place));
  setText("#weather-updated", `Updated ${localTime} local time`);
  weatherIcon.setAttribute("name", condition.icon);
  setText("#weather-temp", formatTemperature(current.temperature_2m));
  setText("#weather-description", condition.description);

  setText("#weather-high", formatTemperature(daily.temperature_2m_max[0]));
  setText("#weather-low", formatTemperature(daily.temperature_2m_min[0]));
  setText("#weather-feels-like", formatTemperature(current.apparent_temperature));

  setText("#stat-temperature", current.temperature_2m.toFixed(1));
  setText("#stat-humidity", current.relative_humidity_2m);
  setText("#stat-dew-point", formatTemperature(current.dew_point_2m));
  setText("#stat-wind-speed", Math.round(current.wind_speed_10m));
  setText(
    "#stat-wind-direction",
    `${getCompassDirection(current.wind_direction_10m)} (${current.wind_direction_10m}°)`
  );

  setText("#stat-uv", Math.round(current.uv_index));
  setText("#stat-uv-level", uv.label);
  uvBadge.classList.remove("good", "moderate", "high");
  uvBadge.classList.add(uv.className);
  setText("#stat-uv-note", uv.note);

  setText("#stat-pressure", Math.round(current.pressure_msl));
  setText("#stat-visibility", (current.visibility / 1000).toFixed(1));
  setText(
    "#weather-coordinates",
    `${place.latitude.toFixed(2)}°, ${place.longitude.toFixed(2)}° (${weather.timezone})`
  );

  resultsMessage.classList.add("hidden");
  resultsWeather.classList.remove("hidden");
}

// ---------- Helpers ----------

function getCondition(code) {
  return weatherCodes[code] || { description: "Unknown", icon: "cloud-outline" };
}

function formatTemperature(value) {
  return `${Math.round(value)}°C`;
}

function getPlaceLabel(place) {
  return [place.name, place.country].filter(Boolean).join(", ");
}

function getUvLevel(uvIndex) {
  if (uvIndex < 3) {
    return { label: "Low", className: "good", note: "No sun protection needed" };
  }
  if (uvIndex < 6) {
    return { label: "Moderate", className: "moderate", note: "Sun protection recommended" };
  }
  return { label: "High", className: "high", note: "Extra sun protection needed" };
}

function getCompassDirection(degrees) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function timeAgo(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

// ---------- Recent searches (localStorage) ----------

function loadRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveRecentSearch(query, place, weather) {
  const label = getPlaceLabel(place);
  const search = {
    query,
    label,
    temperature: weather.current.temperature_2m,
    weatherCode: weather.current.weather_code,
    searchedAt: Date.now(),
  };

  // Drop any older entry for the same place, then put the new one first
  const searches = loadRecentSearches().filter((item) => item.label !== label);
  searches.unshift(search);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches.slice(0, MAX_RECENT_SEARCHES)));
  } catch (error) {
    console.warn("Could not save recent searches:", error);
  }

  renderRecentSearches();
}

function createRecentItem(search) {
  const condition = getCondition(search.weatherCode);

  const item = createElement("li", "recent-search-item");
  const button = createElement("button", "recent-search-link");
  button.type = "button";

  const icon = createElement("ion-icon", "recent-search-icon");
  icon.setAttribute("name", condition.icon);
  icon.setAttribute("aria-hidden", "true");
  icon.classList.toggle("sunny", condition.icon.includes("sunny"));

  const info = createElement("span", "recent-search-info");
  info.append(
    createElement("span", "recent-search-city", search.label),
    createElement("span", "recent-search-meta", `${timeAgo(search.searchedAt)} • ${condition.description}`)
  );

  const temperature = createElement("span", "recent-search-temp", formatTemperature(search.temperature));

  button.append(icon, info, temperature);
  button.addEventListener("click", () => searchCity(search.query));

  item.append(button);
  return item;
}

function renderRecentSearches() {
  const searches = loadRecentSearches();

  recentList.replaceChildren();
  searches.forEach((search) => recentList.append(createRecentItem(search)));

  recentEmpty.classList.toggle("hidden", searches.length > 0);
  clearHistoryButton.classList.toggle("hidden", searches.length === 0);
}

// ---------- Events ----------

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const city = cityInput.value.trim();
  if (!city) {
    showMessage("Please enter a city name.", true);
    return;
  }

  searchCity(city);
});

popularLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    searchCity(link.textContent);
  });
});

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderRecentSearches();
});

renderRecentSearches();
