// ==========================================================================
// MoneyMind Application Logic
// ==========================================================================

// Storage Keys
const STORAGE_KEY = 'moneymind_data';
const AI_CACHE_KEY = 'moneymind_ai_cache';

// App State
let appData = {
    expenses: [],
    goals: []
};

// Chart instances & config
let categoryChart = null;
let trendChart = null;
let currentTimeframeDays = 7; // Default to 7 days view

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

    chartsContainer: document.getElementById('charts-container'),
    chartsEmpty: document.getElementById('charts-empty'),

    // AI Suggestions Elements
    aiLoading: document.getElementById('ai-loading'),
    aiSuggestionsList: document.getElementById('ai-suggestions-list'),
    aiEmpty: document.getElementById('ai-empty'),
    aiError: document.getElementById('ai-error'),
    aiErrorMsg: document.getElementById('ai-error-msg'),
    aiRefreshBtn: document.getElementById('ai-refresh-btn')
};

// Initialize App
function init() {
    loadData();
    setDefaultDate();
    setupEventListeners();
    updateUI();
    fetchAISuggestions(false);
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
    fetchAISuggestions(false);
}

function deleteExpense(id) {
    if (!confirm("Are you sure you want to delete this expense?")) {
        return;
    }
    appData.expenses = appData.expenses.filter(e => e.id !== id);
    saveData();
    updateUI();
    fetchAISuggestions(false);
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
            <td><span class="cat-badge cat-${exp.category.replace(/\s+/g, '')}">${exp.category}</span></td>
            <td><span class="note-text">${exp.note || '-'}</span></td>
            <td class="amount-col">₹${exp.amount.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
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

function deleteGoal(id) {
    if (!confirm("Are you sure you want to delete this savings goal?")) {
        return;
    }
    appData.goals = appData.goals.filter(g => g.id !== id);
    saveData();
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
        'Other': '#64748B'
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
        const cachedRaw = localStorage.getItem(AI_CACHE_KEY);
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

    // 3. Fetch Fresh Suggestions from Serverless Function (/api/suggestions)
    if (els.aiLoading) els.aiLoading.classList.remove('hidden');
    if (els.aiSuggestionsList) els.aiSuggestionsList.classList.add('hidden');
    if (els.aiEmpty) els.aiEmpty.classList.add('hidden');
    if (els.aiError) els.aiError.classList.add('hidden');
    if (els.aiRefreshBtn) els.aiRefreshBtn.classList.add('spinning');

    const summary = buildSpendingSummary();

    try {
        const response = await fetch("/api/suggestions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(summary)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData?.error || `HTTP error ${response.status}`);
        }

        const data = await response.json();
        const suggestions = Array.isArray(data) ? data : data.suggestions;

        if (!Array.isArray(suggestions) || suggestions.length === 0) {
            throw new Error("Invalid response format from /api/suggestions");
        }

        // Cache the successful result
        localStorage.setItem(AI_CACHE_KEY, JSON.stringify({
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
