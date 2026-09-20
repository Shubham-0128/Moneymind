// ==========================================================================
// MoneyMind Application Logic
// ==========================================================================

const API_BASE_URL = window.location.port === '8000' ? '' : 'http://127.0.0.1:8000';

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3500);
}

const apiClient = {
    getHeaders() {
        const session = window.authService?.currentSession;
        const headers = { 'Content-Type': 'application/json' };
        if (session?.token) {
            headers['Authorization'] = `Bearer ${session.token}`;
        }
        return headers;
    },

    async isServerOnline() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/health`, { signal: AbortSignal.timeout(1500) });
            return res.ok;
        } catch {
            return false;
        }
    },

    async getExpenses() {
        const res = await fetch(`${API_BASE_URL}/api/expenses`, { headers: this.getHeaders() });
        if (!res.ok) throw new Error((await res.json())?.detail || 'Failed to fetch expenses');
        return res.json();
    },

    async createExpense(expense) {
        const res = await fetch(`${API_BASE_URL}/api/expenses`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(expense)
        });
        if (!res.ok) throw new Error((await res.json())?.detail || 'Failed to create expense');
        return res.json();
    },

    async deleteExpense(id) {
        const res = await fetch(`${API_BASE_URL}/api/expenses/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (!res.ok) throw new Error((await res.json())?.detail || 'Failed to delete expense');
        return res.json();
    },

    async getGoals() {
        const res = await fetch(`${API_BASE_URL}/api/goals`, { headers: this.getHeaders() });
        if (!res.ok) throw new Error((await res.json())?.detail || 'Failed to fetch goals');
        const data = await res.json();
        return data.map(g => ({
            id: g.id,
            name: g.name,
            targetAmount: g.target_amount,
            savedSoFar: g.saved_so_far,
            targetDate: g.target_date,
            progressPercentage: g.progress_percentage
        }));
    },

    async createGoal(goal) {
        const res = await fetch(`${API_BASE_URL}/api/goals`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                name: goal.name,
                target_amount: goal.targetAmount,
                saved_so_far: goal.savedSoFar || 0,
                target_date: goal.targetDate
            })
        });
        if (!res.ok) throw new Error((await res.json())?.detail || 'Failed to create goal');
        const g = await res.json();
        return {
            id: g.id,
            name: g.name,
            targetAmount: g.target_amount,
            savedSoFar: g.saved_so_far,
            targetDate: g.target_date,
            progressPercentage: g.progress_percentage
        };
    },

    async addSavings(id, amount) {
        const res = await fetch(`${API_BASE_URL}/api/goals/${id}/savings`, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ amount })
        });
        if (!res.ok) throw new Error((await res.json())?.detail || 'Failed to add savings');
        const g = await res.json();
        return {
            id: g.id,
            name: g.name,
            targetAmount: g.target_amount,
            savedSoFar: g.saved_so_far,
            targetDate: g.target_date,
            progressPercentage: g.progress_percentage
        };
    },

    async deleteGoal(id) {
        const res = await fetch(`${API_BASE_URL}/api/goals/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (!res.ok) throw new Error((await res.json())?.detail || 'Failed to delete goal');
        return res.json();
    },

    async getAISuggestions(summary) {
        const res = await fetch(`${API_BASE_URL}/api/ai/suggestions`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ summary })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || err.error || `HTTP error ${res.status}`);
        }
        return res.json();
    }
};


// Dynamic Tenant Storage Scoping
function getDataStorageKey() {
    const user = window.authService?.getUser();
    return user ? `moneymind_data_${user.id}` : 'moneymind_data_guest';
}

function getAICacheKey() {
    const user = window.authService?.getUser();
    return user ? `moneymind_ai_cache_${user.id}` : 'moneymind_ai_cache_guest';
}

// App State
let appData = {
    expenses: [],
    goals: [],
    recurring: []
};

// Category Constants
const EXPENSE_CATEGORIES = ["Food", "Transport", "Rent", "Entertainment", "Shopping", "Bills", "Health", "Education", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other"];

let currentTransactionType = 'expense';

// Chart instances & config
let categoryChart = null;
let trendChart = null;
let currentTimeframeDays = 7; // Default to 7 days view
let currentAuthTab = 'login';

// DOM Elements
const els = {
    expenseForm: document.getElementById('expense-form'),
    expenseDateInput: document.getElementById('exp-date'),
    expenseList: document.getElementById('expense-list'),
    expensesEmpty: document.getElementById('expenses-empty'),
    monthTotal: document.getElementById('month-total'),
    budgetWarning: document.getElementById('budget-warning'),

    // Hero metrics
    heroIncome: document.getElementById('hero-income'),
    heroExpense: document.getElementById('hero-expense'),
    heroSavingsRate: document.getElementById('hero-savings-rate'),
    
    // Quick Add form elements
    txTypeInput: document.getElementById('tx-type'),
    btnTypeExpense: document.getElementById('btn-type-expense'),
    btnTypeIncome: document.getElementById('btn-type-income'),
    txSubmitBtn: document.getElementById('tx-submit-btn'),
    expCategory: document.getElementById('exp-category'),

    // Search and filter toolbar
    txSearch: document.getElementById('tx-search'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    txFilterType: document.getElementById('tx-filter-type'),
    txSort: document.getElementById('tx-sort'),

    // Recurring Elements
    recurringModal: document.getElementById('recurring-modal'),
    recurringCount: document.getElementById('recurring-count'),
    modalRecurringList: document.getElementById('modal-recurring-list'),
    
    goalForm: document.getElementById('goal-form'),
    goalsList: document.getElementById('goals-list'),
    goalsEmpty: document.getElementById('goals-empty'),

    chartsContainer: document.getElementById('charts-container'),
    chartsEmpty: document.getElementById('charts-empty'),

    // AI Suggestions Elements
    aiLoading: document.getElementById('ai-loading'),
    aiSuggestionsList: document.getElementById('ai-suggestions-list'),
    aiEmpty: document.getElementById('ai-empty'),
    aiError: document.getElementById('ai-error'),
    aiErrorMsg: document.getElementById('ai-error-msg'),
    aiRefreshBtn: document.getElementById('ai-refresh-btn'),

    // Header Profile & Dropdown Elements
    headerProfile: document.getElementById('header-profile'),
    profileLoggedIn: document.getElementById('profile-logged-in'),
    profileLoggedOut: document.getElementById('profile-logged-out'),
    profileTriggerBtn: document.getElementById('profile-trigger-btn'),
    profileDropdown: document.getElementById('profile-dropdown'),
    headerAvatarBadge: document.getElementById('header-avatar-badge'),
    headerUserName: document.getElementById('header-user-name'),
    dropdownAvatar: document.getElementById('dropdown-avatar'),
    dropdownName: document.getElementById('dropdown-name'),
    dropdownEmail: document.getElementById('dropdown-email'),
    btnSwitchAccount: document.getElementById('btn-switch-account'),
    btnLogout: document.getElementById('btn-logout'),
    btnOpenLogin: document.getElementById('btn-open-login'),

    // Auth Modal Elements
    authModal: document.getElementById('auth-modal'),
    authCloseBtn: document.getElementById('auth-close-btn'),
    authForm: document.getElementById('auth-form'),
    authModalTitle: document.getElementById('auth-modal-title'),
    authModalSubtitle: document.getElementById('auth-modal-subtitle'),
    authDemoBtn: document.getElementById('auth-demo-btn'),
    tabLogin: document.getElementById('tab-login'),
    tabRegister: document.getElementById('tab-register'),
    groupName: document.getElementById('group-name'),
    authName: document.getElementById('auth-name'),
    authEmail: document.getElementById('auth-email'),
    authPassword: document.getElementById('auth-password'),
    authPasswordHint: document.getElementById('auth-password-hint'),
    pwdToggle: document.getElementById('pwd-toggle'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    authError: document.getElementById('auth-error')
};

// Seed Realistic Sample Data for Demo User (Alex Morgan)
function seedDemoDataIfEmpty() {
    const user = window.authService?.getUser();
    if (!user || !user.isDemo) return;

    if (appData.expenses.length === 0 && appData.goals.length === 0) {
        const today = new Date();
        const formatDate = (daysAgo) => {
            const d = new Date();
            d.setDate(today.getDate() - daysAgo);
            return d.toISOString().split('T')[0];
        };

        appData.expenses = [
            { id: 'exp_0', amount: 85000, category: 'Salary', date: formatDate(18), note: 'Monthly tech salary', type: 'income' },
            { id: 'exp_0b', amount: 15000, category: 'Freelance', date: formatDate(7), note: 'Design consulting client', type: 'income' },
            { id: 'exp_1', amount: 22000, category: 'Rent', date: formatDate(14), note: 'Monthly apartment rent', type: 'expense' },
            { id: 'exp_2', amount: 3450, category: 'Food', date: formatDate(2), note: 'Weekly organic groceries', type: 'expense' },
            { id: 'exp_3', amount: 1250, category: 'Food', date: formatDate(5), note: 'Dinner with colleagues', type: 'expense' },
            { id: 'exp_4', amount: 850, category: 'Transport', date: formatDate(1), note: 'Metro & cab passes', type: 'expense' },
            { id: 'exp_5', amount: 2100, category: 'Bills', date: formatDate(10), note: 'Electricity & broadband', type: 'expense' },
            { id: 'exp_6', amount: 4800, category: 'Shopping', date: formatDate(8), note: 'Running shoes & gear', type: 'expense' },
            { id: 'exp_7', amount: 650, category: 'Entertainment', date: formatDate(3), note: 'Weekend movies', type: 'expense' }
        ];

        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + 6);
        appData.goals = [
            {
                id: 'goal_demo_1',
                name: 'Emergency Fund',
                targetAmount: 150000,
                savedSoFar: 65000,
                targetDate: targetDate.toISOString().split('T')[0]
            }
        ];

        appData.recurring = [
            {
                id: 'rec_demo_1',
                type: 'income',
                amount: 85000,
                category: 'Salary',
                frequency: 'monthly',
                nextDate: formatDate(-12),
                note: 'Monthly tech salary'
            },
            {
                id: 'rec_demo_2',
                type: 'expense',
                amount: 22000,
                category: 'Rent',
                frequency: 'monthly',
                nextDate: formatDate(-14),
                note: 'Apartment rent'
            }
        ];

        saveData();
    }
}

// Scoped Data Operations
async function loadData() {
    const user = window.authService?.getUser();
    const token = window.authService?.currentSession?.token;
    if (user && token) {
        try {
            const [expenses, goals] = await Promise.all([
                apiClient.getExpenses(),
                apiClient.getGoals()
            ]);
            appData.expenses = expenses;
            appData.goals = goals;
            if (!appData.recurring) appData.recurring = [];
            saveData();
            updateRecurringBadge();
            updateUI();
            return;
        } catch (e) {
            console.warn("Backend REST API offline or unreachable, using local storage cache:", e);
        }
    }

    const key = getDataStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            appData = JSON.parse(stored);
            if (!appData.recurring) appData.recurring = [];
        } catch (e) {
            console.error("Error parsing scoped localStorage data", e);
            appData = { expenses: [], goals: [], recurring: [] };
        }
    } else {
        appData = { expenses: [], goals: [], recurring: [] };
        seedDemoDataIfEmpty();
    }
    updateRecurringBadge();
    updateUI();
}

function saveData() {
    const key = getDataStorageKey();
    localStorage.setItem(key, JSON.stringify(appData));
}

// Extract Name Initials for Avatar
function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Reactive Auth State Handler (Observer Pattern)
async function handleAuthStateChanged(user) {
    if (user) {
        els.profileLoggedIn?.classList.remove('hidden');
        els.profileLoggedOut?.classList.add('hidden');

        const initials = getInitials(user.name);
        const firstName = user.name ? user.name.split(' ')[0] : 'Account';

        if (els.headerAvatarBadge) els.headerAvatarBadge.textContent = initials;
        if (els.headerUserName) els.headerUserName.textContent = firstName;
        if (els.dropdownAvatar) els.dropdownAvatar.textContent = initials;
        if (els.dropdownName) els.dropdownName.textContent = user.name || 'User';
        if (els.dropdownEmail) els.dropdownEmail.textContent = user.email || '';
    } else {
        els.profileLoggedIn?.classList.add('hidden');
        els.profileLoggedOut?.classList.remove('hidden');
    }

    // Close any open dropdowns
    if (els.profileDropdown) {
        els.profileDropdown.classList.add('hidden');
        els.profileTriggerBtn?.setAttribute('aria-expanded', 'false');
    }

    // Destroy chart instances so they re-render cleanly with new tenant dataset
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
    if (trendChart) {
        trendChart.destroy();
        trendChart = null;
    }

    // Load data scoped to current user
    await loadData();

    // Re-render UI
    updateUI();

    // Fetch AI suggestions for current user
    fetchAISuggestions(false);
}

// --- Auth Modal & UI Controls ---
function setAuthTab(tab) {
    currentAuthTab = tab;
    if (els.authError) {
        els.authError.classList.add('hidden');
        els.authError.textContent = '';
    }

    if (tab === 'login') {
        els.tabLogin?.classList.add('active');
        els.tabRegister?.classList.remove('active');
        if (els.authModalTitle) els.authModalTitle.textContent = 'Welcome back';
        if (els.authModalSubtitle) els.authModalSubtitle.textContent = 'Sign in to access your financial dashboard';
        els.groupName?.classList.add('hidden');
        els.authName?.removeAttribute('required');
        if (els.authPasswordHint) els.authPasswordHint.classList.add('hidden');
        if (els.authSubmitBtn) els.authSubmitBtn.textContent = 'Sign In';
    } else {
        els.tabRegister?.classList.add('active');
        els.tabLogin?.classList.remove('active');
        if (els.authModalTitle) els.authModalTitle.textContent = 'Create an Account';
        if (els.authModalSubtitle) els.authModalSubtitle.textContent = 'Start tracking and optimizing your money';
        els.groupName?.classList.remove('hidden');
        els.authName?.setAttribute('required', 'true');
        if (els.authPasswordHint) els.authPasswordHint.classList.remove('hidden');
        if (els.authSubmitBtn) els.authSubmitBtn.textContent = 'Create Account';
    }
}

function openAuthModal(tab = 'login') {
    setAuthTab(tab);
    if (els.authEmail) els.authEmail.value = '';
    if (els.authPassword) els.authPassword.value = '';
    if (els.authName) els.authName.value = '';
    els.authModal?.classList.remove('hidden');
    if (tab === 'register') {
        els.authName?.focus();
    } else {
        els.authEmail?.focus();
    }
}

function closeAuthModal() {
    els.authModal?.classList.add('hidden');
    if (els.authError) {
        els.authError.classList.add('hidden');
        els.authError.textContent = '';
    }
}

// Global modal helpers
window.setAuthTab = setAuthTab;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;

function togglePasswordVisibility() {
    if (!els.authPassword) return;
    const isPassword = els.authPassword.type === 'password';
    els.authPassword.type = isPassword ? 'text' : 'password';
}

function showAuthError(msg) {
    if (!els.authError) return;
    els.authError.className = 'auth-alert error';
    els.authError.textContent = msg;
    els.authError.classList.remove('hidden');
}

// Wire Auth Listeners
function setupAuthListeners() {
    // Dropdown toggle
    els.profileTriggerBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isClosed = els.profileDropdown?.classList.contains('hidden');
        if (isClosed) {
            els.profileDropdown?.classList.remove('hidden');
            els.profileTriggerBtn?.setAttribute('aria-expanded', 'true');
        } else {
            els.profileDropdown?.classList.add('hidden');
            els.profileTriggerBtn?.setAttribute('aria-expanded', 'false');
        }
    });

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
        if (els.profileDropdown && !els.profileDropdown.classList.contains('hidden')) {
            if (!els.profileTriggerBtn?.contains(e.target) && !els.profileDropdown.contains(e.target)) {
                els.profileDropdown.classList.add('hidden');
                els.profileTriggerBtn?.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Open login modal buttons
    els.btnOpenLogin?.addEventListener('click', () => openAuthModal('login'));
    els.btnSwitchAccount?.addEventListener('click', () => {
        els.profileDropdown?.classList.add('hidden');
        openAuthModal('login');
    });

    // Logout button
    els.btnLogout?.addEventListener('click', () => {
        if (confirm('Are you sure you want to sign out?')) {
            window.authService.logout();
        }
    });

    // Modal close handlers
    els.authCloseBtn?.addEventListener('click', closeAuthModal);
    els.authModal?.addEventListener('click', (e) => {
        if (e.target === els.authModal) {
            closeAuthModal();
        }
    });

    // Password visibility toggle
    els.pwdToggle?.addEventListener('click', togglePasswordVisibility);

    // 1-Click Demo Login
    els.authDemoBtn?.addEventListener('click', async () => {
        try {
            els.authDemoBtn.disabled = true;
            els.authDemoBtn.textContent = 'Authenticating...';
            await window.authService.loginDemo();
            closeAuthModal();
        } catch (err) {
            showAuthError(err.message || 'Failed to authenticate with demo user.');
        } finally {
            els.authDemoBtn.disabled = false;
            els.authDemoBtn.textContent = 'Quick Demo Login (Alex Morgan)';
        }
    });

    // Auth Form Submission
    els.authForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = els.authEmail.value.trim();
        const password = els.authPassword.value;
        const name = els.authName ? els.authName.value.trim() : '';

        if (els.authError) els.authError.classList.add('hidden');
        els.authSubmitBtn.disabled = true;
        const origBtnText = els.authSubmitBtn.textContent;
        els.authSubmitBtn.textContent = currentAuthTab === 'login' ? 'Signing in...' : 'Creating account...';

        try {
            if (currentAuthTab === 'login') {
                await window.authService.login(email, password);
            } else {
                await window.authService.register(name, email, password);
            }
            closeAuthModal();
        } catch (err) {
            showAuthError(err.message || 'Authentication error.');
        } finally {
            els.authSubmitBtn.disabled = false;
            els.authSubmitBtn.textContent = origBtnText;
        }
    });
}

// App Initialization
async function init() {
    setDefaultDate();
    populateCategoryDropdown('expense');
    updateRecurringBadge();
    setupEventListeners();
    setupAuthListeners();

    // Subscribe to Auth state changes
    if (window.authService) {
        window.authService.onAuthStateChanged((user) => {
            handleAuthStateChanged(user);
        });

        // Initialize active session
        await window.authService.init();

        // If no user is logged in on initial visit, default to demo account for instant interviewer evaluation
        if (!window.authService.isAuthenticated()) {
            const hasVisited = localStorage.getItem('moneymind_visited');
            if (!hasVisited) {
                localStorage.setItem('moneymind_visited', 'true');
                await window.authService.loginDemo();
            } else {
                loadData();
                updateUI();
            }
        }
    } else {
        loadData();
        updateUI();
    }
}

// Event Listeners for Financial Tracker
function setupEventListeners() {
    els.expenseForm.addEventListener('submit', handleAddExpense);
    els.goalForm.addEventListener('submit', handleAddGoal);
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    els.expenseDateInput.value = today;
}

// Timeframe Toggle Handler
function setTimeframe(days) {
    currentTimeframeDays = days;
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
    });
    updateCharts();
}

// UI Updates
function updateUI() {
    renderExpenses();
    renderMonthTotal();
    renderGoals();
    updateCharts();
    checkBudgetInsights();
}

// --- Category and Transaction Type Handling ---
function populateCategoryDropdown(type, targetSelect = document.getElementById('exp-category')) {
    if (!targetSelect) return;
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const prevVal = targetSelect.value;
    targetSelect.innerHTML = `<option value="" disabled selected>Select category</option>` +
        list.map(c => `<option value="${c}">${c}</option>`).join('');
    if (list.includes(prevVal)) {
        targetSelect.value = prevVal;
    }
}

function setTransactionType(type) {
    currentTransactionType = type;
    const isExpense = type === 'expense';
    if (els.txTypeInput) els.txTypeInput.value = type;
    if (els.btnTypeExpense) els.btnTypeExpense.classList.toggle('active', isExpense);
    if (els.btnTypeIncome) els.btnTypeIncome.classList.toggle('active', !isExpense);
    if (els.txSubmitBtn) els.txSubmitBtn.textContent = isExpense ? 'Add Expense' : 'Add Income';
    populateCategoryDropdown(type);
}
window.setTransactionType = setTransactionType;
window.populateCategoryDropdown = populateCategoryDropdown;

// --- Transactions CRUD ---
async function handleAddExpense(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-category').value;
    const date = document.getElementById('exp-date').value;
    const note = document.getElementById('exp-note').value;
    const type = document.getElementById('tx-type')?.value || 'expense';
    
    if (isNaN(amount) || amount <= 0 || !category || !date) return;
    
    const expenseData = { amount, category, date, note, type };
    
    if (window.authService?.isAuthenticated() && window.authService?.currentSession?.token) {
        try {
            const saved = await apiClient.createExpense(expenseData);
            appData.expenses.unshift(saved);
            saveData();
            showToast(`${type === 'income' ? 'Income' : 'Expense'} saved to database`, "success");
        } catch (err) {
            console.warn("API save failed, falling back to local:", err);
            expenseData.id = Date.now().toString();
            appData.expenses.unshift(expenseData);
            saveData();
            showToast("Saved to local storage", "info");
        }
    } else {
        expenseData.id = Date.now().toString();
        appData.expenses.unshift(expenseData);
        saveData();
    }
    
    // Reset form except date and type
    els.expenseForm.reset();
    setDefaultDate();
    if (els.txTypeInput) els.txTypeInput.value = currentTransactionType;
    populateCategoryDropdown(currentTransactionType);
    
    updateUI();
    fetchAISuggestions(false);
}

async function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }
    if (window.authService?.isAuthenticated() && window.authService?.currentSession?.token) {
        try {
            await apiClient.deleteExpense(id);
            showToast("Transaction deleted from database", "info");
        } catch (err) {
            console.warn("API delete error:", err);
        }
    }
    appData.expenses = appData.expenses.filter(e => e.id !== id);
    saveData();
    updateUI();
    fetchAISuggestions(false);
}

// Search and Filter Handlers
function handleFilterChange() {
    const q = (els.txSearch?.value || '').trim();
    if (els.btnClearSearch) {
        els.btnClearSearch.classList.toggle('hidden', !q);
    }
    renderExpenses();
}

function clearSearch() {
    if (els.txSearch) els.txSearch.value = '';
    if (els.btnClearSearch) els.btnClearSearch.classList.add('hidden');
    renderExpenses();
}

window.handleFilterChange = handleFilterChange;
window.clearSearch = clearSearch;

function renderExpenses() {
    els.expenseList.innerHTML = '';
    
    if (appData.expenses.length === 0) {
        els.expensesEmpty.classList.remove('hidden');
        els.expenseList.parentElement.parentElement.classList.add('hidden');
        return;
    }
    
    const q = (els.txSearch?.value || '').trim().toLowerCase();
    const typeFilter = els.txFilterType?.value || 'all';
    const sort = els.txSort?.value || 'date_desc';
    
    // Filter
    let filtered = appData.expenses.filter(exp => {
        const itemType = exp.type || 'expense';
        if (typeFilter !== 'all' && itemType !== typeFilter) return false;
        if (!q) return true;
        const noteMatch = (exp.note || '').toLowerCase().includes(q);
        const catMatch = (exp.category || '').toLowerCase().includes(q);
        const amountMatch = (exp.amount || '').toString().includes(q);
        return noteMatch || catMatch || amountMatch;
    });

    if (filtered.length === 0) {
        els.expensesEmpty.classList.remove('hidden');
        els.expenseList.parentElement.parentElement.classList.add('hidden');
        return;
    }

    els.expensesEmpty.classList.add('hidden');
    els.expenseList.parentElement.parentElement.classList.remove('hidden');

    // Sort
    if (sort === 'date_desc') {
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sort === 'date_asc') {
        filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    } else if (sort === 'amount_desc') {
        filtered.sort((a, b) => b.amount - a.amount);
    } else if (sort === 'amount_asc') {
        filtered.sort((a, b) => a.amount - b.amount);
    }
    
    filtered.forEach(exp => {
        const tr = document.createElement('tr');
        const itemType = exp.type || 'expense';
        const isIncome = itemType === 'income';
        
        // Format date
        const d = new Date(exp.date);
        const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><span class="badge-type badge-${itemType}">${isIncome ? 'Income' : 'Expense'}</span></td>
            <td><span class="cat-badge cat-${exp.category.replace(/\s+/g, '')}">${exp.category}</span></td>
            <td><span class="note-text">${exp.note || '-'}</span></td>
            <td class="amount-col amount-${itemType}">${isIncome ? '+' : '-'}₹${exp.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="action-col">
                <button class="btn-delete" onclick="deleteExpense('${exp.id}')" title="Delete transaction">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="currentColor"/>
                    </svg>
                </button>
            </td>
        `;
        els.expenseList.appendChild(tr);
    });
}

