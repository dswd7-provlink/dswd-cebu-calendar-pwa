/* =========================================================
   DSWD CEBU CLUSTER 1 & 2 ACTIVITY CALENDAR PWA
   Frontend application
========================================================= */

const API_URL = 'https://dswd-cebu-calendar-api.cebu-bdm-api.workers.dev';

const CLUSTER_COLORS = {
  'CLUSTER 1A': '#2563EB',
  'CLUSTER 1B': '#0D9488',
  'CLUSTER 2A': '#7C3AED',
  'CLUSTER 2B': '#D97706',
  'CLUSTER 2C': '#DB2777',
  'CLUSTER OFFICE 1': '#475569',
  'CLUSTER OFFICE 2': '#0891B2'
};

let activities = [];
let locations = {};
let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = '';
let selectedActivity = null;
let selectedCluster = '';
let selectedMunicipality = '';

const $ = id => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function prettyDate(value) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString('en-PH', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : '';
}

function clusterColor(cluster) {
  return CLUSTER_COLORS[String(cluster || '').toUpperCase()] || '#64748B';
}

function statusClass(status) {
  return 'status-' + String(status || 'SCHEDULED').toLowerCase();
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function setConnection(status, message) {
  const element = $('connectionStatus');
  element.classList.remove('connected', 'error');

  if (status === 'connected') element.classList.add('connected');
  if (status === 'error') element.classList.add('error');

  $('connectionText').textContent = message;
}

function updateClock() {
  const now = new Date();

  $('liveTime').textContent = now.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  $('liveDate').textContent = now.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric'
  }).toUpperCase();
}

/* =========================================================
   API CONNECTION
========================================================= */

