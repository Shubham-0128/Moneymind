// State Management
const STORAGE_KEY = 'moneymind_data';
let appData = {
    expenses: [],
    goals: []
};

// Chart instances
let categoryChart = null;
let trendChart = null;

// DOM Elements
const els = {
    expenseForm: document.getElementById('expense-form'),
    expenseDateInput: document.getElementById('exp-date'),
    expenseList: document.getElementById('expense-list'),
    expensesEmpty: document.getElementById('expenses-empty'),
    monthTotal: document.getElementById('month-total'),
    budgetWarning: document.getElementById('budget-warning'),
    
    goalForm: document.getElementById('goal-form'),
    goalsList: document.getElementById('goals-list'),
    goalsEmpty: document.getElementById('goals-empty'),
};

// Initialize App
function init() {
    loadData();
    setDefaultDate();
    setupEventListeners();
    updateUI();
}

// Data Operations
function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            appData = JSON.parse(stored);
        } catch (e) {
            console.error("Error parsing localStorage data", e);
        }
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// Event Listeners
function setupEventListeners() {
    els.expenseForm.addEventListener('submit', handleAddExpense);
    els.goalForm.addEventListener('submit', handleAddGoal);
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    els.expenseDateInput.value = today;
}

// UI Updates
function updateUI() {
    renderExpenses();
    renderMonthTotal();
    renderGoals();
    updateCharts();
    checkBudgetInsights();
}

// --- Expenses ---
function handleAddExpense(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const category = document.getElementById('exp-category').value;
    const date = document.getElementById('exp-date').value;
    const note = document.getElementById('exp-note').value;
    
    if (isNaN(amount) || amount <= 0 || !category || !date) return;
    
    const expense = {
        id: Date.now().toString(),
        amount,
        category,
        date,
        note
    };
    
    appData.expenses.push(expense);
    saveData();
    
    // Reset form except date
    els.expenseForm.reset();
    setDefaultDate();
    
    updateUI();
}

function deleteExpense(id) {
    appData.expenses = appData.expenses.filter(e => e.id !== id);
    saveData();
    updateUI();
}

function renderExpenses() {
    els.expenseList.innerHTML = '';
    
    if (appData.expenses.length === 0) {
        els.expensesEmpty.classList.remove('hidden');
        els.expenseList.parentElement.parentElement.classList.add('hidden'); // hide table
        return;
    }
    
    els.expensesEmpty.classList.add('hidden');
    els.expenseList.parentElement.parentElement.classList.remove('hidden');
    
    // Sort newest first
    const sorted = [...appData.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(exp => {
        const tr = document.createElement('tr');
        
        // Format date
        const d = new Date(exp.date);
        const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
        
        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><span class="cat-badge">${exp.category}</span></td>
            <td><span class="note-text">${exp.note || '-'}</span></td>
            <td class="amount-col">₹${exp.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            <td class="action-col">
                <button class="btn-delete" onclick="deleteExpense('${exp.id}')" title="Delete">
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
    
    const total = appData.expenses
        .filter(exp => {
            const d = new Date(exp.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);
        
    els.monthTotal.textContent = `₹${total.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// --- Goals ---
function handleAddGoal(e) {
    e.preventDefault();
    
    const name = document.getElementById('goal-name').value;
    const targetAmount = parseFloat(document.getElementById('goal-amount').value);
    const targetDate = document.getElementById('goal-date').value;
    
    if (!name || isNaN(targetAmount) || targetAmount <= 0 || !targetDate) return;
    
    const goal = {
        id: Date.now().toString(),
        name,
        targetAmount,
        targetDate,
        savedSoFar: 0
    };
    
    appData.goals.push(goal);
    saveData();
    els.goalForm.reset();
    updateUI();
}

function updateGoalSavings(id, amountToAdd) {
    const goal = appData.goals.find(g => g.id === id);
    if (goal) {
        goal.savedSoFar += parseFloat(amountToAdd) || 0;
        if (goal.savedSoFar > goal.targetAmount) goal.savedSoFar = goal.targetAmount;
        saveData();
        updateUI();
    }
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
            insight = `You need to save ₹${perWeek.toLocaleString('en-IN', {maximumFractionDigits: 0})}/week to hit this by target. (${diffDays} days left)`;
        }
        
        div.innerHTML = `
            <div class="goal-header">
                <div class="goal-name">${goal.name}</div>
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
                ">Add</button>
            </div>
        `;
        
        els.goalsList.appendChild(div);
    });
}

// --- Charts ---
function updateCharts() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // 1. Pie Chart (Current Month Categories)
    const currentMonthExpenses = appData.expenses.filter(exp => {
        const d = new Date(exp.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    
    const catTotals = {};
    currentMonthExpenses.forEach(exp => {
        catTotals[exp.category] = (catTotals[exp.category] || 0) + exp.amount;
    });
    
    const pieData = {
        labels: Object.keys(catTotals),
        datasets: [{
            data: Object.values(catTotals),
            backgroundColor: [
                '#0F766E', '#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#64748B'
            ],
            borderWidth: 0
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
                    legend: { position: 'right', labels: { boxWidth: 12, font: { family: "'Inter', sans-serif" } } }
                },
                cutout: '70%'
            }
        });
    }
    
    // 2. Bar Chart (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Generate last 30 days labels
    const dateMap = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        dateMap[dStr] = 0;
    }
    
    const recentExpenses = appData.expenses.filter(exp => new Date(exp.date) >= thirtyDaysAgo);
    recentExpenses.forEach(exp => {
        if (dateMap[exp.date] !== undefined) {
            dateMap[exp.date] += exp.amount;
        }
    });
    
    const labelsMap = Object.keys(dateMap).map(d => {
        const dateObj = new Date(d);
        return dateObj.getDate() + '/' + (dateObj.getMonth() + 1); // Simple DD/MM
    });
    const valuesMap = Object.values(dateMap);
    
    const barData = {
        labels: labelsMap,
        datasets: [{
            label: 'Spending',
            data: valuesMap,
            backgroundColor: '#0EA5E9',
            borderRadius: 4
        }]
    };
    
    if (trendChart) {
        trendChart.data = barData;
        trendChart.update();
    } else {
        const ctxBar = document.getElementById('trendChart').getContext('2d');
        trendChart = new Chart(ctxBar, {
            type: 'bar',
            data: barData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#F1F5F9' }, border: { display: false } },
                    x: { grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 7 } }
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

// Start
document.addEventListener('DOMContentLoaded', init);
