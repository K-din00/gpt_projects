const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 18;
const SLOT_INTERVAL_MINUTES = 30;
const STORAGE_KEY = 'scheduler-bookings-v1';

const timeGrid = document.getElementById('time-grid');
const modal = document.getElementById('booking-modal');
const modalSlotLabel = document.getElementById('modal-slot-label');
const bookingForm = document.getElementById('booking-form');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const notesInput = document.getElementById('notes');
const toast = document.getElementById('toast');
const aboutPanel = document.getElementById('about-panel');
const aboutToggle = document.getElementById('about-toggle');

const bookings = loadBookings();
let activeSlotButton = null;
let toastTimeoutId = null;

init();

function init() {
  renderSlots();
  hydrateSlots();
  bindEvents();
  handleDeclineFromUrl();
}

function renderSlots() {
  const fragment = document.createDocumentFragment();
  for (let minutes = SLOT_START_HOUR * 60; minutes <= SLOT_END_HOUR * 60; minutes += SLOT_INTERVAL_MINUTES) {
    const timeLabel = formatMinutes(minutes);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'time-slot';
    button.dataset.time = timeLabel;
    button.setAttribute('role', 'listitem');
    button.textContent = timeLabel;
    button.addEventListener('click', () => handleSlotSelection(button));
    fragment.appendChild(button);
  }
  timeGrid.appendChild(fragment);
}

function hydrateSlots() {
  Object.keys(bookings).forEach((time) => {
    if (bookings[time]) {
      markSlot(time, true);
    }
  });
}

function bindEvents() {
  bookingForm.addEventListener('submit', handleBookingSubmit);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-visible')) {
      closeModal();
    }
  });

  modal.addEventListener('click', (event) => {
    if (event.target.matches('[data-close-modal]')) {
      closeModal();
    }
  });

  if (aboutToggle) {
    aboutToggle.addEventListener('click', () => {
      const expanded = aboutToggle.getAttribute('aria-expanded') === 'true';
      aboutToggle.setAttribute('aria-expanded', String(!expanded));
      aboutPanel.classList.toggle('is-open', !expanded);
    });
  }

  phoneInput.addEventListener('input', () => {
    const digitsOnly = phoneInput.value.replace(/\D/g, '').slice(0, 9);
    phoneInput.value = digitsOnly;
  });
}

function handleSlotSelection(button) {
  if (button.classList.contains('booked')) {
    showToast('That slot is already reserved.');
    return;
  }
  activeSlotButton = button;
  openModal(button.dataset.time);
}

function openModal(timeLabel) {
  modal.classList.add('is-visible');
  modal.setAttribute('aria-hidden', 'false');
  modalSlotLabel.textContent = timeLabel;
  bookingForm.reset();
  phoneInput.value = '359';
  nameInput.focus();
}

function closeModal() {
  modal.classList.remove('is-visible');
  modal.setAttribute('aria-hidden', 'true');
  activeSlotButton = null;
}

function handleBookingSubmit(event) {
  event.preventDefault();
  if (!activeSlotButton) {
    return;
  }

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const notes = notesInput.value.trim();

  if (!name) {
    nameInput.focus();
    showToast('Please add a name.');
    return;
  }

  if (!/^\d{9}$/.test(phone)) {
    phoneInput.focus();
    showToast('Phone number must be 9 digits (numbers only).');
    return;
  }

  const slotTime = activeSlotButton.dataset.time;
  bookings[slotTime] = { name, phone, notes };
  saveBookings();
  markSlot(slotTime, true);
  closeModal();
  draftEmail({ time: slotTime, name, phone, notes });
  showToast(`Reserved ${slotTime}. Email draft opened.`);
}

function markSlot(time, isBooked) {
  const selector = `[data-time="${cssEscape(time)}"]`;
  const slot = timeGrid.querySelector(selector);
  if (!slot) return;

  slot.classList.toggle('booked', isBooked);
  slot.setAttribute('aria-disabled', String(isBooked));
}

function draftEmail({ time, name, phone, notes }) {
  const subject = `Booking request for ${time}`;
  const declineLink = buildDeclineLink(time);
  const lines = [
    `Time slot: ${time}`,
    `Name: ${name}`,
    `Phone: ${phone}`,
    notes ? `Other: ${notes}` : null,
    '',
    'Decline (free this slot):',
    declineLink,
  ].filter(Boolean);

  const params = new URLSearchParams({
    subject,
    body: lines.join('\n'),
  });

  window.location.href = `mailto:hazzardzex@gmail.com?${params.toString()}`;
}

function buildDeclineLink(time) {
  const url = new URL(window.location.href);
  url.searchParams.set('decline', time);
  return url.toString();
}

function handleDeclineFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const declined = params.get('decline');
  if (!declined) {
    return;
  }

  if (bookings[declined]) {
    delete bookings[declined];
    saveBookings();
    markSlot(declined, false);
    showToast(`${declined} was declined. Slot is available again.`);
  }

  params.delete('decline');
  const newQuery = params.toString();
  const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}${window.location.hash}`;
  window.history.replaceState({}, '', newUrl);
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

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replace(/([:\[\]().,=])/g, '\\$1');
}