async function apiRequest(action, args = []) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action,
      args
    })
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}.`);
  }

  const result = await response.json();

  if (result.success === false) {
    throw new Error(result.error || result.message || 'Request failed.');
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}

async function checkConnection() {
  try {
    const result = await apiRequest('ping');
    setConnection('connected', 'API Connected');
    return result;
  } catch (error) {
    setConnection('error', 'Connection failed');
    console.error(error);
    throw error;
  }
}

/* =========================================================
   LOAD DATA
========================================================= */

async function loadActivities() {
  try {
    const result = await apiRequest('getActivities');

    activities = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.result)
        ? result.result
        : Array.isArray(result)
          ? result
          : [];

    renderAll();
    setConnection('connected', 'API Connected');
  } catch (error) {
    console.error('Activity loading error:', error);
    setConnection('error', 'Unable to load data');
    showToast(error.message);
  }
}

async function loadLocations() {
  try {
    const result = await apiRequest('getLocationData');

    locations = result.data || result.result || result || {};

    populateMunicipalities();
  } catch (error) {
    console.error('Location loading error:', error);
  }
}

/* =========================================================
   FILTERS
========================================================= */

function getFilteredActivities() {
  return activities.filter(activity => {
    const cluster = String(activity.cluster || '').toUpperCase();
    const municipality = String(activity.municipality || '');

    return (
      (!selectedCluster || cluster === selectedCluster) &&
      (!selectedMunicipality || municipality === selectedMunicipality)
    );
  });
}

function populateFormMunicipalities(clusterKey, selectedValue = '') {
  const formSelect = $('activityMunicipality');
  const list = Array.isArray(locations[String(clusterKey || '').toUpperCase()])
    ? locations[String(clusterKey || '').toUpperCase()]
    : [];

  formSelect.innerHTML =
    '<option value="">Select Municipality</option>' +
    [...new Set(list)].sort().map(item =>
      `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`
    ).join('');

  if (list.includes(selectedValue)) formSelect.value = selectedValue;
}

function populateMunicipalities() {
  const select = $('municipalityFilter');

  const previousFilter = selectedMunicipality;
  const clusterKey = selectedCluster;
  let list = [];

  if (clusterKey && Array.isArray(locations[clusterKey])) {
    list = locations[clusterKey];
  } else {
    list = Object.values(locations).flat();
  }

  list = [...new Set(list)].sort();

  select.innerHTML =
    '<option value="">All Municipalities</option>' +
    list.map(item =>
      `<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`
    ).join('');

  if (list.includes(previousFilter)) {
    select.value = previousFilter;
  } else {
    selectedMunicipality = '';
  }
}

/* =========================================================
   SUMMARY CARDS
========================================================= */

function renderSummary() {
  $('totalCount').textContent = activities.length;

  $('scheduledCount').textContent =
    activities.filter(a => a.status === 'SCHEDULED' || a.status === 'MOVED').length;

  $('completedCount').textContent =
    activities.filter(a => a.status === 'DONE').length;

  $('cancelledCount').textContent =
    activities.filter(a => a.status === 'CANCELLED').length;
}

/* =========================================================
   CALENDAR
========================================================= */

function changeMonth(amount) {
  currentMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + amount,
    1
  );

  renderCalendar();
  renderDailyActivities();
}

function renderCalendar() {
  const grid = $('calendarGrid');
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  $('monthTitle').textContent =
    currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });

  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());
  const today = isoDate(new Date());
  const filtered = getFilteredActivities();

  let html = '';

  // Six weeks ensures every month fits.
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const dateString = isoDate(date);
    const inMonth = date.getMonth() === month;
    const isToday = dateString === today;
    const isSelected = dateString === selectedDate;

    const dayActivities = filtered.filter(activity => {
      const start = activity.startDate || activity.date;
      const end = activity.endDate || start;

      return (
        start &&
        start <= dateString &&
        dateString <= end &&
        activity.status !== 'CANCELLED'
      );
    });

    html += `
      <div class="day-cell
        ${!inMonth ? 'other-month' : ''}
        ${isToday ? 'today' : ''}
        ${isSelected ? 'selected' : ''}"
        data-date="${dateString}">

        <div class="day-number">${date.getDate()}</div>
        <div class="events">
    `;

    if (dayActivities.length <= 2) {
      dayActivities.forEach(activity => {
        const color = clusterColor(activity.cluster);

        html += `
          <div class="event ${activity.status === 'DONE' ? 'done' : ''}"
               style="background:${color}"
               data-activity-id="${escapeHTML(activity.id)}">
            <div class="event-title">${escapeHTML(activity.title)}</div>
            <div class="event-office">${escapeHTML(activity.cluster)}</div>
          </div>
        `;
      });
    } else if (dayActivities.length) {
      const clusterDots = [...new Set(dayActivities.map(a => a.cluster))]
        .map(cluster => `
          <span class="activity-group-dot"
                style="background:${clusterColor(cluster)}"></span>
        `).join('');

      html += `
        <div class="activity-group">
          <div class="activity-group-count">
            ${dayActivities.length} ACTIVITIES
          </div>
          <div class="activity-group-dots">${clusterDots}</div>
          <div class="activity-group-preview">
            View all activities
          </div>
        </div>
      `;
    }

    html += '</div></div>';
  }

  grid.innerHTML = html;
}

/* =========================================================
   DAILY ACTIVITIES
========================================================= */

function renderDailyActivities() {
  const container = $('dailyActivities');

  if (!selectedDate) {
    $('selectedDateLabel').textContent = 'Select a calendar date';
    container.innerHTML =
      '<div class="empty-state">Select a date to view activities.</div>';
    return;
  }

  $('selectedDateLabel').textContent = prettyDate(selectedDate);

  const list = getFilteredActivities().filter(activity => {
    const start = activity.startDate || activity.date;
    const end = activity.endDate || start;

    return (
      start &&
      start <= selectedDate &&
      selectedDate <= end &&
      activity.status !== 'CANCELLED'
    );
  });

  if (!list.length) {
    container.innerHTML =
      '<div class="empty-state">No activities scheduled for this date.</div>';
    return;
  }

  container.innerHTML = list.map(activity => `
    <div class="activity-item"
         data-activity-id="${escapeHTML(activity.id)}">
      <h4>${escapeHTML(activity.title)}</h4>
      <div class="activity-meta">
        ${escapeHTML(activity.cluster)} · ${escapeHTML(activity.municipality)}
      </div>
      <div class="activity-meta">
        ${escapeHTML(prettyDate(activity.startDate || activity.date))}
        ${activity.endDate ? ' – ' + escapeHTML(prettyDate(activity.endDate)) : ''}
      </div>
      <span class="office-label" style="color:${clusterColor(activity.cluster)}">
        ${escapeHTML(activity.cluster)}
      </span>
      <div>
        <span class="status-badge ${statusClass(activity.status)}">
          ${escapeHTML(activity.status)}
        </span>
      </div>
    </div>
  `).join('');
}
/* =========================================================
   UPCOMING ACTIVITIES
========================================================= */

function renderUpcoming() {
  const today = isoDate(new Date());

  const list = activities
    .filter(activity =>
      (activity.startDate || activity.date) >= today &&
      activity.status !== 'DONE' &&
      activity.status !== 'CANCELLED'
    )
    .sort((a, b) =>
      (a.startDate || a.date).localeCompare(b.startDate || b.date)
    )
    .slice(0, 6);

  $('upcomingList').innerHTML = list.length
    ? list.map(activity => `
        <div class="activity-item"
             data-activity-id="${escapeHTML(activity.id)}">
          <h4>${escapeHTML(activity.title)}</h4>
          <div class="activity-meta">
            ${escapeHTML(prettyDate(activity.startDate || activity.date))}
          </div>
          <div class="activity-meta">
            ${escapeHTML(activity.municipality)}
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">No upcoming activities.</div>';
}

