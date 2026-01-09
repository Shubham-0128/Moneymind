
// Load data from localStorage
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let incomes = JSON.parse(localStorage.getItem('incomes')) || [];

// Elements
const showExpenseFormBtn = document.getElementById('show-expense-form');
const showIncomeFormBtn = document.getElementById('show-income-form');
const expenseFormSection = document.getElementById('expense-form-section');
const incomeFormSection = document.getElementById('income-form-section');
const expenseForm = document.getElementById('expense-form');
const incomeForm = document.getElementById('income-form');
const expensesList = document.getElementById('expenses-list');
const incomesList = document.getElementById('incomes-list');
const totalIncomeEl = document.getElementById('total-income');
const totalExpensesEl = document.getElementById('total-expenses');
const balanceEl = document.getElementById('balance');
const ctx = document.getElementById('expense-chart').getContext('2d');

// Chart
let expenseChart = new Chart(ctx, {
    type: 'pie',
    data: {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: [
                '#FF6384',
                '#36A2EB',
                '#FFCE56',
                '#4BC0C0',
                '#9966FF',
                '#FF9F40'
            ]
        }]
    },
    options: {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Expenses by Category'
            }
        }
    }
});

// Functions
function updateSummary() {
    const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const balance = totalIncome - totalExpenses;
    totalIncomeEl.textContent = totalIncome.toFixed(2);
    totalExpensesEl.textContent = totalExpenses.toFixed(2);
    balanceEl.textContent = balance.toFixed(2);
}

function updateChart() {
    const categories = {};
    expenses.forEach(exp => {
        categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
    });
    expenseChart.data.labels = Object.keys(categories);
    expenseChart.data.datasets[0].data = Object.values(categories);
    expenseChart.update();
}

function renderLists() {
    expensesList.innerHTML = '';
    expenses.forEach((exp, index) => {
        const li = document.createElement('li');
        li.textContent = `${exp.category}: $${exp.amount} - ${exp.description}`;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            expenses.splice(index, 1);
            saveData();
            renderLists();
            updateSummary();
            updateChart();
        };
        li.appendChild(deleteBtn);
        expensesList.appendChild(li);
    });

    incomesList.innerHTML = '';
    incomes.forEach((inc, index) => {
        const li = document.createElement('li');
        li.textContent = `${inc.source}: $${inc.amount}`;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => {
            incomes.splice(index, 1);
            saveData();
            renderLists();
            updateSummary();
        };
        li.appendChild(deleteBtn);
        incomesList.appendChild(li);
    });
}

function saveData() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
    localStorage.setItem('incomes', JSON.stringify(incomes));
}

// Event listeners
showExpenseFormBtn.addEventListener('click', () => {
    expenseFormSection.style.display = expenseFormSection.style.display === 'block' ? 'none' : 'block';
    incomeFormSection.style.display = 'none'; // Hide the other form
});

showIncomeFormBtn.addEventListener('click', () => {
    incomeFormSection.style.display = incomeFormSection.style.display === 'block' ? 'none' : 'block';
    expenseFormSection.style.display = 'none'; // Hide the other form
});

expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value;
    const description = document.getElementById('expense-description').value;
    expenses.push({ amount, category, description });
    saveData();
    renderLists();
    updateSummary();
    updateChart();
    expenseForm.reset();
    expenseFormSection.style.display = 'none'; // Hide form after submit
});

incomeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('income-amount').value);
    const source = document.getElementById('income-source').value;
    incomes.push({ amount, source });
    saveData();
    renderLists();
    updateSummary();
    incomeForm.reset();
    incomeFormSection.style.display = 'none'; // Hide form after submit
});

// Initial render
renderLists();
updateSummary();
updateChart();