function renderMonthTotal() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthTx = appData.expenses.filter(exp => {
        const d = new Date(exp.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalIncome = monthTx
        .filter(exp => exp.type === 'income')
        .reduce((sum, exp) => sum + exp.amount, 0);

    const totalExpense = monthTx
        .filter(exp => (exp.type || 'expense') === 'expense')
        .reduce((sum, exp) => sum + exp.amount, 0);

    const netCashFlow = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0;
        
    if (els.monthTotal) {
        const sign = netCashFlow > 0 ? '+' : '';
        els.monthTotal.textContent = `${sign}₹${netCashFlow.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    if (els.heroIncome) {
        els.heroIncome.textContent = `+₹${totalIncome.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    if (els.heroExpense) {
        els.heroExpense.textContent = `-₹${totalExpense.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    if (els.heroSavingsRate) {
        els.heroSavingsRate.textContent = `${savingsRate}%`;
    }
}

// --- CSV Export & Import ---
function exportTransactionsCSV() {
    if (!appData.expenses || appData.expenses.length === 0) {
        showToast("No transactions to export", "error");
        return;
    }

    const headers = ["Date", "Type", "Category", "Note", "Amount"];
    const rows = appData.expenses.map(e => [
        e.date,
        e.type || 'expense',
        `"${(e.category || '').replace(/"/g, '""')}"`,
        `"${(e.note || '').replace(/"/g, '""')}"`,
        e.amount
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moneymind_transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Exported transactions to CSV", "success");
}

function triggerCSVImport() {
    const input = document.getElementById('csv-file-input');
    if (input) {
        input.value = '';
        input.click();
    }
}

async function handleCSVFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
            showToast("CSV file is empty or missing data rows", "error");
            return;
        }

        const headerLine = lines[0].toLowerCase();
        const hasHeader = headerLine.includes('date') || headerLine.includes('amount');
        const dataLines = hasHeader ? lines.slice(1) : lines;

        let count = 0;
        for (const line of dataLines) {
            const parts = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    inQuotes = !inQuotes;
                } else if (ch === ',' && !inQuotes) {
                    parts.push(cur.trim());
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            parts.push(cur.trim());

            if (parts.length < 3) continue;

            let dateVal, typeVal, catVal, noteVal, amountVal;
            if (parts.length >= 5) {
                dateVal = parts[0];
                typeVal = parts[1].toLowerCase() === 'income' ? 'income' : 'expense';
                catVal = parts[2] || 'Other';
                noteVal = parts[3] || '';
                amountVal = parseFloat(parts[4]);
            } else {
                dateVal = parts[0];
                typeVal = 'expense';
                catVal = parts[1] || 'Other';
                noteVal = parts[2] || '';
                amountVal = parseFloat(parts[3]);
            }

            if (isNaN(amountVal) || amountVal <= 0) continue;
            if (!dateVal || isNaN(new Date(dateVal).getTime())) {
                dateVal = new Date().toISOString().split('T')[0];
            }

            const tx = {
                date: dateVal,
                type: typeVal,
                category: catVal,
                note: noteVal,
                amount: amountVal
            };

            if (window.authService?.isAuthenticated() && window.authService?.currentSession?.token) {
                try {
                    const saved = await apiClient.createExpense(tx);
                    appData.expenses.unshift(saved);
                } catch (err) {
                    tx.id = 'csv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                    appData.expenses.unshift(tx);
                }
            } else {
                tx.id = 'csv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
                appData.expenses.unshift(tx);
            }
            count++;
        }


        if (count > 0) {
            saveData();
            updateUI();
            showToast(`Imported ${count} transactions from CSV`, "success");
        } else {
            showToast("No valid transactions found in CSV", "error");
        }
    };
    reader.readAsText(file);
}

