const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 18;
const SLOT_INTERVAL_MINUTES = 30;
const DATE_RANGE_MONTHS = 3;
const STORAGE_KEY = 'scheduler-bookings-v1';

const dateGrid = document.getElementById('date-grid');
const selectedDateLabel = document.getElementById('selected-date-label');
const timeGrid = document.getElementById('time-grid');
const bookingModal = document.getElementById('booking-modal');
const modalSlotLabel = document.getElementById('modal-slot-label');
const bookingForm = document.getElementById('booking-form');
const nameInput = document.getElementById('name');
const phoneWrapper = document.querySelector('.phone-field');
const phoneInput = document.getElementById('phone');
const phoneError = document.getElementById('phone-error');
const notesInput = document.getElementById('notes');
const toast = document.getElementById('toast');
const aboutPanel = document.getElementById('about-panel');
const aboutToggle = document.getElementById('about-toggle');
const loginBtn = document.getElementById('login-btn');
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const loginName = document.getElementById('login-name');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const adminDashboard = document.getElementById('admin-dashboard');
const adminList = document.getElementById('admin-list');
const adminClose = document.getElementById('admin-close');

const bookings = loadBookings();
let dateOptions = [];
let selectedDate = null;
let activeSlot = null;
let toastTimeoutId = null;
let isAdminAuthenticated = false;

init();

function init() {
  dateOptions = buildDateRange(DATE_RANGE_MONTHS);
  selectedDate = dateOptions[0]?.iso ?? null;
  renderDates();
  renderSlots();
  updateSelectedDateLabel();
  renderAdminBookings();
  bindEvents();
  handleDeclineFromUrl();
}

function bindEvents() {
  bookingForm.addEventListener('submit', handleBookingSubmit);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (bookingModal.classList.contains('is-visible')) {
        closeBookingModal();
      } else if (loginModal.classList.contains('is-visible')) {
        closeLoginModal();
      } else if (adminDashboard.classList.contains('is-open')) {
        closeAdminDashboard();
      }
    }
  });

  bookingModal.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-modal]')) {
      closeBookingModal();
    }
  });

  loginModal.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-login]')) {
      closeLoginModal();
    }
  });

  adminDashboard.addEventListener('click', (event) => {
    if (event.target === adminDashboard) {
      closeAdminDashboard();
    }
  });

  if (aboutToggle) {
    aboutToggle.addEventListener('click', () => {
      const expanded = aboutToggle.getAttribute('aria-expanded') === 'true';
      aboutToggle.setAttribute('aria-expanded', String(!expanded));
      aboutPanel.classList.toggle('is-open', !expanded);
    });
  }

  if (dateGrid) {
    dateGrid.addEventListener('keydown', handleDateGridKeydown);
  }

  phoneInput.addEventListener('input', handlePhoneInput);
  phoneInput.addEventListener('blur', () => validatePhone(true));

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (isAdminAuthenticated) {
        openAdminDashboard();
      } else {
        openLoginModal();
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  if (adminClose) {
    adminClose.addEventListener('click', closeAdminDashboard);
  }
}

function renderDates() {
  if (!dateGrid) return;
  dateGrid.innerHTML = '';
  dateOptions.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'date-button';
    button.dataset.date = option.iso;
    button.id = `date-${option.iso}`;
    button.innerHTML = `<strong>${option.weekday}</strong><span>${option.long}</span>`;
    if (option.iso === selectedDate) {
      button.classList.add('is-selected');
      dateGrid.setAttribute('aria-activedescendant', button.id);
    }
    button.addEventListener('click', () => selectDate(option.iso));
    dateGrid.appendChild(button);
  });
}

function selectDate(dateIso) {
  selectedDate = dateIso;
  updateDateSelection();
  updateSelectedDateLabel();
  renderSlots();
}

function updateDateSelection() {
  if (!dateGrid) return;
  const buttons = dateGrid.querySelectorAll('.date-button');
  buttons.forEach((button) => {
    const isActive = button.dataset.date === selectedDate;
    button.classList.toggle('is-selected', isActive);
    if (isActive) {
      dateGrid.setAttribute('aria-activedescendant', button.id);
    }
  });
}

