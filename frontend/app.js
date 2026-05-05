const API_ORIGIN = window.location.protocol.startsWith('http')
  ? window.location.origin
  : 'http://localhost:5001';
const API = `${API_ORIGIN}/api`;
const HALL_API = `${API}/halls`;
const BOOK_API = `${API}/bookings`;
const AUTH_API = `${API}/auth`;

const BUILDINGS = ['Academic Block', 'Mechanical Department Building', 'ERP Building'];
const BUILDING_LABELS = { 'Academic Block': 'Academic Block', 'Mechanical Department Building': 'Mechanical Department', 'ERP Building': 'ERP Building' };

const readStoredUser = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('lt_user') || 'null');
    if (!stored || !stored._id || !stored.name) return null;
    return stored;
  } catch (err) {
    localStorage.removeItem('lt_user');
    return null;
  }
};

let user = readStoredUser();
let allHalls = [];
let activeFacility = '';
let pendingCancelId = null;
let loginReady = false;
let navReady = false;
let bookingReady = false;
let scheduleReady = false;
let adminReady = false;
let dashFiltersReady = false;
let dashboardRefreshReady = false;
const DEFAULT_FACILITIES = ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'];
const showToast = (msg, type = 'info') => {
  const wrap = document.getElementById('toastWrap');
  const icons = { success: '', error: '', info: '' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => el.remove(), 300); }, 3200);
};