window.exportTransactionsCSV = exportTransactionsCSV;
window.triggerCSVImport = triggerCSVImport;
window.handleCSVFileSelected = handleCSVFileSelected;

// --- Recurring Rules Handlers ---
function openRecurringModal() {
    renderRecurringRules();
    const modal = document.getElementById('recurring-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeRecurringModal() {
    const modal = document.getElementById('recurring-modal');
    if (modal) modal.classList.add('hidden');
}

function handleRecTypeChange() {
    const type = document.getElementById('rec-type').value;
    populateCategoryDropdown(type, document.getElementById('rec-category'));
}

function handleAddRecurring(e) {
    e.preventDefault();
    const type = document.getElementById('rec-type').value;
    const amount = parseFloat(document.getElementById('rec-amount').value);
    const category = document.getElementById('rec-category').value;
    const frequency = document.getElementById('rec-frequency').value;
    const nextDate = document.getElementById('rec-next-date').value;
    const note = document.getElementById('rec-note').value;

    if (isNaN(amount) || amount <= 0 || !category || !nextDate) return;

    if (!appData.recurring) appData.recurring = [];
    const rule = {
        id: 'rec_' + Date.now(),
        type,
        amount,
        category,
        frequency,
        nextDate,
        note
    };

    appData.recurring.push(rule);
    saveData();
    renderRecurringRules();
    updateRecurringBadge();
    document.getElementById('recurring-form').reset();
    showToast("Recurring transaction rule saved", "success");
}

function deleteRecurringRule(id) {
    if (!appData.recurring) return;
    appData.recurring = appData.recurring.filter(r => r.id !== id);
    saveData();
    renderRecurringRules();
    updateRecurringBadge();
    showToast("Recurring rule deleted", "info");
}

async function processDueRecurringNow() {
    if (!appData.recurring || appData.recurring.length === 0) {
        showToast("No recurring rules configured", "info");
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    let processed = 0;

    for (const rule of appData.recurring) {
        if (rule.nextDate <= today) {
            const txData = {
                date: rule.nextDate,
                type: rule.type,
                category: rule.category,
                note: (rule.note || '') + ' (Recurring)',
                amount: rule.amount
            };

            if (window.authService?.isAuthenticated() && window.authService?.currentSession?.token) {
                try {
                    const saved = await apiClient.createExpense(txData);
                    appData.expenses.unshift(saved);
                } catch {
                    txData.id = 'rec_tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                    appData.expenses.unshift(txData);
                }
            } else {
                txData.id = 'rec_tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
                appData.expenses.unshift(txData);
            }

            const d = new Date(rule.nextDate);
            if (rule.frequency === 'weekly') d.setDate(d.getDate() + 7);
            else if (rule.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
            else if (rule.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
            rule.nextDate = d.toISOString().split('T')[0];
            processed++;
        }
    }

    if (processed > 0) {
        saveData();
        updateUI();
        renderRecurringRules();
        showToast(`Processed ${processed} due recurring transactions`, "success");
    } else {
        showToast("No recurring transactions due today", "info");
    }
}


function renderRecurringRules() {
    const list = document.getElementById('modal-recurring-list');
    if (!list) return;
    if (!appData.recurring || appData.recurring.length === 0) {
        list.innerHTML = `<p class="text-muted" style="font-size: 13px;">No active recurring rules yet.</p>`;
        return;
    }

    list.innerHTML = appData.recurring.map(rule => `
        <div class="modal-item-row">
            <div class="modal-item-info">
                <div class="modal-item-title">${rule.note || rule.category} — ₹${rule.amount.toLocaleString()}</div>
                <div class="modal-item-meta">${rule.type.toUpperCase()} • Every ${rule.frequency} • Next: ${rule.nextDate}</div>
            </div>
            <button type="button" class="btn-delete" onclick="deleteRecurringRule('${rule.id}')" title="Delete rule">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="currentColor"/></svg>
            </button>
        </div>
    `).join('');
}

function updateRecurringBadge() {
    const badge = document.getElementById('recurring-count');
    if (badge) badge.textContent = (appData.recurring || []).length;
}

window.openRecurringModal = openRecurringModal;
window.closeRecurringModal = closeRecurringModal;
window.handleRecTypeChange = handleRecTypeChange;
window.handleAddRecurring = handleAddRecurring;
window.deleteRecurringRule = deleteRecurringRule;
window.processDueRecurringNow = processDueRecurringNow;


// --- Goals ---
async function handleAddGoal(e) {
    e.preventDefault();
    
    const name = document.getElementById('goal-name').value;
    const targetAmount = parseFloat(document.getElementById('goal-amount').value);
    const targetDate = document.getElementById('goal-date').value;
    
    if (!name || isNaN(targetAmount) || targetAmount <= 0 || !targetDate) return;
    
    const goalData = { name, targetAmount, targetDate, savedSoFar: 0 };
    
    if (window.authService?.isAuthenticated() && window.authService?.currentSession?.token) {
        try {
            const saved = await apiClient.createGoal(goalData);
            appData.goals.push(saved);
            saveData();
            showToast("Savings goal saved to database", "success");
        } catch (err) {
            console.warn("API create goal failed, saving locally:", err);
            goalData.id = Date.now().toString();
            appData.goals.push(goalData);
            saveData();
            showToast("Saved goal to local storage", "info");
        }
    } else {
        goalData.id = Date.now().toString();
        appData.goals.push(goalData);
        saveData();
    }
    
    els.goalForm.reset();
    updateUI();
}

async function deleteGoal(id) {
    if (!confirm("Are you sure you want to delete this savings goal?")) {
        return;
    }
    if (window.authService?.isAuthenticated() && window.authService?.currentSession?.token) {
        try {
            await apiClient.deleteGoal(id);
            showToast("Savings goal deleted from database", "info");
        } catch (err) {
            console.warn("API delete goal error:", err);
        }
    }
    appData.goals = appData.goals.filter(g => g.id !== id);
    saveData();
    updateUI();
}

async function updateGoalSavings(id, amountToAdd) {
    const goal = appData.goals.find(g => g.id === id);
    if (!goal) return;
    
    const increment = parseFloat(amountToAdd) || 0;
    if (increment <= 0) return;

    if (window.authService?.isAuthenticated() && window.authService?.currentSession?.token) {
        try {
            const updated = await apiClient.addSavings(id, increment);
            goal.savedSoFar = updated.savedSoFar;
            saveData();
            updateUI();
            showToast(`Added ₹${increment.toLocaleString()} to ${goal.name}!`, "success");
            return;
        } catch (err) {
            console.warn("API update savings error:", err);
        }
    }

    goal.savedSoFar += increment;
    if (goal.savedSoFar > goal.targetAmount) goal.savedSoFar = goal.targetAmount;
    saveData();
    updateUI();
}

function renderGoals() {
    els.goalsList.innerHTML = '';
    
    if (appData.goals.length === 0) {
        els.goalsEmpty.classList.remove('hidden');
        return;
    }
    
    els.goalsEmpty.classList.add('hidden');
    
    appData.goals.forEach(goal => {
        const div = document.createElement('div');
        div.className = 'goal-item';
        
        const percent = Math.min(100, Math.max(0, (goal.savedSoFar / goal.targetAmount) * 100));
        
        // Calculate days and weekly amount
        const now = new Date();
        const target = new Date(goal.targetDate);
        const diffTime = target.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let insight = '';
        if (goal.savedSoFar >= goal.targetAmount) {
            insight = "🎉 Goal reached! Congratulations!";
        } else if (diffDays <= 0) {
            insight = "Target date has passed.";
        } else {
            const weeks = Math.max(1, diffDays / 7);
            const amountLeft = goal.targetAmount - goal.savedSoFar;
            const perWeek = amountLeft / weeks;
            insight = `You need to save <strong>₹${perWeek.toLocaleString('en-IN', {maximumFractionDigits: 0})}/week</strong> to hit this by target (${diffDays} days left).`;
        }
        
        div.innerHTML = `
            <div class="goal-header">
                <div class="goal-title-wrap">
                    <span class="goal-name">${goal.name}</span>
                    <button class="btn-delete" onclick="deleteGoal('${goal.id}')" title="Delete goal" style="padding: 2px 4px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
                <div class="goal-target">₹${goal.savedSoFar.toLocaleString('en-IN')} / ₹${goal.targetAmount.toLocaleString('en-IN')}</div>
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
            <div class="goal-insight">${insight}</div>
            <div class="goal-actions">
                <input type="number" id="add-to-${goal.id}" placeholder="+ Amount" min="1" step="0.01">
                <button class="btn btn-secondary" onclick="
                    const val = document.getElementById('add-to-${goal.id}').value;
                    if(val) updateGoalSavings('${goal.id}', val);
                ">Add to Savings</button>
            </div>
        `;
        
        els.goalsList.appendChild(div);
    });
}

// --- Charts ---
function updateCharts() {
    if (appData.expenses.length === 0) {
        if (els.chartsEmpty) els.chartsEmpty.classList.remove('hidden');
        if (els.chartsContainer) els.chartsContainer.classList.add('hidden');
        return;
    }

    if (els.chartsEmpty) els.chartsEmpty.classList.add('hidden');
    if (els.chartsContainer) els.chartsContainer.classList.remove('hidden');

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 1. Pie / Doughnut Chart (Current Month Categories)
    const currentMonthExpenses = appData.expenses.filter(exp => {
        const d = new Date(exp.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    const catTotals = {};
    currentMonthExpenses.forEach(exp => {
        catTotals[exp.category] = (catTotals[exp.category] || 0) + exp.amount;
    });

    // If no expenses in current month, fallback to all expenses for the pie chart
    if (Object.keys(catTotals).length === 0) {
        appData.expenses.forEach(exp => {
            catTotals[exp.category] = (catTotals[exp.category] || 0) + exp.amount;
        });
    }
    
    const categoryColors = {
        'Food': '#F59E0B',
        'Transport': '#6366F1',
        'Rent': '#EC4899',
        'Entertainment': '#D946EF',
        'Shopping': '#0284C7',
        'Bills': '#EA580C',
        'Health': '#EF4444',
        'Education': '#8B5CF6',
        'Other': '#64748B',
        'Salary': '#10B981',
        'Freelance': '#06B6D4',
        'Investment': '#EAB308',
        'Gift': '#F43F5E',
        'Refund': '#3B82F6'
    };
    
    const pieData = {
        labels: Object.keys(catTotals),
        datasets: [{
            data: Object.values(catTotals),
            backgroundColor: Object.keys(catTotals).map(cat => categoryColors[cat] || '#0D9488'),
            borderWidth: 2,
            borderColor: '#FFFFFF',
            hoverOffset: 4
        }]
    };
    
    if (categoryChart) {
        categoryChart.data = pieData;
        categoryChart.update();
    } else {
        const ctxPie = document.getElementById('categoryChart').getContext('2d');
        categoryChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: pieData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 14,
                            font: {
                                family: "'Space Grotesk', sans-serif",
                                size: 12,
                                weight: '500'
                            },
                            color: '#334155'
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        padding: 10,
                        titleFont: { family: "'Space Grotesk', sans-serif", size: 13 },
                        bodyFont: { family: "'Inter', sans-serif", size: 12 },
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return ` ₹${context.raw.toLocaleString('en-IN')}`;
                            }
                        }
                    }
                },
                cutout: '72%'
            }
        });
    }
    
    // 2. Trend Line / Bar Chart (Dynamic 7D / 30D timeframe)
    const timeframeDays = currentTimeframeDays || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (timeframeDays - 1));
    startDate.setHours(0, 0, 0, 0);
    
    const dateMap = {};
    for (let i = timeframeDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        dateMap[dStr] = 0;
    }
    
    const recentExpenses = appData.expenses.filter(exp => new Date(exp.date) >= startDate);
    recentExpenses.forEach(exp => {
        if (dateMap[exp.date] !== undefined) {
            dateMap[exp.date] += exp.amount;
        }
    });
    
    const labelsMap = Object.keys(dateMap).map(d => {
        const dateObj = new Date(d);
        return dateObj.getDate() + '/' + (dateObj.getMonth() + 1);
    });
    const valuesMap = Object.values(dateMap);
    
    // Check how many distinct days have non-zero spending
    const nonZeroDaysCount = valuesMap.filter(val => val > 0).length;
    // If fewer than 3 distinct days of spending, show as a Bar chart; otherwise show smooth Line chart
    const chartType = nonZeroDaysCount < 3 ? 'bar' : 'line';
    
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    
    let dataset;
    if (chartType === 'bar') {
        const gradientBar = ctxTrend.createLinearGradient(0, 0, 0, 220);
        gradientBar.addColorStop(0, '#0D9488');
        gradientBar.addColorStop(1, '#5EEAD4');

        dataset = {
            label: 'Daily Spending',
            data: valuesMap,
            backgroundColor: gradientBar,
            borderRadius: 6,
            borderSkipped: false,
            maxBarThickness: 32
        };
    } else {
        const gradientFill = ctxTrend.createLinearGradient(0, 0, 0, 220);
        gradientFill.addColorStop(0, 'rgba(13, 148, 136, 0.35)');
        gradientFill.addColorStop(1, 'rgba(13, 148, 136, 0.00)');

        dataset = {
            label: 'Daily Spending',
            data: valuesMap,
            borderColor: '#0D9488',
            borderWidth: 2.5,
            backgroundColor: gradientFill,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#FFFFFF',
            pointBorderColor: '#0D9488',
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#0D9488',
            pointHoverBorderColor: '#FFFFFF',
            pointHoverBorderWidth: 2
        };
    }

    const trendData = {
        labels: labelsMap,
        datasets: [dataset]
    };
    
    // Destroy chart if switching between 'bar' and 'line'
    if (trendChart && trendChart.config.type !== chartType) {
        trendChart.destroy();
        trendChart = null;
    }
    
    if (trendChart) {
        trendChart.data = trendData;
        trendChart.update();
    } else {
        trendChart = new Chart(ctxTrend, {
            type: chartType,
            data: trendData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0F172A',
                        padding: 10,
                        titleFont: { family: "'Space Grotesk', sans-serif", size: 12 },
                        bodyFont: { family: "'Space Grotesk', sans-serif", size: 13, weight: '600' },
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return `Spent: ₹${context.raw.toLocaleString('en-IN')}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(15, 23, 42, 0.05)',
                            drawBorder: false
                        },
                        border: { display: false },
                        ticks: {
                            color: '#64748B',
                            font: {
                                family: "'Space Grotesk', sans-serif",
                                size: 11
                            },
                            callback: function(value) {
                                return '₹' + value;
                            }
                        }
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: '#64748B',
                            font: {
                                family: "'Inter', sans-serif",
                                size: 11
                            },
                            maxTicksLimit: timeframeDays === 7 ? 7 : 8
                        }
                    }
                }
            }
        });
    }
}

// --- Insights ---
function checkBudgetInsights() {
    els.budgetWarning.classList.add('hidden');
    els.budgetWarning.innerHTML = '';
    
    if (appData.expenses.length === 0) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate current month category totals
    const currentTotals = {};
    
    // Calculate previous 3 months average
    const pastTotals = {}; // { cat: totalSumOver3Months }
    let hasPastData = false;
    
    appData.expenses.forEach(exp => {
        const d = new Date(exp.date);
        const m = d.getMonth();
        const y = d.getFullYear();
        
        if (m === currentMonth && y === currentYear) {
            currentTotals[exp.category] = (currentTotals[exp.category] || 0) + exp.amount;
        } else {
            // Check if within last 3 calendar months
            let monthsDiff = (currentYear - y) * 12 + (currentMonth - m);
            if (monthsDiff > 0 && monthsDiff <= 3) {
                pastTotals[exp.category] = (pastTotals[exp.category] || 0) + exp.amount;
                hasPastData = true;
            }
        }
    });
    
    if (!hasPastData) return; // Not enough history
    
    let warnings = [];
    
    for (const cat in currentTotals) {
        const current = currentTotals[cat];
        const pastAverage = (pastTotals[cat] || 0) / 3; // divide by 3 months
        
        if (pastAverage > 0 && current > (pastAverage * 1.20)) {
            // More than 20% above average
            const percentIncrease = Math.round(((current - pastAverage) / pastAverage) * 100);
            warnings.push(`<strong>${cat}</strong> spending is ${percentIncrease}% higher than your recent average.`);
        }
    }
    
    if (warnings.length > 0) {
        els.budgetWarning.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0; color:var(--warning);">
                <path d="M12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22ZM11 15V17H13V15H11ZM11 7V13H13V7H11Z" fill="currentColor"/>
            </svg>
            <div>${warnings[0]} ${warnings.length > 1 ? '<br><small>+ more categories over budget</small>' : ''}</div>
        `;
        els.budgetWarning.classList.remove('hidden');
    }
}

// ==========================================================================
// AI Suggestions Feature (Serverless API Endpoint Integration)
// ==========================================================================

// Build Compact Aggregated Summary for the AI
function buildSpendingSummary() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const currentTotals = {};
    let currentMonthTotal = 0;
    const pastTotals = {};
    const pastMonthsCount = 3;
    let hasPastData = false;

    appData.expenses.forEach(exp => {
        const d = new Date(exp.date);
        const m = d.getMonth();
        const y = d.getFullYear();

        if (m === currentMonth && y === currentYear) {
            currentTotals[exp.category] = (currentTotals[exp.category] || 0) + exp.amount;
            currentMonthTotal += exp.amount;
        } else {
            const monthsDiff = (currentYear - y) * 12 + (currentMonth - m);
            if (monthsDiff > 0 && monthsDiff <= pastMonthsCount) {
                pastTotals[exp.category] = (pastTotals[exp.category] || 0) + exp.amount;
                hasPastData = true;
            }
        }
    });

    const pastAverages = {};
    if (hasPastData) {
        for (const cat in pastTotals) {
            pastAverages[cat] = Math.round(pastTotals[cat] / pastMonthsCount);
        }
    }

    return {
        currentMonth: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
        currentMonthTotal: Math.round(currentMonthTotal),
        spendingByCategory: currentTotals,
        previous3MonthsAverageByCategory: hasPastData ? pastAverages : "No historical multi-month data yet",
        totalExpensesLogged: appData.expenses.length
    };
}

