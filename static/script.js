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
  if (!destinations.length) {
    destinationsGrid.innerHTML = '<p class="empty-text">No destinations found.</p>';
    return;
  }

  destinationsGrid.innerHTML = destinations
    .map(function (d) {
      return `
        <article class="card destination" style="background-image: linear-gradient(150deg, rgba(0,0,0,.25), rgba(0,0,0,.6)), url('${d.image_url}')">
          <h3>${d.name}</h3>
          <small>${d.location}</small>
          <p>${d.description}</p>
        </article>
      `;
    })
    .join("");

  if (luxuryTrack) {
    luxuryTrack.innerHTML = `
      <span>Private Chauffeur Transfers</span>
      <span>5-Star Curated Stays</span>
      <span>Local VIP Experiences</span>
      <span>${destinations.length}+ Premium Destinations Live</span>
    `;
  }
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
  loadDestinations(destinationSearch.value.trim());
});

loadDestinations();
loadSession();