const slugify = s => s.replace(/\s+/g, '-').toLowerCase();
const localDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toMin = time => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const nowMin = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const durationText = (startTime, endTime) => {
  const start = toMin(startTime);
  const end = toMin(endTime);
  if (start === end) return null;
  const diff = end > start ? end - start : (24 * 60 - start) + end;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h > 0 ? h + ' hr ' : ''}${m > 0 ? m + ' min' : ''}${end < start ? ' (next day)' : ''}`;
};

const animNum = (id, target) => {
  const el = document.getElementById(id); if (!el) return;
  let n = 0;
  const step = Math.max(1, Math.ceil(target / 18));
  const t = setInterval(() => { n = Math.min(n + step, target); el.textContent = n; if (n >= target) clearInterval(t); }, 40);
};

const uniqueClean = values => [...new Set(values.map(v => v.trim()).filter(Boolean))];

function getFacilityList() {
  return uniqueClean([
    ...DEFAULT_FACILITIES,
    ...allHalls.flatMap(h => h.facilities || [])
  ]);
}

function fillFacilitySelect(containerId, selected = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const selectedSet = new Set(selected);
  const facilities = uniqueClean([...getFacilityList(), ...selected]);

  container.innerHTML = '';
  facilities.forEach(f => {
    const label = document.createElement('label');
    label.className = 'facility-check';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'facilities';
    input.value = f;
    input.checked = selectedSet.has(f);

    const text = document.createElement('span');
    text.textContent = f;

    label.append(input, text);
    container.appendChild(label);
  });
}

function collectFacilities(form) {
  const selected = Array.from(form.querySelectorAll('input[name="facilities"]:checked')).map(input => input.value);
  const custom = (form.querySelector('input[name="newFacility"]')?.value || '').split(',');
  return uniqueClean([...selected, ...custom]);
}
document.addEventListener('DOMContentLoaded', () => {
  if (!user) { showLogin(); return; }
  showApp();
});

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
  setupLogin();
}

function showApp() {
  if (!user || !user.name) {
    user = null;
    localStorage.removeItem('lt_user');
    showLogin();
    return;
  }

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('headerUserName').textContent = user.name;
  document.getElementById('headerUserDept').textContent = user.department;
  const userInitial = document.getElementById('userInitial');
  if (userInitial) userInitial.textContent = user.name.charAt(0).toUpperCase();
  setupNav();
  setupAdmin();
  loadDashboard();
  if (!dashboardRefreshReady) {
    dashboardRefreshReady = true;
    setInterval(loadDashboard, 30000);
  }
  setupBookingForm();
  setupSchedule();
}
function setupLogin() {
  if (loginReady) return;
  loginReady = true;

  document.getElementById('togglePw').addEventListener('click', () => {
    const pw = document.getElementById('l-password');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('l-username').value.trim();
    const password = document.getElementById('l-password').value.trim();
    const errEl = document.getElementById('loginErr');
    errEl.classList.add('hidden');
    let data;
    try {
      const res = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      data = await res.json();
    } catch (err) {
      console.error('Login failed:', err);
      errEl.textContent = 'Could not reach the login service. Refresh the page and try again.';
      errEl.classList.remove('hidden');
      return;
    }

    if (data.success) {
      user = data.user;
      localStorage.setItem('lt_user', JSON.stringify(user));
      showToast(data.message, 'success');
      try {
        showApp();
      } catch (err) {
        console.error('App initialization failed:', err);
        errEl.textContent = 'Login worked, but the page could not finish loading. Refresh the page once.';
        errEl.classList.remove('hidden');
      }
    } else {
      errEl.textContent = data.message;
      errEl.classList.remove('hidden');
    }
  });
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  user = null; localStorage.removeItem('lt_user'); window.location.reload();
});
function setupNav() {
  if (navReady) return;
  navReady = true;

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
      if (btn.dataset.view === 'mybookings') loadMyBookings();
      if (btn.dataset.view === 'schedule') {
        document.getElementById('sched-hall').value = '';
        document.getElementById('sched-date').value = '';
        document.getElementById('sched-type').value = '';
        loadSchedule();
      }
    });
  });
}
async function loadDashboard() {
  try {
    const res = await fetch(HALL_API);
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    allHalls = data.data;
    renderStats();
    renderByBuilding(allHalls);
    setupDashFilters();
    populateSchedHallSelect();
    populateBookHallSelect();
    fillFacilitySelect('add-facilities');
    fillFacilitySelect('e-facilities');
  } catch (err) { showToast('Failed to load halls: ' + err.message, 'error'); }
}

function renderStats() {
  const avail = allHalls.filter(h => h.status === 'Available').length;
  const occ = allHalls.length - avail;
  animNum('statTotal', allHalls.length);
  animNum('statAvail', avail);
  animNum('statOcc', occ);
}

function renderByBuilding(halls) {
  const container = document.getElementById('hallsContainer');
  container.innerHTML = '';
  if (!halls.length) {
    container.innerHTML = '<div class="empty-state"><p>No halls match your filters.</p></div>';
    return;
  }
  BUILDINGS.forEach(bld => {
    const group = halls.filter(h => h.building === bld);
    if (!group.length) return;
    const section = document.createElement('div');
    section.className = 'building-section';
    section.innerHTML = `
      <div class="building-header">
        <span class="building-name">${BUILDING_LABELS[bld]}</span>
        <span class="building-count">${group.length} room${group.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="halls-grid" id="grid-${slugify(bld)}"></div>`;
    container.appendChild(section);
    const grid = section.querySelector('.halls-grid');
    group.sort((a, b) => a.hall_id - b.hall_id).forEach(h => grid.appendChild(makeCard(h)));
  });
}

function makeCard(h) {
  const avail = h.status === 'Available';
  const badge = avail
    ? `<span class="status-badge badge-avail"><span class="status-dot dot-green"></span>Available</span>`
    : `<span class="status-badge badge-occ"><span class="status-dot dot-orange"></span>Occupied</span>`;
  const tags = (h.facilities || []).map(f => `<span class="facility-tag">${f}</span>`).join('');
  const div = document.createElement('div');
  div.className = 'hall-card';
  div.innerHTML = `
    <div class="card-top-bar ${avail ? 'bar-green' : 'bar-orange'}"></div>
    <div class="card-body">
      <div class="card-label"><span class="card-label-txt">Room</span>${badge}</div>
      <div class="card-num">${h.name}</div>
      <div class="card-meta">
        <div class="card-meta-row">${BUILDING_LABELS[h.building]}${h.floor ? ' - ' + h.floor : ''}</div>
        <div class="card-meta-row">${h.capacity} students</div>
      </div>
      <div class="tags-row">${tags || '<span style="font-size:.75rem;color:#94a3b8">No facilities listed</span>'}</div>
      <div class="card-actions">
        <button class="btn-book-card" onclick="goToBook('${h._id}')">Book</button>
        <button class="btn-view-sched" onclick="goToHallSchedule('${h._id}')">Schedule</button>
        ${user.role === 'admin' ? `
          <button class="btn-outline btn-sm" onclick="openEditHall('${h._id}')" title="Edit Hall">Edit</button>
          <button class="btn-danger btn-sm" onclick="openDeleteHall('${h._id}', '${h.name.replace(/'/g, "\\'")}')" title="Delete Hall">Delete</button>
        ` : ''}
      </div>
    </div>`;
  return div;
}

window.goToBook = (hallId) => {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector('.nav-btn[data-view="booking"]').classList.add('active');
  document.getElementById('view-booking').classList.add('active');

  document.getElementById('bk-hall').value = hallId;
  updateHallPreview(hallId);
};

window.goToHallSchedule = (hallId) => {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector('.nav-btn[data-view="schedule"]').classList.add('active');
  document.getElementById('view-schedule').classList.add('active');

  document.getElementById('sched-hall').value = hallId;
  loadSchedule();
};
function setupDashFilters() {
  if (dashFiltersReady) return;
  dashFiltersReady = true;

  let timer;
  const debounce = fn => { clearTimeout(timer); timer = setTimeout(fn, 280); };
  document.getElementById('searchInput').addEventListener('input', () => debounce(applyFilters));
  document.getElementById('filterBuilding').addEventListener('change', applyFilters);
  document.getElementById('filterStatus').addEventListener('change', applyFilters);
  document.getElementById('filterCapacity').addEventListener('input', () => debounce(applyFilters));
  document.getElementById('facilityPills').addEventListener('click', e => {
    const pill = e.target.closest('.fac-pill'); if (!pill) return;
    document.querySelectorAll('.fac-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFacility = pill.dataset.fac;
    applyFilters();
  });
}

function applyFilters() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const bld = document.getElementById('filterBuilding').value;
  const status = document.getElementById('filterStatus').value;
  const cap = parseInt(document.getElementById('filterCapacity').value) || 0;
  let filtered = allHalls.filter(h => {
    const ms = !search || h.name.toLowerCase().includes(search) || h.building.toLowerCase().includes(search) || (h.description || '').toLowerCase().includes(search);
    const mb = !bld || h.building === bld;
    const mst = !status || h.status === status;
    const mc = !cap || h.capacity >= cap;
    const mf = !activeFacility || (h.facilities || []).includes(activeFacility);
    return ms && mb && mst && mc && mf;
  });
  renderByBuilding(filtered);
}
function populateBookHallSelect() {
  const sel = document.getElementById('bk-hall');
  const selected = sel.value;
  sel.innerHTML = '<option value="">Choose a lecture hall...</option>';
  allHalls.sort((a, b) => a.hall_id - b.hall_id).forEach(h => {
    const o = document.createElement('option'); o.value = h._id;
    o.textContent = `${h.name} - ${BUILDING_LABELS[h.building]} (Cap: ${h.capacity})`;
    sel.appendChild(o);
  });
  if ([...sel.options].some(option => option.value === selected)) sel.value = selected;
}

function setupBookingForm() {
  if (bookingReady) return;
  bookingReady = true;

  const dateEl = document.getElementById('bk-date');
  const startEl = document.getElementById('bk-start');
  const endEl = document.getElementById('bk-end');
  const durEl = document.getElementById('durationDisplay');
  const today = localDateStr();

  dateEl.min = today;
  dateEl.value = today;

  const updateDur = () => {
    if (startEl.value && endEl.value) {
      const text = durationText(startEl.value, endEl.value);
      if (!text) { durEl.textContent = 'Invalid'; durEl.style.color = '#dc2626'; }
      else {
        durEl.textContent = text;
        durEl.style.color = 'var(--accent)';
      }
    }
  };
  startEl.addEventListener('change', updateDur);
  endEl.addEventListener('change', updateDur);
  document.getElementById('bk-hall').addEventListener('change', e => updateHallPreview(e.target.value));

  document.getElementById('checkAvail').addEventListener('click', async () => {
    const hallId = document.getElementById('bk-hall').value;
    const date = document.getElementById('bk-date').value;
    const alertEl = document.getElementById('conflictAlert');
    const slotsEl = document.getElementById('availSlots');
    if (!hallId || !date) { showToast('Select hall and date first', 'error'); return; }
    if (date < localDateStr()) { showToast('Cannot check a past date', 'error'); return; }
    try {
      const res = await fetch(`${BOOK_API}/availability/${hallId}?date=${date}`);
      const data = await res.json();
      alertEl.classList.add('hidden');
      slotsEl.classList.remove('hidden');
      if (data.data.bookings.length === 0) {
        slotsEl.innerHTML = '<div class="avail-slots-title">Fully available on this date.</div>';
      } else {
        let html = '<div class="avail-slots-title">Already booked slots:</div>';
        data.data.bookings.forEach(b => {
          html += `<div class="slot-row"><span>${b.startTime} - ${b.endTime}</span><span style="color:var(--text2)">${b.bookedFor} - ${b.professorName}</span></div>`;
        });
        slotsEl.innerHTML = html;
      }
    } catch { showToast('Error checking availability', 'error'); }
  });

  document.getElementById('bookingForm').addEventListener('submit', async e => {
    e.preventDefault();
    const hallId = document.getElementById('bk-hall').value;
    const date = document.getElementById('bk-date').value;
    const startTime = startEl.value;
    const endTime = endEl.value;
    const purposeType = document.querySelector('input[name="purposeType"]:checked').value;
    const bookedFor = document.getElementById('bk-bookedFor').value.trim();
    const notes = document.getElementById('bk-notes').value.trim();
    const alertEl = document.getElementById('conflictAlert');

    if (!hallId) { showToast('Please select a hall', 'error'); return; }
    if (!date) { showToast('Please select a date', 'error'); return; }
    if (date < localDateStr()) { showToast('Cannot book for a past date', 'error'); return; }
    if (!startTime) { showToast('Please select a start time', 'error'); return; }
    if (!endTime) { showToast('Please select an end time', 'error'); return; }
    if (!bookedFor) { showToast('Please enter the booking purpose (e.g. Class Name)', 'error'); return; }
    if (!durationText(startTime, endTime)) { showToast('Start and end time cannot be the same', 'error'); return; }
    if (date === localDateStr() && toMin(startTime) <= nowMin()) { showToast('Cannot book a time that has already passed', 'error'); return; }

    try {
      const res = await fetch(BOOK_API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hallId, date, startTime, endTime, purposeType, bookedFor, notes, professorId: user._id, professorName: user.name })
      });
      const data = await res.json();
      alertEl.classList.remove('hidden');
      if (data.success) {
        alertEl.className = 'conflict-alert ok';
        alertEl.textContent = 'Booking confirmed.';
        showToast('Hall booked successfully!', 'success');
        document.getElementById('availSlots').classList.add('hidden');
        setTimeout(() => {
          e.target.reset();
          document.getElementById('bk-date').value = localDateStr();
          alertEl.classList.add('hidden');
          document.querySelector('[data-view="dashboard"]').click();
          loadDashboard();
        }, 1600);
      } else {
        alertEl.className = 'conflict-alert conflict';
        alertEl.textContent = data.message;
      }
    } catch { showToast('Error creating booking', 'error'); }
  });
}

function updateHallPreview(hallId) {
  const preview = document.getElementById('hallPreview');
  if (!hallId) {
    preview.innerHTML = '<div class="preview-placeholder"><p>Select a hall to see details and today\'s schedule.</p></div>';
    return;
  }
  const h = allHalls.find(x => x._id === hallId);
  if (!h) return;
  const avail = h.status === 'Available';
  const badge = avail
    ? `<span class="status-badge badge-avail"><span class="status-dot dot-green"></span>Available</span>`
    : `<span class="status-badge badge-occ"><span class="status-dot dot-orange"></span>Occupied</span>`;

  preview.innerHTML = `
    <div class="preview-hall-name">${h.name} ${badge}</div>
    <div class="preview-hall-sub">${BUILDING_LABELS[h.building]}${h.floor ? ' - ' + h.floor : ''}</div>
    <div class="preview-detail-row"><span class="pdr-label">Capacity</span><span class="pdr-value">${h.capacity} students</span></div>
    <div class="preview-detail-row"><span class="pdr-label">Floor</span><span class="pdr-value">${h.floor || '-'}</span></div>
    <div class="preview-detail-row"><span class="pdr-label">Facilities</span><span class="pdr-value" style="font-size:.75rem;text-align:right">${(h.facilities || []).join(', ') || 'None'}</span></div>
    <div class="preview-bk-title">Today's Bookings</div>
    <div id="previewSlots">Loading...</div>`;

  const today = localDateStr();
  fetch(`${BOOK_API}/availability/${hallId}?date=${today}`).then(r => r.json()).then(data => {
    const sl = document.getElementById('previewSlots');
    if (!sl) return;
    if (!data.data || !data.data.bookings.length) { sl.innerHTML = '<div style="font-size:.8rem;color:var(--text3)">No bookings today</div>'; return; }
    sl.innerHTML = data.data.bookings.map(b => `
      <div class="preview-slot">
        <span style="font-weight:600;font-size:.78rem">${b.startTime}-${b.endTime}</span>
        <span style="font-size:.75rem;color:var(--text2)">${b.bookedFor}</span>
      </div>`).join('');
  }).catch(() => { });
}
function populateSchedHallSelect() {
  const sel = document.getElementById('sched-hall');
  const selected = sel.value;
  sel.innerHTML = '<option value="">All Halls</option>';
  allHalls.sort((a, b) => a.hall_id - b.hall_id).forEach(h => {
    const o = document.createElement('option'); o.value = h._id;
    o.textContent = `${h.name} (${BUILDING_LABELS[h.building]})`;
    sel.appendChild(o);
  });
  if ([...sel.options].some(option => option.value === selected)) sel.value = selected;
}

function setupSchedule() {
  if (scheduleReady) return;
  scheduleReady = true;
  document.getElementById('sched-hall').addEventListener('change', loadSchedule);
  document.getElementById('sched-date').addEventListener('change', loadSchedule);
  document.getElementById('sched-type').addEventListener('change', loadSchedule);
  document.getElementById('sched-reset').addEventListener('click', () => {
    document.getElementById('sched-hall').value = '';
    document.getElementById('sched-date').value = '';
    document.getElementById('sched-type').value = '';
    loadSchedule();
  });
}

async function loadSchedule() {
  const hallId = document.getElementById('sched-hall').value;
  const date = document.getElementById('sched-date').value;
  const type = document.getElementById('sched-type').value;

  let url = `${BOOK_API}?upcoming=true`;
  if (hallId) url += `&hallId=${hallId}`;
  if (date) {
    url = `${BOOK_API}?date=${date}`;
    if (hallId) url += `&hallId=${hallId}`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    let bookings = data.success ? data.data : [];
    if (type) bookings = bookings.filter(b => b.purposeType === type);
    renderScheduleTable(bookings);
  } catch { showToast('Failed to load schedule', 'error'); }
}

function renderScheduleTable(bookings) {
  const container = document.getElementById('scheduleContainer');
  if (!bookings.length) {
    container.innerHTML = '<div class="empty-state"><p>No bookings found for the selected filters.</p></div>';
    return;
  }

  const pillColor = { 'class': 'pill-class', 'club': 'pill-club', 'exam': 'pill-exam', 'event': 'pill-event', 'other': 'pill-other' };
  const typeName = { 'class': 'Class', 'club': 'Club', 'exam': 'Exam', 'event': 'Event', 'other': 'Other' };

  let rows = bookings.map(b => {
    const hallName = b.hall ? b.hall.name : 'Unknown Hall';
    const dur = () => {
      return durationText(b.startTime, b.endTime) || '-';
    };
    return `<tr>
      <td>${b.date}</td>
      <td class="time-cell">${b.startTime} - ${b.endTime}</td>
      <td style="font-size:.78rem;color:var(--text2)">${dur()}</td>
      <td class="hall-cell">${hallName}</td>
      <td>
        <span class="type-pill ${pillColor[b.purposeType] || 'pill-other'}">${typeName[b.purposeType] || b.purposeType}</span>
        <div style="font-size:.75rem;color:var(--text2);margin-top:3px">${b.bookedFor}</div>
      </td>
      <td>${b.professorName}</td>
      <td>
        <span class="mbc-status ${b.status === 'cancelled' ? 'st-cancelled' : 'st-confirmed'}">${b.status}</span>
        ${(user && user.role === 'admin') ? `<button class="btn-sm btn-outline" style="margin-left:8px;padding:.15rem .4rem" onclick="openDeleteBooking('${b._id}')" title="Delete Booking">Delete</button>` : ''}
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="booking-table-wrap">
    <table class="booking-table">
      <thead><tr><th>Date</th><th>Time Slot</th><th>Duration</th><th>Hall</th><th>Purpose</th><th>Booked By</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}
