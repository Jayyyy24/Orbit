/* =========================================
   Orbit Analytics - Application Logic
   ========================================= */

// --- STATE MANAGEMENT ---
const defaultState = {
    expenses: [],
    trips: [],
    settings: {
        darkMode: true,
        notifications: false,
        currency: '',
        name: '',
        email: '',
        avatarSeed: ''
    }
};

let appState = JSON.parse(localStorage.getItem('orbitState'));

// Force a clean wipe if the old 'approvals' array exists from the previous version
if (appState && appState.approvals) {
    localStorage.removeItem('orbitState');
    appState = null;
}

if (!appState) {
    appState = defaultState;
    saveState();
}

function saveState() {
    localStorage.setItem('orbitState', JSON.stringify(appState));
}

// FORMATTER
function formatCurrency(amount) {
    return `${appState.settings.currency}${parseFloat(amount).toFixed(2)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    setupRouter();
    setupTheme();
    setupForms();
    setupSettings();
    setupModals();
    setupMobileMenu();

    // Initial Renders
    updateAllViews();
}

// --- ROUTER ---
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

const titles = {
    home: { title: 'Dashboard Overview', sub: 'Welcome, let\'s track your finances.' },
    expenses: { title: 'Expense Management', sub: 'Add and review your outgoing funds.' },
    trips: { title: 'Trip Budgets', sub: 'Track your travel spendings.' },
    settings: { title: 'User Settings', sub: 'Customize your Orbit experience.' },
    support: { title: 'Help & Support', sub: 'Get answers and contact our team.' }
};

function setupRouter() {
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const target = item.getAttribute('data-target');

            // UI Update
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(view => {
                view.classList.remove('active');
                view.classList.add('hidden');
                if (view.id === target) {
                    view.classList.remove('hidden');
                    // small delay for animation trigger
                    setTimeout(() => view.classList.add('active'), 10);
                }
            });

            // Header Update
            if (titles[target]) {
                pageTitle.innerText = titles[target].title;
                pageSubtitle.innerText = titles[target].sub;
            }

            // Rerender specific views if needed
            if (target === 'home') renderDashboard();
            if (target === 'expenses') renderExpenses();
            if (target === 'trips') renderTrips();
        });
    });

    // Quick Add Button
    document.getElementById('quick-add-btn').addEventListener('click', () => {
        document.querySelector('.nav-item[data-target="expenses"]').click();
        document.getElementById('exp-title').focus();
    });
}

// --- MOBILE MENU ---
function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-sidebar-overlay');
    
    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    }
    
    menuBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('show');
    });
    
    overlay.addEventListener('click', closeSidebar);
    
    // Auto-close when clicking any nav item on mobile
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if(window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}

// --- THEME SETUP ---
function applyTheme() {
    const body = document.body;
    const toggleBtn = document.getElementById('theme-toggle');
    const settingToggle = document.getElementById('setting-dark-mode');

    // Apply from state
    if (appState.settings.darkMode) {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        if(settingToggle) settingToggle.checked = true;
    } else {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        toggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        if(settingToggle) settingToggle.checked = false;
    }
}

function setupTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    applyTheme(); // Setup initial state

    toggleBtn.addEventListener('click', () => {
        appState.settings.darkMode = !appState.settings.darkMode;
        saveState();
        applyTheme(); // Updates visuals without adding new listeners
        renderDashboard(); // Re-render chart for colors
    });
}

// --- UPDATERS ---
function updateAllViews() {
    renderDashboard();
    renderExpenses();
    renderTrips();
    applySettingsToUI();
}

// --- DASHBOARD ---
let chartInstance = null;
function renderDashboard() {
    const totalExpenses = appState.expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    // Determine balance logically (e.g. Budget/Income - Expenses) - for static display, we will just show 0 if empty
    const fakeBalance = appState.expenses.length > 0 ? (totalExpenses * 1.5) - totalExpenses : 0.00;

    document.getElementById('home-total-balance').innerText = formatCurrency(fakeBalance > 0 ? fakeBalance : 0);
    document.getElementById('home-total-expenses').innerText = formatCurrency(totalExpenses);
    document.getElementById('home-active-trips').innerText = appState.trips.length;

    // Recent Transactions
    const recentList = document.getElementById('recent-transactions-list');
    recentList.innerHTML = '';
    const recent = [...appState.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (recent.length === 0) {
        recentList.innerHTML = '<p class="empty-state">No recent transactions.</p>';
    } else {
        recent.forEach(exp => {
            recentList.innerHTML += `
                <div class="txn-item">
                    <div class="flex-between" style="gap: 1rem; width:100%">
                        <div>
                            <strong>${exp.title}</strong>
                            <p class="text-xs mt-2">${exp.date}</p>
                        </div>
                        <div style="text-align:right">
                            <strong style="color:var(--danger)">-${formatCurrency(exp.amount)}</strong>
                            <p class="text-xs mt-2">${exp.category}</p>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // Render Chart
    if (chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('expenseChart').getContext('2d');
    const emptyStateTxt = document.getElementById('chart-empty-state');
    const chartCanvas = document.getElementById('expenseChart');

    if (appState.expenses.length === 0) {
        emptyStateTxt.style.display = 'block';
        chartCanvas.style.display = 'none';
        return;
    } else {
        emptyStateTxt.style.display = 'none';
        chartCanvas.style.display = 'block';
    }

    // Aggregate by category
    const catData = {};
    appState.expenses.forEach(e => {
        catData[e.category] = (catData[e.category] || 0) + parseFloat(e.amount);
    });

    const isDark = appState.settings.darkMode;
    const textColor = isDark ? '#f8fafc' : '#0f172a';

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catData),
            datasets: [{
                data: Object.values(catData),
                backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: textColor } }
            }
        }
    });
}