/* =========================================================
   COMPLETED ACTIVITIES
========================================================= */

function renderCompleted() {
  const list = activities
    .filter(activity => activity.status === 'DONE')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  $('recentCompleted').innerHTML = list.slice(0, 3).length
    ? list.slice(0, 3).map(activity => `
        <div class="activity-item"
             data-activity-id="${escapeHTML(activity.id)}">
          <h4>${escapeHTML(activity.title)}</h4>
          <div class="activity-meta">
            ${escapeHTML(prettyDate(activity.date))}
          </div>
        </div>
      `).join('')
    : '<div class="empty-state">No completed activities yet.</div>';

  $('completedList').innerHTML = list.length
    ? list.map(activity => `
        <div class="activity-item"
             data-activity-id="${escapeHTML(activity.id)}">
          <h4>${escapeHTML(activity.title)}</h4>
          <div class="activity-meta">
            ${escapeHTML(prettyDate(activity.date))}
            · ${escapeHTML(activity.municipality)}
          </div>
          <div class="activity-meta">${escapeHTML(activity.cluster)}</div>
        </div>
      `).join('')
    : '<div class="empty-state">No completed activities.</div>';
}

/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {
  renderSummary();
  renderCalendar();
  renderDailyActivities();
  renderUpcoming();
  renderCompleted();
}

/* =========================================================
   ACTIVITY FORM
========================================================= */

function openActivityModal(activity = null) {
  selectedActivity = activity;

  $('activityForm').reset();

  $('activityId').value = activity ? activity.id : '';
  $('modalTitle').textContent = activity ? 'Edit Activity' : 'Add Activity';

  if (activity) {
    $('activityTitle').value = activity.title || '';
    $('activityDate').value = activity.startDate || activity.date || '';
    $('activityEndDate').value = activity.endDate || '';
    $('activityCluster').value = activity.cluster || '';
    $('activityResponsibleFocal').value = activity.responsibleFocal || '';
    $('activitySpecialOrder').value =
      String(activity.specialOrderRequired || 'NO').toUpperCase();

    $('activityBarangay').value = activity.barangay || '';
    $('activityVenue').value = activity.venue || '';
    $('activityDescription').value = activity.description || '';

    populateFormMunicipalities(
      activity.cluster,
      activity.municipality || ''
    );

    $('activityRemarks').value = activity.remarks || '';
  } else {
    $('activityDate').value = isoDate(new Date());
    populateFormMunicipalities($('activityCluster').value);
  }

  $('activityModal').classList.add('show');
}

function closeActivityModal() {
  $('activityModal').classList.remove('show');
}

async function saveActivity(event) {
  event.preventDefault();

  const id = $('activityId').value;

  const activity = {
    id,
    title: $('activityTitle').value.trim(),
    date: $('activityDate').value,
    endDate: $('activityEndDate').value,
    cluster: $('activityCluster').value,
    responsibleFocal: $('activityResponsibleFocal').value.trim(),
    specialOrderRequired: $('activitySpecialOrder').value,
    municipality: $('activityMunicipality').value,
    barangay: $('activityBarangay').value.trim(),
    venue: $('activityVenue').value.trim(),
    description: $('activityDescription').value.trim(),
    remarks: $('activityRemarks').value.trim()
  };

  if (activity.endDate && activity.endDate < activity.date) {
    showToast('End Date cannot be earlier than Start Date.');
    return;
  }

  const button = $('saveActivityBtn');
  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    if (id) {
      await apiRequest('updateActivity', [activity]);
      showToast('Activity updated successfully.');
    } else {
      await apiRequest('saveActivity', [activity]);
      showToast('Activity saved successfully.');
    }

    closeActivityModal();
    await loadActivities();
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Save Activity';
  }
}