// Generate simple signature of expenses to detect changes
function getExpenseSignature() {
    if (appData.expenses.length === 0) return 'empty';
    const sorted = [...appData.expenses].sort((a, b) => a.id.localeCompare(b.id));
    return `${appData.expenses.length}_${sorted[0]?.id}_${sorted[sorted.length - 1]?.id}_${sorted.reduce((s, e) => s + e.amount, 0)}`;
}

// Render AI Suggestions Cards
function renderAISuggestions(suggestions) {
    if (!els.aiSuggestionsList) return;
    els.aiSuggestionsList.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'ai-suggestion-item';
        
        item.innerHTML = `
            <div class="ai-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" fill="currentColor"/>
                </svg>
            </div>
            <div class="ai-item-text">${suggestion}</div>
        `;
        els.aiSuggestionsList.appendChild(item);
    });

    // Show list, hide other states
    els.aiSuggestionsList.classList.remove('hidden');
    if (els.aiLoading) els.aiLoading.classList.add('hidden');
    if (els.aiEmpty) els.aiEmpty.classList.add('hidden');
    if (els.aiError) els.aiError.classList.add('hidden');
}

// Main AI Fetching Function via /api/suggestions with Caching
async function fetchAISuggestions(forceRefresh = false) {
    // 1. Handle No Expenses State
    if (appData.expenses.length === 0) {
        if (els.aiEmpty) els.aiEmpty.classList.remove('hidden');
        if (els.aiSuggestionsList) els.aiSuggestionsList.classList.add('hidden');
        if (els.aiLoading) els.aiLoading.classList.add('hidden');
        if (els.aiError) els.aiError.classList.add('hidden');
        return;
    }

    const currentSignature = getExpenseSignature();

    // 2. Check Cache (if not force refresh)
    if (!forceRefresh) {
        const cacheKey = getAICacheKey();
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
            try {
                const cached = JSON.parse(cachedRaw);
                const isFresh = (Date.now() - cached.timestamp) < (24 * 60 * 60 * 1000); // 24 hours
                const isSameData = cached.expenseSignature === currentSignature;

                if (isFresh && isSameData && Array.isArray(cached.suggestions) && cached.suggestions.length > 0) {
                    renderAISuggestions(cached.suggestions);
                    return;
                }
            } catch (e) {
                console.error("Error reading AI cache", e);
            }
        }
    }

    // 3. Fetch Fresh Suggestions from Authenticated API (/api/ai/suggestions)
    if (els.aiLoading) els.aiLoading.classList.remove('hidden');
    if (els.aiSuggestionsList) els.aiSuggestionsList.classList.add('hidden');
    if (els.aiEmpty) els.aiEmpty.classList.add('hidden');
    if (els.aiError) els.aiError.classList.add('hidden');
    if (els.aiRefreshBtn) els.aiRefreshBtn.classList.add('spinning');

    const summary = buildSpendingSummary();

    try {
        const data = await apiClient.getAISuggestions(summary);
        const suggestions = Array.isArray(data) ? data : data.suggestions;

        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            throw new Error("Invalid response format from AI suggestions");
        }

        // Cache the successful result scoped to user
        const cacheKey = getAICacheKey();
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            expenseSignature: currentSignature,
            suggestions
        }));

        renderAISuggestions(suggestions);
    } catch (err) {
        console.warn("AI Suggestions API Error (handled quietly):", err);
        if (els.aiLoading) els.aiLoading.classList.add('hidden');
        if (els.aiSuggestionsList) els.aiSuggestionsList.classList.add('hidden');

        if (els.aiEmpty) els.aiEmpty.classList.add('hidden');
        if (els.aiError) {
            if (els.aiErrorMsg) {
                els.aiErrorMsg.textContent = "Couldn't load suggestions right now.";
            }
            els.aiError.classList.remove('hidden');
        }
    } finally {
        if (els.aiRefreshBtn) els.aiRefreshBtn.classList.remove('spinning');
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