// --- EXPENSES ---
function renderExpenses() {
    const tbody = document.getElementById('expenses-tbody');
    const emptyState = document.getElementById('expenses-empty');
    const tableEl = document.getElementById('expenses-table');
    const totalBadge = document.getElementById('expense-total-badge');

    // Select dropdowns
    const addTripSelect = document.getElementById('exp-trip-select');
    const editTripSelect = document.getElementById('edit-exp-trip-select');

    tbody.innerHTML = '';

    // Populate trip selects
    const tripOptions = '<option value="">None</option>' + appState.trips.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    addTripSelect.innerHTML = tripOptions;
    editTripSelect.innerHTML = tripOptions;

    const total = appState.expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    totalBadge.innerText = `Total: ${formatCurrency(total)}`;

    if (appState.expenses.length === 0) {
        emptyState.style.display = 'block';
        tableEl.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        tableEl.style.display = 'table';

        // Sort newest first
        const sorted = [...appState.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

        sorted.forEach(exp => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${exp.date}</td>
                <td><strong>${exp.title}</strong><br><span class="badge text-xs" style="color:var(--primary)">${exp.tripId ? getTripName(exp.tripId) : ''}</span></td>
                <td>${exp.category}</td>
                <td style="font-weight:600">${formatCurrency(exp.amount)}</td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn btn-sm" onclick="openEditModal(${exp.id})" title="Edit"><i class="fa-solid fa-pen"></i></button>
                        <button class="icon-btn btn-sm" onclick="deleteExpense(${exp.id})" title="Delete"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

window.deleteExpense = function (id) {
    if (confirm('Are you sure you want to delete this expense?')) {
        appState.expenses = appState.expenses.filter(e => e.id !== id);
        saveState();
        renderExpenses();
        renderDashboard();
        showToast('Expense deleted', 'success');
    }
}

function getTripName(id) {
    const t = appState.trips.find(t => t.id === id);
    return t ? t.name : '';
}

// --- TRIPS ---
function renderTrips() {
    const container = document.getElementById('trips-container');
    const emptyState = document.getElementById('trips-empty');

    container.innerHTML = '';

    if (appState.trips.length === 0) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';

        appState.trips.forEach(trip => {
            // Calculate spent
            const spent = appState.expenses.filter(e => e.tripId === trip.id).reduce((s, e) => s + parseFloat(e.amount), 0);
            const percent = trip.budget > 0 ? (spent / trip.budget) * 100 : 0;
            let barClass = '';
            if (percent > 85) barClass = 'danger';
            else if (percent > 65) barClass = 'warning';

            const card = document.createElement('div');
            card.className = 'trip-card hover-glow';
            card.innerHTML = `
                <i class="fa-solid fa-trash trip-delete" onclick="deleteTrip('${trip.id}')" title="Delete Trip"></i>
                <h4>${trip.name}</h4>
                <p class="text-xs mt-2"><i class="fa-regular fa-calendar"></i> ${trip.start} to ${trip.end}</p>
                <div class="mt-4 flex-between">
                    <span class="text-xs">Spent: ${formatCurrency(spent)}</span>
                    <span class="text-xs" style="font-weight:bold">Budget: ${formatCurrency(trip.budget)}</span>
                </div>
                <div class="trip-progress-bar">
                    <div class="trip-progress-fill ${barClass}" style="width: ${Math.min(percent, 100)}%"></div>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

window.deleteTrip = function (id) {
    if (confirm('Are you sure you want to delete this trip? Associated expenses will be kept but unlinked.')) {
        appState.trips = appState.trips.filter(t => t.id !== id);
        // Unlink expenses
        appState.expenses.forEach(e => {
            if (e.tripId === id) e.tripId = '';
        });
        saveState();
        renderTrips();
        renderExpenses();
        renderDashboard();
        showToast('Trip deleted', 'success');
    }
}

// --- FORMS & MODALS ---
const editModal = document.getElementById('edit-modal-overlay');

function setupModals() {
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    // Close modal on click outside
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) editModal.classList.add('hidden');
    });

    // Edit Form Submit
    document.getElementById('edit-expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-exp-id').value);
        const exp = appState.expenses.find(x => x.id === id);

        if (exp) {
            exp.title = document.getElementById('edit-exp-title').value;
            exp.amount = document.getElementById('edit-exp-amount').value;
            exp.date = document.getElementById('edit-exp-date').value;
            exp.category = document.getElementById('edit-exp-category').value;
            exp.tripId = document.getElementById('edit-exp-trip-select').value;

            saveState();
            renderExpenses();
            renderDashboard();
            renderTrips(); // updates progress bars
            editModal.classList.add('hidden');
            showToast('Expense Updated', 'success');
        }
    });
}

window.openEditModal = function (id) {
    const exp = appState.expenses.find(x => x.id === id);
    if (exp) {
        document.getElementById('edit-exp-id').value = exp.id;
        document.getElementById('edit-exp-title').value = exp.title;
        document.getElementById('edit-exp-amount').value = exp.amount;
        document.getElementById('edit-exp-date').value = exp.date;
        document.getElementById('edit-exp-category').value = exp.category;
        document.getElementById('edit-exp-trip-select').value = exp.tripId;

        editModal.classList.remove('hidden');
    }
}

function setupForms() {
    // Expense Add Form
    document.getElementById('expense-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const obj = {
            id: Date.now(),
            title: document.getElementById('exp-title').value,
            amount: document.getElementById('exp-amount').value,
            date: document.getElementById('exp-date').value,
            category: document.getElementById('exp-category').value,
            tripId: document.getElementById('exp-trip-select').value
        };
        appState.expenses.push(obj);
        saveState();
        renderExpenses();
        renderDashboard();
        renderTrips();
        e.target.reset();
        showToast('Expense Added', 'success');
    });

    // Trip Add Form
    document.getElementById('trip-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const obj = {
            id: 'trip_' + Date.now(),
            name: document.getElementById('trip-name').value,
            start: document.getElementById('trip-start').value,
            end: document.getElementById('trip-end').value,
            budget: document.getElementById('trip-budget').value
        };
        appState.trips.push(obj);
        saveState();
        renderTrips();
        renderExpenses(); // update dropdown
        e.target.reset();
        showToast('Trip Created', 'success');
    });

    // Support Form
    document.getElementById('support-form').addEventListener('submit', (e) => {
        e.preventDefault();
        document.getElementById('support-alert').classList.remove('hidden');
        document.getElementById('support-alert').classList.add('success-btn'); // green style
        e.target.reset();
        setTimeout(() => {
            document.getElementById('support-alert').classList.add('hidden');
        }, 4000);
        showToast('Message Sent', 'success');
    });
}

// --- SETTINGS ---
function setupSettings() {
    const dModeToggle = document.getElementById('setting-dark-mode');
    const notifToggle = document.getElementById('setting-notifications');
    const currSelect = document.getElementById('setting-currency');
    const profileForm = document.getElementById('profile-form');
    const chooseAvatarBtn = document.getElementById('choose-avatar-btn');

    dModeToggle.addEventListener('change', (e) => {
        appState.settings.darkMode = e.target.checked;
        saveState();
        applyTheme();
        renderDashboard();
        showToast('Theme updated', 'success');
    });

    notifToggle.addEventListener('change', (e) => {
        appState.settings.notifications = e.target.checked;
        saveState();
        applySettingsToUI();
        showToast('Preferences updated', 'success');
    });

    currSelect.addEventListener('change', (e) => {
        appState.settings.currency = e.target.value;
        saveState();
        updateAllViews();
        showToast(`Currency changed`, 'success');
    });

    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        appState.settings.name = document.getElementById('setting-name').value;
        appState.settings.email = document.getElementById('setting-email').value;
        saveState();
        applySettingsToUI();
        showToast('Profile Updated', 'success');
    });

    // Avatar Selection Logic
    const avatarModal = document.getElementById('avatar-modal-overlay');
    const closeAvatarModal = document.getElementById('close-avatar-modal-btn');
    const avatarGrid = document.getElementById('avatar-grid');

    const cartoonSeeds = ['Felix', 'Aneka', 'Caleb', 'Abby', 'Jack', 'Jocelyn', 'Mason', 'Luna', 'Leo', 'Mia', 'Oliver', 'Zoe', 'Elijah', 'Lily', 'James', 'Aria', 'William', 'Chloe', 'Benjamin', 'Nora'];

    // Populate grid
    if (avatarGrid) {
        avatarGrid.innerHTML = cartoonSeeds.map(seed => {
            return `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}" class="avatar-option" data-seed="${seed}" alt="${seed} Avatar">`;
        }).join('');
    }

    if (chooseAvatarBtn) {
        chooseAvatarBtn.addEventListener('click', () => {
            avatarModal.classList.remove('hidden');
        });
    }

    if (closeAvatarModal) {
        closeAvatarModal.addEventListener('click', () => {
            avatarModal.classList.add('hidden');
        });
    }

    if (avatarModal) {
        avatarModal.addEventListener('click', (e) => {
            if(e.target === avatarModal) avatarModal.classList.add('hidden');
        });
    }

    if (avatarGrid) {
        avatarGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('avatar-option')) {
                appState.settings.avatarSeed = e.target.getAttribute('data-seed');
                saveState();
                applySettingsToUI();
                avatarModal.classList.add('hidden');
                showToast('Avatar updated', 'success');
            }
        });
    }
}

function applySettingsToUI() {
    const s = appState.settings;
    document.getElementById('setting-dark-mode').checked = s.darkMode;
    document.getElementById('setting-notifications').checked = s.notifications;
    document.getElementById('setting-currency').value = s.currency || '$';
    document.getElementById('setting-name').value = s.name;
    document.getElementById('setting-email').value = s.email;

    // Notifications badge logic
    const badge = document.getElementById('nav-badge');
    if (s.notifications) {
        badge.style.display = 'flex';
        badge.innerText = '1';
    } else {
        badge.style.display = 'none';
    }

    // Avatar Logic (Cartoon Avatars)
    let avatarUrl = '';
    if (s.avatarSeed) {
        avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.avatarSeed}`;
    } else {
        const displaySeed = s.name ? s.name : 'U';
        avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${displaySeed}`;
    }
    document.getElementById('setting-avatar-preview').src = avatarUrl;
    document.getElementById('sidebar-avatar').src = avatarUrl;
    document.getElementById('sidebar-name').innerText = s.name ? s.name : 'New User';
}

// --- UTILS ---
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '<i class="fa-solid fa-check-circle" style="color:var(--success)"></i>' : '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>';
    toast.innerHTML = `${icon} ${msg}`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