async function loadMyBookings() {
  try {
    const res = await fetch(`${BOOK_API}?professorId=${user._id}&upcoming=true`);
    const data = await res.json();
    renderMyBookings(data.success ? data.data : []);
  } catch { showToast('Failed to load bookings', 'error'); }
}

function renderMyBookings(bookings) {
  const container = document.getElementById('myBookingsContainer');
  if (!bookings.length) {
    container.innerHTML = '<div class="empty-state"><p>No active bookings right now.<br>Go to <b>Book Hall</b> to reserve a room.</p></div>';
    return;
  }
  const today = localDateStr();
  const sorted = [...bookings].sort((a, b) => b.date.localeCompare(a.date));
  let html = '<div class="my-bookings-list">';
  sorted.forEach(b => {
    const hallName = b.hall ? b.hall.name : 'Unknown Hall';
    const isCancelled = b.status === 'cancelled';
    const d = new Date(b.date);
    const month = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const canCancel = b.date >= today && !isCancelled;
    const canDelete = user && user.role === 'admin';
    const dur = () => {
      return durationText(b.startTime, b.endTime) || '-';
    };
    const pillColor = { 'class': 'pill-class', 'club': 'pill-club', 'exam': 'pill-exam', 'event': 'pill-event', 'other': 'pill-other' };
    html += `
      <div class="my-booking-card">
        <div class="mbc-date"><div class="mbc-month">${month}</div><div class="mbc-day">${day}</div></div>
        <div class="mbc-body">
          <div class="hall-nm">${hallName} ${isCancelled ? '<span style="text-decoration:line-through;opacity:.5">' : ''}</div>
          <div class="mbc-meta">
            <span>${b.startTime} - ${b.endTime} (${dur()})</span>
            <span><span class="type-pill ${pillColor[b.purposeType] || 'pill-other'}">${b.purposeType}</span> ${b.bookedFor}</span>
          </div>
        </div>
        <div class="mbc-status-wrap" style="display:flex; gap: 8px; align-items: center;">
          <span class="mbc-status ${isCancelled ? 'st-cancelled' : 'st-confirmed'}">${b.status.toUpperCase()}</span>
          ${canCancel ? `<button class="btn-sm btn-outline" onclick="confirmCancel('${b._id}')">Cancel</button>` : ''}
          ${canDelete ? `<button class="btn-sm btn-outline" style="padding:.15rem .4rem" onclick="openDeleteBooking('${b._id}')" title="Delete Booking">Delete</button>` : ''}
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}
window.confirmCancel = (id) => {
  pendingCancelId = id;
  document.getElementById('cancelModal').classList.add('open');
};
document.getElementById('cancelNo').addEventListener('click', () => {
  document.getElementById('cancelModal').classList.remove('open');
  pendingCancelId = null;
});
document.getElementById('cancelYes').addEventListener('click', async () => {
  if (!pendingCancelId) return;
  try {
    const res = await fetch(`${BOOK_API}/${pendingCancelId}/cancel`, { method: 'PATCH' });
    const data = await res.json();
    if (data.success) {
      showToast('Booking cancelled', 'success');
      document.getElementById('cancelModal').classList.remove('open');
      pendingCancelId = null;
      loadMyBookings();
    } else showToast(data.message, 'error');
  } catch { showToast('Failed to cancel', 'error'); }
});
function setupAdmin() {
  if (user.role !== 'admin') return;
  if (adminReady) return;
  adminReady = true;

  document.getElementById('openAddModal').classList.remove('hidden');
  const addModal = document.getElementById('addModal');
  document.getElementById('openAddModal').addEventListener('click', () => {
    fillFacilitySelect('add-facilities');
    addModal.classList.add('open');
  });
  document.getElementById('closeAdd').addEventListener('click', () => addModal.classList.remove('open'));
  document.getElementById('cancelAdd').addEventListener('click', () => addModal.classList.remove('open'));

  document.getElementById('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const hallId = Number(fd.get('hall_id'));
    if (hallId <= 0) { showToast('Hall ID must be greater than 0', 'error'); return; }
    const capacity = Number(fd.get('capacity'));
    if (capacity <= 0) { showToast('Capacity must be greater than 0', 'error'); return; }
    const payload = {
      hall_id: hallId, name: fd.get('name'), building: fd.get('building'),
      capacity, floor: fd.get('floor'),
      facilities: collectFacilities(e.target)
    };
    try {
      const res = await fetch(`${HALL_API}?role=${encodeURIComponent(user.role)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { showToast('Hall added!', 'success'); addModal.classList.remove('open'); e.target.reset(); fillFacilitySelect('add-facilities'); loadDashboard(); }
      else showToast(data.message, 'error');
    } catch { showToast('Error adding hall', 'error'); }
  });
  const editModal = document.getElementById('editModal');
  document.getElementById('closeEdit').addEventListener('click', () => editModal.classList.remove('open'));
  document.getElementById('cancelEdit').addEventListener('click', () => editModal.classList.remove('open'));

  document.getElementById('editForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('e-id').value;
    const fd = new FormData(e.target);
    const hallId = Number(fd.get('hall_id'));
    if (hallId <= 0) { showToast('Hall ID must be greater than 0', 'error'); return; }
    const capacity = Number(fd.get('capacity'));
    if (capacity <= 0) { showToast('Capacity must be greater than 0', 'error'); return; }
    const payload = {
      hall_id: hallId, name: fd.get('name'), building: fd.get('building'),
      capacity, floor: fd.get('floor'), status: fd.get('status'),
      facilities: collectFacilities(e.target)
    };
    try {
      const res = await fetch(`${HALL_API}/${id}?role=${encodeURIComponent(user.role)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { showToast('Hall updated!', 'success'); editModal.classList.remove('open'); loadDashboard(); }
      else showToast(data.message, 'error');
    } catch { showToast('Error updating hall', 'error'); }
  });
  const delModal = document.getElementById('deleteHallModal');
  let delHallId = null;
  document.getElementById('cancelDeleteHall').addEventListener('click', () => { delModal.classList.remove('open'); delHallId = null; });

  window.openDeleteHall = (id, name) => {
    delHallId = id;
    document.getElementById('deleteHallMsg').textContent = `Are you sure you want to delete ${name}?`;
    delModal.classList.add('open');
  };

  window.openEditHall = (id) => {
    const h = allHalls.find(x => x._id === id);
    if (!h) return;
    document.getElementById('e-id').value = h._id;
    document.getElementById('e-hallId').value = h.hall_id;
    document.getElementById('e-name').value = h.name;
    document.getElementById('e-building').value = h.building;
    document.getElementById('e-capacity').value = h.capacity;
    document.getElementById('e-floor').value = h.floor || '';
    document.getElementById('e-status').value = h.status;
    document.getElementById('e-newFacility').value = '';
    fillFacilitySelect('e-facilities', h.facilities || []);
    editModal.classList.add('open');
  };

  document.getElementById('confirmDeleteHall').addEventListener('click', async () => {
    if (!delHallId) return;
    try {
      const res = await fetch(`${HALL_API}/${delHallId}?role=${encodeURIComponent(user.role)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showToast('Hall deleted!', 'success'); delModal.classList.remove('open'); delHallId = null; loadDashboard(); }
      else showToast(data.message, 'error');
    } catch { showToast('Error deleting hall', 'error'); }
  });
}
const delBkModal = document.getElementById('deleteBookingModal');
let delBkId = null;
if (delBkModal) {
  document.getElementById('cancelDeleteBooking').addEventListener('click', () => { delBkModal.classList.remove('open'); delBkId = null; });

  window.openDeleteBooking = (id) => {
    delBkId = id;
    delBkModal.classList.add('open');
  };

  document.getElementById('confirmDeleteBooking').addEventListener('click', async () => {
    if (!delBkId) return;
    try {
      const role = encodeURIComponent(user && user.role ? user.role : '');
      const res = await fetch(`${BOOK_API}/${delBkId}?role=${role}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { showToast('Booking deleted!', 'success'); delBkModal.classList.remove('open'); delBkId = null; loadSchedule(); loadMyBookings(); }
      else showToast(data.message, 'error');
    } catch { showToast('Error deleting booking', 'error'); }
  });
}