function renderSlots() {
  if (!timeGrid) return;
  timeGrid.innerHTML = '';
  if (!selectedDate) {
    const message = document.createElement('p');
    message.textContent = 'No date selected.';
    timeGrid.appendChild(message);
    return;
  }

  for (let minutes = SLOT_START_HOUR * 60; minutes <= SLOT_END_HOUR * 60; minutes += SLOT_INTERVAL_MINUTES) {
    const timeLabel = formatMinutes(minutes);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'time-slot';
    button.dataset.time = timeLabel;
    button.dataset.date = selectedDate;
    button.textContent = timeLabel;

    const key = getBookingKey(selectedDate, timeLabel);
    if (bookings[key]) {
      button.classList.add('booked');
      button.setAttribute('aria-disabled', 'true');
    }

    button.addEventListener('click', () => handleSlotSelection(button));
    timeGrid.appendChild(button);
  }
}

function handleSlotSelection(button) {
  if (button.classList.contains('booked')) {
    showToast('That slot is already reserved.');
    return;
  }

  activeSlot = {
    date: button.dataset.date,
    time: button.dataset.time,
  };

  openBookingModal(activeSlot);
}

function openBookingModal(slot) {
  bookingForm.reset();
  clearPhoneError();
  phoneInput.value = '';
  bookingModal.classList.add('is-visible');
  bookingModal.setAttribute('aria-hidden', 'false');
  modalSlotLabel.textContent = `${formatDateLong(slot.date)} · ${slot.time}`;
  nameInput.focus();
}

function closeBookingModal() {
  bookingModal.classList.remove('is-visible');
  bookingModal.setAttribute('aria-hidden', 'true');
  activeSlot = null;
}

function handleBookingSubmit(event) {
  event.preventDefault();
  if (!activeSlot) {
    return;
  }

  const name = nameInput.value.trim();
  const phoneDigits = phoneInput.value.trim();
  const notes = notesInput.value.trim();

  if (!name) {
    nameInput.focus();
    showToast('Please add a name.');
    return;
  }

  if (!validatePhone(true)) {
    return;
  }

  const fullPhone = `359${phoneDigits}`;
  const key = getBookingKey(activeSlot.date, activeSlot.time);
  const slotSummary = { date: activeSlot.date, time: activeSlot.time };

  bookings[key] = {
    date: slotSummary.date,
    time: slotSummary.time,
    name,
    phone: fullPhone,
    notes,
  };

  saveBookings();
  renderSlots();
  renderAdminBookings();
  closeBookingModal();
  draftEmail({ ...bookings[key] });
  showToast(`Reserved ${formatDateShort(slotSummary.date)} · ${slotSummary.time}. Email draft opened.`);
}

function handlePhoneInput() {
  const digitsOnly = phoneInput.value.replace(/\D/g, '').slice(0, 9);
  phoneInput.value = digitsOnly;
  if (digitsOnly.length === 9) {
    clearPhoneError();
  }
}

function validatePhone(showMessage = false) {
  const digits = phoneInput.value.trim();
  const isValid = digits.length === 9;
  if (!isValid && showMessage) {
    phoneError.textContent = 'Wrong number';
    phoneWrapper.classList.add('has-error');
  } else if (isValid) {
    clearPhoneError();
  }
  return isValid;
}

function clearPhoneError() {
  phoneError.textContent = '';
  phoneWrapper.classList.remove('has-error');
}

function draftEmail({ date, time, name, phone, notes }) {
  const subject = `Booking request for ${formatDateLong(date)} at ${time}`;
  const declineLink = buildDeclineLink(date, time);
  const lines = [
    `Date: ${formatDateLong(date)}`,
    `Time slot: ${time}`,
    `Name: ${name}`,
    `Phone: +${phone}`,
    notes ? `Other: ${notes}` : null,
    '',
    'Decline (free this slot):',
    declineLink,
  ].filter(Boolean);

  const params = new URLSearchParams({ subject, body: lines.join('\n') });
  window.location.href = `mailto:hazzardzex@gmail.com?${params.toString()}`;
}

