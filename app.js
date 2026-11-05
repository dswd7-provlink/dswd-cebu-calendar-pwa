
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
  'CLUSTER OFFICE 2': '#0891B2',
  'POO OFFICE': '#4F7942'
};

let activities = [];
let focalList = [];
let clusterList = [];
let currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let selectedDate = '';
let selectedActivity = null;
let selectedCluster = '';
const PAGE_SIZE = 10;
let activitiesPage = 1;
let specialOrdersPage = 1;
let completedPage = 1;

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

function splitMultiValue(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  return String(value || '').split(/\s*\|\s*/).map(v => v.trim()).filter(Boolean);
}

function joinMultiValue(values) {
  return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))].join(' | ');
}

function hasMultiValue(value, selected) {
  if (!selected) return true;
  return splitMultiValue(value).some(v => v.toUpperCase() === String(selected).toUpperCase());
}

function renderCheckOptions(containerId, values, groupName) {
  const container = $(containerId);
  if (!container) return;
  container.innerHTML = values.length ? values.map((value, index) => `
    <label class="multi-check-option" for="${groupName}-${index}">
      <input type="checkbox" id="${groupName}-${index}" name="${groupName}" value="${escapeHTML(value)}">
      <span class="custom-check" aria-hidden="true"></span>
      <span class="option-text">${escapeHTML(value)}</span>
    </label>
  `).join('') : '<span class="loading-option">No options available.</span>';
}

function setCheckedValues(containerId, values) {
  const wanted = new Set(splitMultiValue(values).map(v => v.toUpperCase()));
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.checked = wanted.has(input.value.toUpperCase());
  });
}

function getCheckedValues(containerId) {
  const container = $(containerId);
  if (!container) return [];
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
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

async function loadFocals() {
  try {
    const result = await apiRequest('getFocalList');
    focalList = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.result)
        ? result.result
        : Array.isArray(result)
          ? result
          : [];

    renderCheckOptions('activityResponsibleFocal', focalList, 'activity-focal');
    $('soFocalFilter').innerHTML = '<option value="">All Responsible Focals</option>' +
      focalList.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('');
  } catch (error) {
    console.error('Focal list loading error:', error);
    $('activityResponsibleFocal').innerHTML = '<span class="loading-option">Unable to load focal list.</span>';
    showToast('Unable to load Responsible Focal list.');
  }
}


async function loadClusters() {
  try {
    const result = await apiRequest('getClusterList');
    clusterList = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.result)
        ? result.result
        : Array.isArray(result)
          ? result
          : [];

    $('clusterFilter').innerHTML = '<option value="">All Clusters</option>' +
      clusterList.map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('');

    renderCheckOptions('activityCluster', clusterList, 'activity-cluster');

    if (selectedCluster) $('clusterFilter').value = selectedCluster;
  } catch (error) {
    console.error('Cluster list loading error:', error);
    showToast('Unable to load Cluster list. Check the CLUSTERS sheet and API deployment.');
  }
}

/* =========================================================
   FILTERS
========================================================= */

function getFilteredActivities() {
  return activities.filter(activity => {
    return !selectedCluster || hasMultiValue(activity.cluster, selectedCluster);
  });
}

/* =========================================================
   SUMMARY CARDS
========================================================= */

