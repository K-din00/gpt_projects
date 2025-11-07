const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 18;
const SLOT_INTERVAL_MINUTES = 30;
const DATE_RANGE_MONTHS = 3;
const STORAGE_KEY = 'scheduler-bookings-v1';

const todayIso = toISODateLocal();

const dateGrid = document.getElementById('date-grid');
const monthLabel = document.getElementById('month-label');
const monthCycleBtn = document.getElementById('month-cycle');
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
const adminTodayList = document.getElementById('admin-today-list');
const adminFutureList = document.getElementById('admin-future-list');
const adminFutureSection = document.getElementById('admin-future');
const adminTodayLabel = document.getElementById('admin-today-label');
const adminClose = document.getElementById('admin-close');
const futureBtn = document.getElementById('future-btn');

const bookings = loadBookings();
let dateOptions = [];
let monthGroups = [];
let visibleMonthDates = [];
let currentMonthIndex = 0;
let selectedDate = null;
let activeSlot = null;
let toastTimeoutId = null;
let isAdminAuthenticated = false;
let futureVisible = false;
let hasFutureEntries = false;

init();

function init() {
  dateOptions = buildDateRange(DATE_RANGE_MONTHS);
  monthGroups = buildMonthGroups(dateOptions);
  const todayMonthKey = todayIso.slice(0, 7);
  const todayMonthIndex = monthGroups.findIndex((group) => group.key === todayMonthKey);
  currentMonthIndex = todayMonthIndex >= 0 ? todayMonthIndex : 0;
  const todayOption = dateOptions.find((option) => option.iso === todayIso);
  selectedDate = todayOption ? todayOption.iso : dateOptions[0]?.iso ?? null;

  renderDates();
  renderSlots();
  updateSelectedDateLabel();
  updateMonthLabel();
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

  if (monthCycleBtn) {
    if (monthGroups.length <= 1) {
      monthCycleBtn.disabled = true;
    }
    monthCycleBtn.addEventListener('click', () => {
      if (!monthGroups.length) return;
      currentMonthIndex = (currentMonthIndex + 1) % monthGroups.length;
      const nextVisible = getVisibleMonthDates();
      selectedDate = nextVisible[0]?.iso ?? selectedDate;
      renderDates();
      renderSlots();
      updateSelectedDateLabel();
      updateMonthLabel();
    });
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

  if (futureBtn) {
    futureBtn.addEventListener('click', handleFutureClick);
  }
}

function renderDates() {
  if (!dateGrid) return;
  dateGrid.innerHTML = '';
  const monthDates = getVisibleMonthDates();
  visibleMonthDates = monthDates;

  if (!monthDates.length) {
    dateGrid.innerHTML = '<p class="empty-state">No dates available.</p>';
    dateGrid.setAttribute('aria-activedescendant', '');
    return;
  }

  if (!monthDates.some((option) => option.iso === selectedDate)) {
    selectedDate = monthDates[0].iso;
    updateSelectedDateLabel();
  }

  monthDates.forEach((option) => {
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
  futureVisible = false;
  renderAdminBookings();
}

function closeAdminDashboard() {
  adminDashboard.classList.remove('is-open');
  adminDashboard.setAttribute('aria-hidden', 'true');
  futureVisible = false;
  renderAdminBookings();
}

function renderAdminBookings() {
  if (!(adminList && adminTodayList && adminFutureList)) return;
  const entries = Object.values(bookings)
    .filter((entry) => entry && entry.date && entry.time)
    .sort((a, b) => {
      if (a.date === b.date) {
        return a.time.localeCompare(b.time);
      }
      return a.date.localeCompare(b.date);
    });

  const todayEntries = entries.filter((entry) => entry.date === todayIso);
  const futureEntries = entries.filter((entry) => entry.date !== todayIso);

  renderAdminCardList(adminTodayList, todayEntries, 'No bookings today.');
  renderAdminCardList(adminFutureList, futureEntries, 'No future bookings yet.');

  if (adminTodayLabel) {
    adminTodayLabel.textContent = formatDateLong(todayIso);
  }

  hasFutureEntries = futureEntries.length > 0;
  if (!hasFutureEntries) {
    futureVisible = false;
  }
  const shouldShowFuture = hasFutureEntries && futureVisible;

  if (adminFutureSection) {
    adminFutureSection.setAttribute('aria-hidden', shouldShowFuture ? 'false' : 'true');
  }

  if (futureBtn) {
    futureBtn.disabled = !hasFutureEntries;
    futureBtn.setAttribute('aria-disabled', String(!hasFutureEntries));
    futureBtn.classList.toggle('is-active', shouldShowFuture);
    futureBtn.setAttribute('aria-pressed', String(shouldShowFuture));
  }
}

function renderAdminCardList(container, items, emptyMessage) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = '';
  items.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'admin-card';
    card.innerHTML = `
      <h4>${formatDateShort(entry.date)} &middot; ${entry.time}</h4>
      <dl>
        <dt>Name</dt><dd>${entry.name}</dd>
        <dt>Phone</dt><dd>+${entry.phone}</dd>
        <dt>Notes</dt><dd>${entry.notes || 'None'}</dd>
      </dl>
    `;
    container.appendChild(card);
  });
}