function buildDeclineLink(date, time) {
  const url = new URL(window.location.href);
  url.searchParams.set('declineDate', date);
  url.searchParams.set('declineTime', time);
  return url.toString();
}

function handleDeclineFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const declinedDate = params.get('declineDate');
  const declinedTime = params.get('declineTime');
  if (!(declinedDate && declinedTime)) {
    return;
  }

  const key = getBookingKey(declinedDate, declinedTime);
  if (bookings[key]) {
    delete bookings[key];
    saveBookings();
    if (selectedDate === declinedDate) {
      renderSlots();
    }
    renderAdminBookings();
    showToast(`${formatDateShort(declinedDate)} · ${declinedTime} was declined.`);
  }

  params.delete('declineDate');
  params.delete('declineTime');
  const newQuery = params.toString();
  const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', newUrl);
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const username = loginName.value.trim();
  const password = loginPassword.value.trim();
  if (username === 'Admin' && password === 'Admin') {
    isAdminAuthenticated = true;
    loginError.textContent = '';
    closeLoginModal();
    openAdminDashboard();
  } else {
    loginError.textContent = 'Wrong credentials';
  }
}

function openLoginModal() {
  loginForm.reset();
  loginError.textContent = '';
  loginModal.classList.add('is-visible');
  loginModal.setAttribute('aria-hidden', 'false');
  loginName.focus();
}

function closeLoginModal() {
  loginModal.classList.remove('is-visible');
  loginModal.setAttribute('aria-hidden', 'true');
}

function openAdminDashboard() {
  adminDashboard.classList.add('is-open');
  adminDashboard.setAttribute('aria-hidden', 'false');
  renderAdminBookings();
}

function closeAdminDashboard() {
  adminDashboard.classList.remove('is-open');
  adminDashboard.setAttribute('aria-hidden', 'true');
}

function renderAdminBookings() {
  if (!adminList) return;
  const entries = Object.values(bookings)
    .filter((entry) => entry && entry.date && entry.time);
  entries.sort((a, b) => {
    if (a.date === b.date) {
      return a.time.localeCompare(b.time);
    }
    return a.date.localeCompare(b.date);
  });

  if (!entries.length) {
    adminList.innerHTML = '<p class="empty-state">No bookings yet.</p>';
    return;
  }

  adminList.innerHTML = '';
  entries.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'admin-card';
    card.innerHTML = `
      <h4>${formatDateShort(entry.date)} · ${entry.time}</h4>
      <dl>
        <dt>Name</dt><dd>${entry.name}</dd>
        <dt>Phone</dt><dd>+${entry.phone}</dd>
        <dt>Notes</dt><dd>${entry.notes || '—'}</dd>
      </dl>
    `;
    adminList.appendChild(card);
  });
}

function handleDateGridKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  const currentIndex = dateOptions.findIndex((option) => option.iso === selectedDate);
  const nextIndex = Math.min(Math.max(currentIndex + delta, 0), dateOptions.length - 1);
  const nextDate = dateOptions[nextIndex];
  if (nextDate) {
    selectDate(nextDate.iso);
    focusDateButton(nextDate.iso);
  }
}

function focusDateButton(dateIso) {
  const button = document.getElementById(`date-${dateIso}`);
  if (button) {
    button.focus();
  }
}

function updateSelectedDateLabel() {
  if (!selectedDateLabel) return;
  selectedDateLabel.textContent = selectedDate ? formatDateLong(selectedDate) : 'No date selected';
}

function buildDateRange(monthCount) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setMonth(end.getMonth() + monthCount);
  const options = [];

  for (let date = new Date(today); date <= end; date.setDate(date.getDate() + 1)) {
    const current = new Date(date);
    options.push({
      iso: current.toISOString().split('T')[0],
      weekday: current.toLocaleDateString(undefined, { weekday: 'short' }),
      long: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }

  return options;
}

function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Could not read saved bookings:', error);
    return {};
  }
}

function saveBookings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  } catch (error) {
    console.warn('Could not save bookings:', error);
  }
}

function showToast(message) {
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDateShort(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateLong(dateIso) {
  const date = new Date(`${dateIso}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function getBookingKey(date, time) {
  return `${date}|${time}`;
}