function renderSummary() {
  $('totalCount').textContent = activities.length;

  $('scheduledCount').textContent =
    activities.filter(a => a.status === 'SCHEDULED' || a.status === 'MOVED').length;

  const completedTotal = activities.filter(a => a.status === 'DONE').length;
  $('completedCount').textContent = completedTotal;
  if ($('completedNavCount')) $('completedNavCount').textContent = completedTotal;

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
        const color = clusterColor(splitMultiValue(activity.cluster)[0]);

        html += `
          <div class="event ${activity.status === 'DONE' ? 'done' : ''}"
               style="background:${color}"
               data-activity-id="${escapeHTML(activity.id)}">
            <div class="event-title">${escapeHTML(activity.title)}</div>
            <div class="event-office">${escapeHTML(splitMultiValue(activity.cluster).join(', '))}</div>
          </div>
        `;
      });
    } else if (dayActivities.length) {
      const clusterDots = [...new Set(dayActivities.flatMap(a => splitMultiValue(a.cluster)))]
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
        ${escapeHTML(splitMultiValue(activity.cluster).join(', '))}
      </div>
      <div class="activity-meta">
        ${escapeHTML(prettyDate(activity.startDate || activity.date))}
        ${activity.endDate ? ' – ' + escapeHTML(prettyDate(activity.endDate)) : ''}
      </div>
      <span class="office-label" style="color:${clusterColor(splitMultiValue(activity.cluster)[0])}">
        ${escapeHTML(splitMultiValue(activity.cluster).join(', '))}
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
   UPCOMING CONVERGENCE
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
            · 
          </div>
          <div class="activity-meta">${escapeHTML(splitMultiValue(activity.cluster).join(', '))}</div>
        </div>
      `).join('')
    : '<div class="empty-state">No completed activities.</div>';
}

function requiresSpecialOrder(activity) {
  const value = String(activity.specialOrderRequired ?? activity.specialOrder ?? 'NO').trim().toUpperCase();
  return ['YES', 'Y', 'TRUE', '1'].includes(value);
}

function activityCard(activity, showSO = false) {
  return `<article class="record-card" data-activity-id="${escapeHTML(activity.id)}">
    <div class="record-card-top"><span class="cluster-chip" style="--cluster:${clusterColor(splitMultiValue(activity.cluster)[0])}">${escapeHTML(splitMultiValue(activity.cluster).join(', ') || 'No cluster')}</span>
      ${showSO ? `<span class="so-required-chip">SPECIAL ORDER REQUIRED</span><span class="status-badge so-upload-status ${String(activity.specialOrderStatus || 'FOR PREPARATION').toLowerCase().replace(/\\s+/g, '-') }">${escapeHTML(activity.specialOrderStatus || 'FOR PREPARATION')}</span>` : `<span class="status-badge ${statusClass(activity.status)}">${escapeHTML(activity.status || 'SCHEDULED')}</span>`}</div>
    <h3>${escapeHTML(activity.title || 'Untitled activity')}</h3>
    <p class="record-date">${escapeHTML(prettyDate(activity.startDate || activity.date))}${activity.endDate ? ' – ' + escapeHTML(prettyDate(activity.endDate)) : ''}</p>
    <div class="record-meta"><span>♙ ${escapeHTML(splitMultiValue(activity.responsibleFocal).join(', ') || 'Focal not specified')}</span></div>
    ${showSO ? `<div class="so-upload-actions">${activity.specialOrderFileUrl ? `<a class="btn-secondary" href="${escapeHTML(activity.specialOrderFileUrl)}" target="_blank" rel="noopener">View PDF</a>` : ''}<button type="button" class="btn-primary" data-so-upload="${escapeHTML(activity.id)}">${activity.specialOrderFileUrl ? 'Replace PDF' : 'Upload Signed PDF'}</button></div>` : ''}
  </article>`;
}

function renderPagination(containerId, totalItems, currentPage, onPageChange) {
  const container = $(containerId);
  if (!container) return;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalItems);
  let buttons = `<button type="button" class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
  for (let page = 1; page <= totalPages; page++) {
    if (totalPages > 7 && page > 2 && page < totalPages - 1 && Math.abs(page - currentPage) > 1) {
      if (page === 3 || page === totalPages - 2) buttons += '<span class="page-ellipsis">…</span>';
      continue;
    }
    buttons += `<button type="button" class="page-btn ${page === currentPage ? 'active' : ''}" data-page="${page}" ${page === currentPage ? 'aria-current="page"' : ''}>${page}</button>`;
  }
  buttons += `<button type="button" class="page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
  container.innerHTML = `<span class="pagination-info">Showing ${start}–${end} of ${totalItems}</span><div class="pagination-controls">${buttons}</div>`;
  container.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    const nextPage = Number(button.dataset.page);
    if (nextPage >= 1 && nextPage <= totalPages) onPageChange(nextPage);
  }));
}

function renderAllActivities() {
  const query = String($('activitySearch')?.value || '').trim().toLowerCase();
  // Completed activities are shown in their own tab, not in the active list.
  const list = [...activities]
    .filter(a => a.status !== 'DONE')
    .sort((a,b) => String(b.startDate || b.date || '').localeCompare(String(a.startDate || a.date || '')))
    .filter(a => [a.title, a.cluster, a.responsibleFocal, a.status].join(' ').toLowerCase().includes(query));
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  activitiesPage = Math.min(activitiesPage, totalPages);
  const pageItems = list.slice((activitiesPage - 1) * PAGE_SIZE, activitiesPage * PAGE_SIZE);
  $('allActivitiesList').innerHTML = list.length ? pageItems.map(a => activityCard(a)).join('') : '<div class="empty-state">No active activities found.</div>';
  renderPagination('activitiesPagination', list.length, activitiesPage, page => { activitiesPage = page; renderAllActivities(); });
}

function renderCompletedActivities() {
  const list = [...activities]
    .filter(a => a.status === 'DONE')
    .sort((a,b) => String(b.startDate || b.date || '').localeCompare(String(a.startDate || a.date || '')));
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  completedPage = Math.min(completedPage, totalPages);
  const pageItems = list.slice((completedPage - 1) * PAGE_SIZE, completedPage * PAGE_SIZE);
  $('completedActivitiesList').innerHTML = list.length
    ? pageItems.map(a => activityCard(a)).join('')
    : '<div class="empty-state">No completed activities yet.</div>';
  renderPagination('completedPagination', list.length, completedPage, page => { completedPage = page; renderCompletedActivities(); });
}

async function uploadSpecialOrderForActivity(activityId, file) {
  if (!file) return;
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { showToast('Please select a PDF file.'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('PDF must not exceed 5 MB.'); return; }
  const activity = activities.find(a => String(a.id) === String(activityId));
  if (!activity || !requiresSpecialOrder(activity)) { showToast('This activity does not require a Special Order.'); return; }
  try {
    showToast('Uploading Special Order PDF...');
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Unable to read the selected PDF.'));
      reader.readAsDataURL(file);
    });
    await apiRequest('uploadSpecialOrder', [activityId, file.name, base64]);
    showToast('Special Order uploaded successfully.');
    await loadActivities();
  } catch (error) { showToast(error.message || 'Upload failed.'); }
  finally { $('specialOrderFileInput').value = ''; }
}

function renderSpecialOrders() {
  const required = activities.filter(requiresSpecialOrder);
  const total = activities.length;
  $('soTotal').textContent = total;
  $('soRequired').textContent = required.length;
  $('soNotRequired').textContent = total - required.length;
  $('soPercent').textContent = total ? Math.round(required.length / total * 100) + '%' : '0%';
  $('specialOrderNavCount').textContent = required.length;
  const cluster = $('soClusterFilter').value;
  const month = $('soMonthFilter').value;
  const focal = $('soFocalFilter').value;
  const list = required.filter(a => {
    const date = a.startDate || a.date || '';
    return (!cluster || hasMultiValue(a.cluster, cluster)) &&
      (!month || date.slice(0,7) === month) &&
      (!focal || hasMultiValue(a.responsibleFocal, focal));
  }).sort((a,b) => String(a.startDate || a.date || '').localeCompare(String(b.startDate || b.date || '')));
  $('soResultCount').textContent = `${list.length} ${list.length === 1 ? 'activity' : 'activities'}`;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  specialOrdersPage = Math.min(specialOrdersPage, totalPages);
  const pageItems = list.slice((specialOrdersPage - 1) * PAGE_SIZE, specialOrdersPage * PAGE_SIZE);
  $('specialOrdersList').innerHTML = list.length ? pageItems.map(a => activityCard(a, true)).join('') : '<div class="empty-state">No activities requiring a Special Order match these filters.</div>';
  renderPagination('specialOrdersPagination', list.length, specialOrdersPage, page => { specialOrdersPage = page; renderSpecialOrders(); });
}

function switchView(view) {
  document.querySelectorAll('.app-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.view === view));
  document.querySelectorAll('.view-calendar').forEach(el => el.hidden = view !== 'calendar');
  $('activitiesView').hidden = view !== 'activities';
  $('specialOrdersView').hidden = view !== 'special-orders';
  $('completedView').hidden = view !== 'completed';
  if (view === 'activities') renderAllActivities();
  if (view === 'completed') renderCompletedActivities();
  if (view === 'special-orders') renderSpecialOrders();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  renderAllActivities();
  renderCompletedActivities();
  renderSpecialOrders();
}

/* =========================================================
   ACTIVITY FORM
========================================================= */

function openActivityModal(activity = null) {
  selectedActivity = activity;
  $('activityForm').reset();
  setCheckedValues('activityCluster', []);
  setCheckedValues('activityResponsibleFocal', []);

  $('activityId').value = activity ? activity.id : '';
  $('modalTitle').textContent = activity ? 'Edit Activity' : 'Add Activity';

  if (activity) {
    $('activityTitle').value = activity.title || '';
    $('activityDate').value = activity.startDate || activity.date || '';
    $('activityEndDate').value = activity.endDate || '';
    setCheckedValues('activityCluster', activity.cluster);
    setCheckedValues('activityResponsibleFocal', activity.responsibleFocal);
    $('activitySpecialOrder').value =
      String(activity.specialOrderRequired || 'NO').toUpperCase();
    $('activityDescription').value = activity.description || '';
    $('activityPurpose').value = activity.purpose || '';
    $('activityRemarks').value = activity.remarks || '';
  } else {
    $('activityDate').value = isoDate(new Date());
    $('activitySpecialOrder').value = 'NO';
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
    cluster: joinMultiValue(getCheckedValues('activityCluster')),
    responsibleFocal: joinMultiValue(getCheckedValues('activityResponsibleFocal')),
    specialOrderRequired: $('activitySpecialOrder').value,
    description: $('activityDescription').value.trim(),
    purpose: $('activityPurpose').value.trim(),
    remarks: $('activityRemarks').value.trim()
  };

  if (!activity.cluster || !activity.responsibleFocal) {
    showToast('Please select at least one Cluster and one Responsible Focal.');
    return;
  }

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
  const activity = activities.find(a => String(a.id) === String(id));
  if (!activity) return;

  selectedActivity = activity;

  $('activityDetails').innerHTML = `
    <div class="activity-detail">
      <h3>${escapeHTML(activity.title)}</h3>

      <p><strong>Activity ID:</strong> ${escapeHTML(activity.id)}</p>
      <p><strong>Date:</strong> ${escapeHTML(prettyDate(activity.date))}</p>
      ${activity.endDate ? `<p><strong>End Date:</strong> ${escapeHTML(prettyDate(activity.endDate))}</p>` : ''}
      <p><strong>Cluster:</strong> ${escapeHTML(splitMultiValue(activity.cluster).join(', '))}</p>
      <p><strong>Municipality:</strong> </p>
      <p><strong>Responsible Focal:</strong> ${escapeHTML(splitMultiValue(activity.responsibleFocal).join(', ') || 'Not specified')}</p>
      <p><strong>Special Order Required:</strong> ${escapeHTML(activity.specialOrderRequired || 'NO')}</p>
      ${requiresSpecialOrder(activity) ? `<p><strong>Special Order Progress:</strong> <span class="status-badge so-upload-status ${String(activity.specialOrderStatus || 'FOR PREPARATION').toLowerCase().replace(/\\s+/g, '-')}">${escapeHTML(activity.specialOrderStatus || 'FOR PREPARATION')}</span></p>
      ${activity.specialOrderDraftedAt ? `<p><strong>Marked as drafted:</strong> ${escapeHTML(activity.specialOrderDraftedAt)}</p>` : ''}
      ${activity.specialOrderDraftedBy ? `<p><strong>Marked by:</strong> ${escapeHTML(activity.specialOrderDraftedBy)}</p>` : ''}` : ''}
      <p><strong>Name:</strong> ${escapeHTML(activity.description || 'None')}</p>
      <p><strong>Purpose:</strong> ${escapeHTML(activity.purpose || 'None')}</p>
      <p><strong>Status:</strong>
        <span class="status-badge ${statusClass(activity.status)}">
          ${escapeHTML(activity.status)}
        </span>
      </p>
      <p><strong>Remarks:</strong> ${escapeHTML(activity.remarks || 'None')}</p>
    </div>
  `;

  renderActivityActions(activity);
  $('detailsModal').classList.add('show');
}

function renderActivityActions(activity) {
  const actions = [];

  if (requiresSpecialOrder(activity) && activity.specialOrderStatus === 'FOR PREPARATION') {
    actions.push(`<button class="btn-primary" data-action="mark-so-drafted">Mark as Drafted</button>`);
  }

  if (activity.status !== 'CANCELLED') {
    actions.push(`<button class="btn-secondary" data-action="edit">Edit</button>`);
    actions.push(`<button class="btn-secondary" data-action="reschedule">Reschedule</button>`);
  }

  if (activity.status === 'SCHEDULED' || activity.status === 'MOVED') {
    actions.push(`<button class="btn-primary" data-action="done">Mark Done</button>`);
    actions.push(`<button class="btn-secondary" data-action="cancel">Cancel Activity</button>`);
  }

  if (activity.status === 'DONE') {
    actions.push(`<button class="btn-secondary" data-action="reopen">Reopen</button>`);
  }

  if (activity.status === 'CANCELLED') {
    actions.push(`<button class="btn-primary" data-action="restore">Restore</button>`);
  }

  actions.push(`<button class="btn-secondary" data-action="history">View History</button>`);
  actions.push(`<button class="btn-secondary" data-action="delete">Delete</button>`);

  $('activityActions').innerHTML = actions.join('');
}

function closeDetailsModal() {
  $('detailsModal').classList.remove('show');
}

function openRescheduleModal(activity) {
  if (!activity) return;
  $('rescheduleActivityName').textContent = activity.title || 'Untitled activity';
  $('rescheduleActivityId').textContent = activity.id || '';
  $('rescheduleStartDate').value = activity.startDate || activity.date || '';
  $('rescheduleEndDate').value = activity.endDate || '';
  $('rescheduleEndDate').min = $('rescheduleStartDate').value;
  $('rescheduleRemarks').value = '';
  $('rescheduleError').hidden = true;
  $('rescheduleError').textContent = '';
  $('rescheduleModal').classList.add('show');
  $('rescheduleModal').setAttribute('aria-hidden', 'false');
}

function closeRescheduleModal() {
  $('rescheduleModal').classList.remove('show');
  $('rescheduleModal').setAttribute('aria-hidden', 'true');
}

async function submitReschedule(event) {
  event.preventDefault();
  const activity = selectedActivity;
  if (!activity) return;

  const newDate = $('rescheduleStartDate').value;
  const newEndDate = $('rescheduleEndDate').value;
  const remarks = $('rescheduleRemarks').value.trim();
  const errorBox = $('rescheduleError');
  const submitButton = $('confirmRescheduleBtn');

  if (!newDate) {
    errorBox.textContent = 'Please select a new start date.';
    errorBox.hidden = false;
    return;
  }
  if (newEndDate && newEndDate < newDate) {
    errorBox.textContent = 'The end date cannot be earlier than the start date.';
    errorBox.hidden = false;
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Saving...';
  errorBox.hidden = true;

  try {
    await apiRequest('rescheduleActivity', [activity.id, newDate, remarks, newEndDate]);
    closeRescheduleModal();
    closeDetailsModal();
    showToast('Activity rescheduled successfully.');
    await loadActivities();
  } catch (error) {
    errorBox.textContent = error.message || 'Unable to reschedule this activity.';
    errorBox.hidden = false;
    console.error(error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Confirm Reschedule';
  }
}

/* =========================================================
   SHARED MODERN ACTION + HISTORY MODALS
========================================================= */

let pendingActivityAction = null;

function openActionModal(action, activity) {
  if (!activity) return;
  selectedActivity = activity;
  pendingActivityAction = action;

  const config = {
    'mark-so-drafted': {
      title: 'Mark Special Order as Drafted',
      subtitle: 'Confirm that the Special Order document has been prepared.',
      button: 'Mark as Drafted',
      icon: '✎',
      message: 'This will update the Special Order progress for this activity.',
      remarksLabel: '', placeholder: '', required: false
    },
    done: {
      title: 'Mark Activity as Done',
      subtitle: 'Confirm that this activity has been completed.',
      button: 'Mark as Done', icon: '✓',
      message: 'The activity will move to the Completed tab. Its record and history will be retained.',
      remarksLabel: 'Completion remarks', placeholder: 'Add completion notes (optional)...', required: false
    },
    reopen: {
      title: 'Reopen Activity',
      subtitle: 'Return this completed activity to the active schedule.',
      button: 'Reopen Activity', icon: '↺',
      message: 'The activity status will return to scheduled.',
      remarksLabel: 'Reason for reopening', placeholder: 'Enter reason (optional)...', required: false
    },
    cancel: {
      title: 'Cancel Activity',
      subtitle: 'Please provide the reason for cancellation.',
      button: 'Confirm Cancellation', icon: '!',
      message: 'The activity will be marked as cancelled and retained in the records.',
      remarksLabel: 'Cancellation reason', placeholder: 'Enter the reason for cancellation...', required: true
    },
    restore: {
      title: 'Restore Activity',
      subtitle: 'Restore this cancelled activity to the schedule.',
      button: 'Restore Activity', icon: '↻',
      message: 'The activity will become active again.',
      remarksLabel: 'Remarks', placeholder: 'Optional restoration remarks...', required: false
    },
    delete: {
      title: 'Delete Activity',
      subtitle: 'This action permanently removes the activity record.',
      button: 'Delete Permanently', icon: '×',
      message: 'This cannot be undone. Please confirm that you want to permanently delete this activity.',
      remarksLabel: '', placeholder: '', required: false, danger: true
    }
  }[action];

  if (!config) return;
  $('actionModalTitle').textContent = config.title;
  $('actionModalSubtitle').textContent = config.subtitle;
  $('actionModalIcon').textContent = config.icon;
  $('actionModalActivity').textContent = activity.title || 'Untitled activity';
  $('actionModalActivityId').textContent = activity.id || '';
  $('actionModalMessage').textContent = config.message;
  $('actionRemarksLabel').textContent = config.remarksLabel;
  $('actionRemarks').placeholder = config.placeholder;
  $('actionRemarks').value = '';
  $('actionRemarks').required = !!config.required;
  $('actionRemarksGroup').hidden = !config.remarksLabel;
  $('actionModalError').hidden = true;

  const confirmButton = $('confirmActionBtn');
  confirmButton.textContent = config.button;
  confirmButton.classList.toggle('btn-danger', !!config.danger);
  confirmButton.classList.toggle('btn-primary', !config.danger);
  $('actionModalIcon').classList.toggle('danger', !!config.danger);
  $('actionModal').classList.add('show');
  $('actionModal').setAttribute('aria-hidden', 'false');
  $('actionRemarks').focus();
}

function closeActionModal() {
  $('actionModal').classList.remove('show');
  $('actionModal').setAttribute('aria-hidden', 'true');
  pendingActivityAction = null;
}

async function submitActionModal(event) {
  event.preventDefault();
  const activity = selectedActivity;
  const action = pendingActivityAction;
  if (!activity || !action) return;

  const id = activity.id;
  const remarks = $('actionRemarks').value.trim();
  const errorBox = $('actionModalError');
  const button = $('confirmActionBtn');
  if (action === 'cancel' && !remarks) {
    errorBox.textContent = 'Please enter a cancellation reason.';
    errorBox.hidden = false;
    return;
  }

  button.disabled = true;
  button.textContent = 'Processing...';
  errorBox.hidden = true;
  try {
    if (action === 'mark-so-drafted') {
      await apiRequest('markSpecialOrderDrafted', [id]);
    } else if (action === 'done') {
      await apiRequest('markActivityDone', [id, remarks]);
    } else if (action === 'reopen') {
      await apiRequest('reopenActivity', [id, remarks]);
    } else if (action === 'cancel') {
      await apiRequest('cancelActivity', [id, remarks]);
    } else if (action === 'restore') {
      await apiRequest('restoreActivity', [id, remarks || 'Activity restored.']);
    } else if (action === 'delete') {
      await apiRequest('deleteActivity', [id]);
    }

    closeActionModal();
    closeDetailsModal();
    const messages = {
      'mark-so-drafted': 'Special Order marked as drafted.',
      done: 'Activity marked as done.',
      reopen: 'Activity reopened successfully.',
      cancel: 'Activity cancelled successfully.',
      restore: 'Activity restored successfully.',
      delete: 'Activity deleted successfully.'
    };
    showToast(messages[action] || 'Activity updated successfully.');
    await loadActivities();
    if (action === 'mark-so-drafted') {
      const refreshed = activities.find(item => String(item.id) === String(id));
      if (refreshed) openDetails(id);
    }
  } catch (error) {
    errorBox.textContent = error.message || 'Unable to complete this action.';
    errorBox.hidden = false;
    console.error(error);
  } finally {
    button.disabled = false;
    const labels = {
      'mark-so-drafted': 'Mark as Drafted', done: 'Mark as Done', reopen: 'Reopen Activity',
      cancel: 'Confirm Cancellation', restore: 'Restore Activity', delete: 'Delete Permanently'
    };
    button.textContent = labels[action] || 'Confirm';
  }
}

async function openHistoryModal(activity) {
  if (!activity) return;
  $('historyActivityName').textContent = activity.title || 'Untitled activity';
  $('historyActivityId').textContent = activity.id || '';
  $('historyTimeline').innerHTML = '<div class="modal-loading"><span class="loading-spinner"></span> Loading activity history...</div>';
  $('historyModal').classList.add('show');
  $('historyModal').setAttribute('aria-hidden', 'false');
  try {
    const response = await apiRequest('getActivityHistory', [activity.id]);
    const history = response.data || response.result || response.history || response;
    if (!Array.isArray(history) || !history.length) {
      $('historyTimeline').innerHTML = '<div class="modal-empty"><span>◷</span><strong>No history available</strong><p>No recorded changes were found for this activity.</p></div>';
      return;
    }
    $('historyTimeline').innerHTML = history.slice().reverse().map(item => `
      <article class="history-entry">
        <span class="history-dot"></span>
        <div class="history-entry-content">
          <strong>${escapeHTML(item.action || item.activity || 'Activity update')}</strong>
          <time>${escapeHTML(item.timestamp || item.date || '')}</time>
          ${item.remarks ? `<p>${escapeHTML(item.remarks)}</p>` : ''}
          ${item.performedBy ? `<small>By ${escapeHTML(item.performedBy)}</small>` : ''}
        </div>
      </article>
    `).join('');
  } catch (error) {
    $('historyTimeline').innerHTML = `<div class="modal-error">${escapeHTML(error.message || 'Unable to load activity history.')}</div>`;
  }
}

function closeHistoryModal() {
  $('historyModal').classList.remove('show');
  $('historyModal').setAttribute('aria-hidden', 'true');
}

/* =========================================================
   ACTIVITY ACTIONS
========================================================= */

async function performActivityAction(action) {
  const activity = selectedActivity;
  if (!activity) return;

  if (action === 'edit') {
    closeDetailsModal();
    openActivityModal(activity);
    return;
  }
  if (action === 'reschedule') {
    openRescheduleModal(activity);
    return;
  }
  if (action === 'history') {
    openHistoryModal(activity);
    return;
  }
  if (['mark-so-drafted', 'done', 'reopen', 'cancel', 'restore', 'delete'].includes(action)) {
    openActionModal(action, activity);
  }
}

/* =========================================================
   EVENT LISTENERS
========================================================= */

function bindEvents() {
  document.querySelectorAll('.app-tab').forEach(tab => tab.addEventListener('click', () => switchView(tab.dataset.view)));
  $('activitySearch').addEventListener('input', () => { activitiesPage = 1; renderAllActivities(); });
  ['soClusterFilter', 'soMonthFilter', 'soFocalFilter'].forEach(id => $(id).addEventListener('change', () => { specialOrdersPage = 1; renderSpecialOrders(); }));
  $('clearSoFilters').addEventListener('click', () => { $('soClusterFilter').value = ''; $('soMonthFilter').value = ''; $('soFocalFilter').value = ''; specialOrdersPage = 1; renderSpecialOrders(); });
  $('completedActivitiesList').addEventListener('click', event => {
    const card = event.target.closest('[data-activity-id]');
    if (card) openDetails(card.dataset.activityId);
  });

  ['allActivitiesList', 'specialOrdersList'].forEach(id => $(id).addEventListener('click', event => { const upload = event.target.closest('[data-so-upload]'); if (upload) { event.stopPropagation(); $('specialOrderFileInput').dataset.activityId = upload.dataset.soUpload; $('specialOrderFileInput').click(); return; } if (event.target.closest('a')) return; const card = event.target.closest('[data-activity-id]'); if (card) openDetails(card.dataset.activityId); }));
  $('specialOrderFileInput').addEventListener('change', event => { const file = event.target.files && event.target.files[0]; if (file) uploadSpecialOrderForActivity(event.target.dataset.activityId, file); });
  $('closeModalBtn').addEventListener('click', closeActivityModal);
  $('cancelModalBtn').addEventListener('click', closeActivityModal);
  $('activityForm').addEventListener('submit', saveActivity);

  $('closeDetailsBtn').addEventListener('click', closeDetailsModal);
  $('closeRescheduleBtn').addEventListener('click', closeRescheduleModal);
  $('cancelRescheduleBtn').addEventListener('click', closeRescheduleModal);
  $('rescheduleForm').addEventListener('submit', submitReschedule);
  $('actionForm').addEventListener('submit', submitActionModal);
  $('closeActionModalBtn').addEventListener('click', closeActionModal);
  $('cancelActionBtn').addEventListener('click', closeActionModal);
  $('closeHistoryModalBtn').addEventListener('click', closeHistoryModal);
  $('rescheduleStartDate').addEventListener('change', () => {
    $('rescheduleEndDate').min = $('rescheduleStartDate').value;
    if ($('rescheduleEndDate').value && $('rescheduleEndDate').value < $('rescheduleStartDate').value) {
      $('rescheduleEndDate').value = $('rescheduleStartDate').value;
    }
  });
  $('rescheduleModal').addEventListener('click', event => {
    if (event.target === $('rescheduleModal')) closeRescheduleModal();
  });
  $('actionModal').addEventListener('click', event => {
    if (event.target === $('actionModal')) closeActionModal();
  });
  $('historyModal').addEventListener('click', event => {
    if (event.target === $('historyModal')) closeHistoryModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('rescheduleModal').classList.contains('show')) closeRescheduleModal();
    if ($('actionModal').classList.contains('show')) closeActionModal();
    if ($('historyModal').classList.contains('show')) closeHistoryModal();
  });
  $('closeCompletedBtn').addEventListener('click', () => {
    $('completedModal').classList.remove('show');
  });

  $('showCompletedBtn').addEventListener('click', () => switchView('completed'));
  $('addActivityBtn').addEventListener('click', () => openActivityModal());

  $('prevMonthBtn').addEventListener('click', () => changeMonth(-1));
  $('nextMonthBtn').addEventListener('click', () => changeMonth(1));

  $('todayBtn').addEventListener('click', () => {
    currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    selectedDate = isoDate(new Date());
    renderAll();
  });

  $('clusterFilter').addEventListener('change', event => {
    selectedCluster = event.target.value;
    renderAll();
  });
$('resetFiltersBtn').addEventListener('click', () => {
    selectedCluster = '';
    $('clusterFilter').value = '';
    renderAll();
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
    await loadFocals();
    await loadClusters();
    await loadActivities();
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

document.addEventListener('DOMContentLoaded', initializeApp);