function handleFutureClick() {
  if (!hasFutureEntries) {
    return;
  }

  if (!futureVisible) {
    futureVisible = true;
    renderAdminBookings();
  }

  if (adminFutureSection && adminFutureSection.getAttribute('aria-hidden') === 'false') {
    adminFutureSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function handleDateGridKeydown(event) {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    return;
  }
  if (!visibleMonthDates.length) {
    return;
  }
  event.preventDefault();
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  const currentIndex = visibleMonthDates.findIndex((option) => option.iso === selectedDate);
  const nextIndex = Math.min(Math.max(currentIndex + delta, 0), visibleMonthDates.length - 1);
  const nextDate = visibleMonthDates[nextIndex];
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

function updateMonthLabel() {
  if (!monthLabel) return;
  const activeGroup = monthGroups[currentMonthIndex];
  monthLabel.textContent = activeGroup ? activeGroup.label : 'No month available';
  if (monthCycleBtn) {
    if (monthGroups.length <= 1) {
      monthCycleBtn.textContent = 'Current Month';
      monthCycleBtn.disabled = true;
      monthCycleBtn.setAttribute('aria-label', 'Only current month available');
    } else {
      const nextGroup = monthGroups[(currentMonthIndex + 1) % monthGroups.length];
      monthCycleBtn.textContent = 'Next Month';
      monthCycleBtn.disabled = false;
      monthCycleBtn.setAttribute('aria-label', `Show ${nextGroup.label}`);
    }
  }
}

function getActiveMonthKey() {
  return monthGroups[currentMonthIndex]?.key;
}

function getVisibleMonthDates() {
  const key = getActiveMonthKey();
  return key ? dateOptions.filter((option) => option.monthKey === key) : [];
}

function buildDateRange(monthCount) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setMonth(end.getMonth() + monthCount);
  const options = [];

  for (let date = new Date(today); date <= end; date.setDate(date.getDate() + 1)) {
    const current = new Date(date);
    const iso = toISODateLocal(current);
    options.push({
      iso,
      monthKey: iso.slice(0, 7),
      weekday: current.toLocaleDateString(undefined, { weekday: 'short' }),
      long: current.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    });
  }

  return options;
}

function buildMonthGroups(options) {
  const map = new Map();
  options.forEach((option) => {
    if (!map.has(option.monthKey)) {
      const labelDate = new Date(`${option.monthKey}-01T00:00:00`);
      map.set(option.monthKey, {
        key: option.monthKey,
        label: labelDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      });
    }
  });
  return Array.from(map.values());
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

function toISODateLocal(date = new Date()) {
  const offsetMs = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().split('T')[0];
}
