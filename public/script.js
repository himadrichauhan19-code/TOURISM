document.getElementById("year").textContent = new Date().getFullYear();

const bookingForm = document.getElementById("bookingForm");
const formMessage = document.getElementById("formMessage");
const signupForm = document.getElementById("signupForm");
const signinForm = document.getElementById("signinForm");
const signupMessage = document.getElementById("signupMessage");
const signinMessage = document.getElementById("signinMessage");
const welcomeUser = document.getElementById("welcomeUser");
const logoutBtn = document.getElementById("logoutBtn");
const signupNavBtn = document.getElementById("signupNavBtn");
const destinationSearch = document.getElementById("destinationSearch");
const destinationsGrid = document.getElementById("destinationsGrid");
const bookingsList = document.getElementById("bookingsList");
const luxuryTrack = document.getElementById("luxuryTrack");
const liveGreeting = document.getElementById("liveGreeting");
const liveClock = document.getElementById("liveClock");
const liveLocationText = document.getElementById("liveLocationText");
const recommendationText = document.getElementById("recommendationText");
const recommendationChips = document.getElementById("recommendationChips");

let latestDestinations = [];

function getBehaviorState() {
  return JSON.parse(localStorage.getItem("tourismBehavior") || '{"searches":[],"clicks":{}}');
}

function saveBehaviorState(state) {
  localStorage.setItem("tourismBehavior", JSON.stringify(state));
}

function trackSearch(query) {
  if (!query) return;
  const state = getBehaviorState();
  state.searches.unshift(query.toLowerCase());
  state.searches = state.searches.slice(0, 12);
  saveBehaviorState(state);
}

function trackDestinationClick(name) {
  const state = getBehaviorState();
  state.clicks[name] = (state.clicks[name] || 0) + 1;
  saveBehaviorState(state);
  renderRecommendations();
}

function renderRecommendations() {
  const state = getBehaviorState();
  const sortedByClicks = Object.entries(state.clicks)
    .sort(function (a, b) { return b[1] - a[1]; })
    .slice(0, 3)
    .map(function (item) { return item[0]; });

  const fallback = latestDestinations.slice(0, 3).map(function (d) { return d.name; });
  const picks = sortedByClicks.length ? sortedByClicks : fallback;

  recommendationChips.innerHTML = picks
    .map(function (name) { return `<span class="chip">${name}</span>`; })
    .join("");

  if (sortedByClicks.length) {
    recommendationText.textContent = "Based on your clicks, these destinations match your interest right now.";
  } else {
    recommendationText.textContent = "Start exploring. Recommendations will adapt instantly to your activity.";
  }
}

function updateLiveTimeContext() {
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString();

  const hour = now.getHours();
  let slot = "Evening";
  if (hour < 12) slot = "Morning";
  else if (hour < 17) slot = "Afternoon";

  liveGreeting.textContent = `Good ${slot} - Travel picks updated live`;
}

function updateLocationContext() {
  if (!navigator.geolocation) {
    liveLocationText.textContent = "Location not supported on this device.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      let zone = "your area";
      if (lat > 23) zone = "cooler North routes";
      if (lat < 17) zone = "coastal South routes";
      if (lon > 78) zone = "Eastern cultural routes";
      if (lon < 73.5) zone = "Western luxury routes";

      liveLocationText.textContent = `Live location detected. Showing suggestions suited for ${zone}.`;
    },
    function () {
      liveLocationText.textContent = "Location permission denied. Using behavior + time based personalization.";
    },
    { enableHighAccuracy: false, timeout: 6000 }
  );
}

async function apiRequest(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Something went wrong.");
  }
  return data;
}

async function loadSession() {
  const res = await fetch("/api/session", { credentials: "same-origin" });
  const data = await res.json();
  renderAuthState(data.authenticated ? data.user : null);
  if (data.authenticated) {
    loadMyBookings();
  }
}

function renderAuthState(user) {
  if (user) {
    welcomeUser.textContent = `Hi, ${user.name}`;
    logoutBtn.style.display = "inline-block";
    signupNavBtn.style.display = "none";
  } else {
    welcomeUser.textContent = "";
    logoutBtn.style.display = "none";
    signupNavBtn.style.display = "inline-block";
    bookingsList.innerHTML = '<p class="empty-text">Sign in to view your bookings.</p>';
  }
}