/* =========================================================
   ACTIVITY DETAILS
========================================================= */

function openDetails(id) {
  const activity = activities.find(
    a => String(a.id) === String(id)
  );

  if (!activity) return;

  selectedActivity = activity;

  $('activityDetails').innerHTML = `
    <div class="activity-detail">
      <h3>${escapeHTML(activity.title)}</h3>

      <p><strong>Activity ID:</strong> ${escapeHTML(activity.id)}</p>
      <p><strong>Date:</strong> ${escapeHTML(prettyDate(activity.date))}</p>

      ${activity.endDate
        ? `<p><strong>End Date:</strong> ${escapeHTML(prettyDate(activity.endDate))}</p>`
        : ''}

      <p><strong>Cluster:</strong> ${escapeHTML(activity.cluster)}</p>
      <p><strong>Municipality:</strong> ${escapeHTML(activity.municipality)}</p>
      <p><strong>Responsible Focal:</strong>
        ${escapeHTML(activity.responsibleFocal || 'Not specified')}
      </p>
      <p><strong>Special Order Required:</strong>
        ${escapeHTML(activity.specialOrderRequired || 'NO')}
      </p>
      <p><strong>Barangay:</strong>
        ${escapeHTML(activity.barangay || 'Not specified')}
      </p>
      <p><strong>Venue:</strong>
        ${escapeHTML(activity.venue || 'Not specified')}
      </p>
      <p><strong>Description:</strong>
        ${escapeHTML(activity.description || 'None')}
      </p>
      <p><strong>Status:</strong>
        <span class="status-badge ${statusClass(activity.status)}">
          ${escapeHTML(activity.status)}
        </span>
      </p>
      <p><strong>Remarks:</strong>
        ${escapeHTML(activity.remarks || 'None')}
      </p>
    </div>
  `;

  renderActivityActions(activity);
  $('detailsModal').classList.add('show');
}

function renderActivityActions(activity) {
  const actions = [];

  if (activity.status !== 'CANCELLED') {
    actions.push('<button class="btn-secondary" data-action="edit">Edit</button>');
    actions.push('<button class="btn-secondary" data-action="reschedule">Reschedule</button>');
  }

  if (activity.status === 'SCHEDULED' || activity.status === 'MOVED') {
    actions.push('<button class="btn-primary" data-action="done">Mark Done</button>');
    actions.push('<button class="btn-secondary" data-action="cancel">Cancel Activity</button>');
  }

  if (activity.status === 'DONE') {
    actions.push('<button class="btn-secondary" data-action="reopen">Reopen</button>');
  }

  if (activity.status === 'CANCELLED') {
    actions.push('<button class="btn-primary" data-action="restore">Restore</button>');
  }

  actions.push('<button class="btn-secondary" data-action="history">View History</button>');
  actions.push('<button class="btn-secondary" data-action="delete">Delete</button>');

  $('activityActions').innerHTML = actions.join('');
}

function closeDetailsModal() {
  $('detailsModal').classList.remove('show');
}

/* =========================================================
   ACTIVITY ACTIONS
========================================================= */