function renderDestinations(destinations) {
  latestDestinations = destinations;

  if (!destinations.length) {
    destinationsGrid.innerHTML = '<p class="empty-text">No destinations found.</p>';
    renderRecommendations();
    return;
  }

  destinationsGrid.innerHTML = destinations
    .map(function (d) {
      return `
        <article class="card destination" data-destination-name="${d.name}" style="background-image: linear-gradient(150deg, rgba(0,0,0,.25), rgba(0,0,0,.6)), url('${d.image_url}')">
          <h3>${d.name}</h3>
          <small>${d.location}</small>
          <p>${d.description}</p>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".destination").forEach(function (card) {
    card.addEventListener("click", function () {
      trackDestinationClick(card.dataset.destinationName);
    });
  });

  if (luxuryTrack) {
    luxuryTrack.innerHTML = `
      <span>Private Chauffeur Transfers</span>
      <span>5-Star Curated Stays</span>
      <span>Local VIP Experiences</span>
      <span>${destinations.length}+ Premium Destinations Live</span>
    `;
  }

  renderRecommendations();
}

async function loadDestinations(query = "") {
  const res = await fetch(`/api/destinations?q=${encodeURIComponent(query)}`, { credentials: "same-origin" });
  const data = await res.json();
  renderDestinations(data.destinations || []);
}

function renderBookings(bookings) {
  if (!bookings.length) {
    bookingsList.innerHTML = '<p class="empty-text">No bookings yet.</p>';
    return;
  }

  bookingsList.innerHTML = bookings
    .map(function (b) {
      return `
        <article class="booking-item">
          <h3>${b.destination}</h3>
          <p>Travel Date: ${b.travel_date}</p>
          <p>Travelers: ${b.travelers}</p>
        </article>
      `;
    })
    .join("");
}

async function loadMyBookings() {
  const res = await fetch("/api/my-bookings", { credentials: "same-origin" });
  const data = await res.json();
  renderBookings(data.bookings || []);
}

bookingForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  formMessage.textContent = "";

  const payload = {
    destination: document.getElementById("destination").value.trim(),
    travelDate: document.getElementById("travelDate").value,
    travelers: Number(document.getElementById("travelers").value)
  };

  try {
    const data = await apiRequest("/api/bookings", payload);
    formMessage.textContent = data.message;
    bookingForm.reset();
    loadMyBookings();
  } catch (error) {
    formMessage.textContent = error.message;
  }
});

signupForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  signupMessage.textContent = "";
  signinMessage.textContent = "";

  const payload = {
    name: document.getElementById("signupName").value.trim(),
    email: document.getElementById("signupEmail").value.trim(),
    password: document.getElementById("signupPassword").value
  };

  try {
    const data = await apiRequest("/api/signup", payload);
    signupMessage.textContent = data.message;
    signupForm.reset();
    renderAuthState(data.user);
    loadMyBookings();
  } catch (error) {
    signupMessage.textContent = error.message;
  }
});

signinForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  signupMessage.textContent = "";
  signinMessage.textContent = "";

  const payload = {
    email: document.getElementById("signinEmail").value.trim(),
    password: document.getElementById("signinPassword").value
  };

  try {
    const data = await apiRequest("/api/signin", payload);
    signinMessage.textContent = data.message;
    signinForm.reset();
    renderAuthState(data.user);
    loadMyBookings();
  } catch (error) {
    signinMessage.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", async function () {
  try {
    await apiRequest("/api/logout", {});
    signinMessage.textContent = "You have been logged out.";
    signupMessage.textContent = "";
    renderAuthState(null);
  } catch (error) {
    signinMessage.textContent = error.message;
  }
});

destinationSearch.addEventListener("input", function () {
  const query = destinationSearch.value.trim();
  trackSearch(query);
  loadDestinations(query);
});

updateLiveTimeContext();
setInterval(updateLiveTimeContext, 1000);
updateLocationContext();
loadDestinations();
loadSession();