async function performActivityAction(action) {
  const activity = selectedActivity;
  if (!activity) return;

  const id = activity.id;
  let result;

  try {
    if (action === 'edit') {
      closeDetailsModal();
      openActivityModal(activity);
      return;
    }

    if (action === 'done') {
      const remarks = prompt('Enter completion remarks (optional):') || '';
      result = await apiRequest('markActivityDone', [id, remarks]);
    }

    if (action === 'reopen') {
      const remarks = prompt('Reason for reopening (optional):') || '';
      result = await apiRequest('reopenActivity', [id, remarks]);
    }

    if (action === 'cancel') {
      const reason = prompt('Enter cancellation reason:');
      if (reason === null) return;
      result = await apiRequest('cancelActivity', [id, reason]);
    }

    if (action === 'restore') {
      if (!confirm('Restore this cancelled activity?')) return;
      result = await apiRequest('restoreActivity', [id, 'Activity restored.']);
    }

    if (action === 'reschedule') {
      const newDate = prompt(
        'New start date (YYYY-MM-DD):',
        activity.startDate || activity.date
      );

      if (!newDate) return;

      const newEndDate = prompt(
        'New end date (YYYY-MM-DD), or leave blank:',
        activity.endDate || ''
      );

      if (newEndDate === null) return;

      const remarks = prompt('Reason for rescheduling (optional):') || '';

      result = await apiRequest(
        'rescheduleActivity',
        [id, newDate, remarks, newEndDate]
      );
    }

    if (action === 'delete') {
      if (!confirm('Permanently delete this activity? This cannot be undone.')) {
        return;
      }

      result = await apiRequest('deleteActivity', [id]);
    }

    if (action === 'history') {
      const historyResult = await apiRequest('getActivityHistory', [id]);
      const history = historyResult.data || historyResult.result || historyResult;

      if (!Array.isArray(history) || !history.length) {
        alert('No activity history found.');
      } else {
        alert(history.map(item =>
          `${item.timestamp}\n${item.action}\n${item.remarks}`
        ).join('\n\n----------------\n\n'));
      }

      return;
    }

    if (result) {
      showToast('Activity updated successfully.');
      closeDetailsModal();
      await loadActivities();
    }

  } catch (error) {
    showToast(error.message);
    console.error(error);
  }
}
/* =========================================================
   EVENT LISTENERS
========================================================= */

function bindEvents() {
  $('addActivityBtn').addEventListener('click', () => openActivityModal());

  $('closeModalBtn').addEventListener('click', closeActivityModal);
  $('cancelModalBtn').addEventListener('click', closeActivityModal);

  $('activityForm').addEventListener('submit', saveActivity);

  $('closeDetailsBtn').addEventListener('click', closeDetailsModal);

  $('closeCompletedBtn').addEventListener('click', () => {
    $('completedModal').classList.remove('show');
  });

  $('showCompletedBtn').addEventListener('click', () => {
    $('completedModal').classList.add('show');
  });

  $('prevMonthBtn').addEventListener('click', () => changeMonth(-1));
  $('nextMonthBtn').addEventListener('click', () => changeMonth(1));

  $('todayBtn').addEventListener('click', () => {
    currentMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );

    selectedDate = isoDate(new Date());
    renderAll();
  });

  $('clusterFilter').addEventListener('change', event => {
    selectedCluster = event.target.value;
    populateMunicipalities();
    renderAll();
  });

  $('municipalityFilter').addEventListener('change', event => {
    selectedMunicipality = event.target.value;
    renderAll();
  });

  $('resetFiltersBtn').addEventListener('click', () => {
    selectedCluster = '';
    selectedMunicipality = '';

    $('clusterFilter').value = '';
    $('municipalityFilter').value = '';

    populateMunicipalities();
    renderAll();
  });

  $('activityCluster').addEventListener('change', event => {
    populateFormMunicipalities(event.target.value);
  });

  $('calendarGrid').addEventListener('click', event => {
    const eventItem = event.target.closest('[data-activity-id]');

    if (eventItem) {
      openDetails(eventItem.dataset.activityId);
      return;
    }

    const cell = event.target.closest('.day-cell');
    if (!cell) return;

    selectedDate = cell.dataset.date;

    renderCalendar();
    renderDailyActivities();
  });

  $('dailyActivities').addEventListener('click', event => {
    const item = event.target.closest('[data-activity-id]');
    if (item) openDetails(item.dataset.activityId);
  });

  $('upcomingList').addEventListener('click', event => {
    const item = event.target.closest('[data-activity-id]');
    if (item) openDetails(item.dataset.activityId);
  });

  $('recentCompleted').addEventListener('click', event => {
    const item = event.target.closest('[data-activity-id]');
    if (item) openDetails(item.dataset.activityId);
  });

  $('completedList').addEventListener('click', event => {
    const item = event.target.closest('[data-activity-id]');

    if (item) {
      $('completedModal').classList.remove('show');
      openDetails(item.dataset.activityId);
    }
  });

  $('activityActions').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) performActivityAction(button.dataset.action);
  });
}

/* =========================================================
   INITIALIZE
========================================================= */

async function initializeApp() {
  bindEvents();
  updateClock();

  setInterval(updateClock, 1000);

  selectedDate = isoDate(new Date());

  try {
    await checkConnection();
    await loadLocations();
    await loadActivities();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
