def test_unauthorized_expense_access(client):
    res = client.get("/api/expenses")
    assert res.status_code == 401
    assert "token required" in res.json()["detail"].lower()

def test_create_expense_valid(client, auth_headers):
    payload = {
        "amount": 2500.50,
        "category": "Food",
        "date": "2026-03-15",
        "note": "Dinner with team"
    }
    response = client.post("/api/expenses", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 2500.50
    assert data["category"] == "Food"
    assert data["date"] == "2026-03-15"
    assert data["note"] == "Dinner with team"
    assert "id" in data

def test_create_expense_invalid_amount(client, auth_headers):
    payload = {
        "amount": -50.0,
        "category": "Food",
        "date": "2026-03-15"
    }
    response = client.post("/api/expenses", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert response.json()["error"] is True

def test_create_expense_invalid_date(client, auth_headers):
    payload = {
        "amount": 100.0,
        "category": "Food",
        "date": "not-a-valid-date"
    }
    response = client.post("/api/expenses", json=payload, headers=auth_headers)
    assert response.status_code == 422

def test_list_and_filter_expenses(client, auth_headers):
    client.post("/api/expenses", json={"amount": 100, "category": "Food", "date": "2026-03-10"}, headers=auth_headers)
    client.post("/api/expenses", json={"amount": 500, "category": "Rent", "date": "2026-03-01"}, headers=auth_headers)
    client.post("/api/expenses", json={"amount": 200, "category": "Food", "date": "2026-03-12"}, headers=auth_headers)

    # All expenses
    res = client.get("/api/expenses", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) == 3

    # Filter category
    res_filtered = client.get("/api/expenses?category=Food", headers=auth_headers)
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()) == 2
    assert all(e["category"] == "Food" for e in res_filtered.json())

    # Filter date range
    res_date = client.get("/api/expenses?start_date=2026-03-11&end_date=2026-03-15", headers=auth_headers)
    assert res_date.status_code == 200
    assert len(res_date.json()) == 1
    assert res_date.json()[0]["amount"] == 200

def test_get_expense_by_id(client, auth_headers):
    created = client.post("/api/expenses", json={"amount": 150, "category": "Bills", "date": "2026-03-10"}, headers=auth_headers).json()
    exp_id = created["id"]

    res = client.get(f"/api/expenses/{exp_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == exp_id

    # Non-existent
    res_404 = client.get("/api/expenses/non_existent_id", headers=auth_headers)
    assert res_404.status_code == 404
    assert res_404.json()["error"] is True

def test_update_expense(client, auth_headers):
    created = client.post("/api/expenses", json={"amount": 300, "category": "Shopping", "date": "2026-03-10"}, headers=auth_headers).json()
    exp_id = created["id"]

    update_res = client.put(f"/api/expenses/{exp_id}", json={"amount": 450, "note": "Updated note"}, headers=auth_headers)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["amount"] == 450
    assert updated["note"] == "Updated note"
    assert updated["category"] == "Shopping"

def test_delete_expense(client, auth_headers):
    created = client.post("/api/expenses", json={"amount": 300, "category": "Shopping", "date": "2026-03-10"}, headers=auth_headers).json()
    exp_id = created["id"]

    del_res = client.delete(f"/api/expenses/{exp_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # Verify deleted
    get_res = client.get(f"/api/expenses/{exp_id}", headers=auth_headers)
    assert get_res.status_code == 404

def test_expense_summary(client, auth_headers):
    client.post("/api/expenses", json={"amount": 1000, "category": "Rent", "date": "2026-03-01"}, headers=auth_headers)
    client.post("/api/expenses", json={"amount": 250, "category": "Food", "date": "2026-03-05"}, headers=auth_headers)
    client.post("/api/expenses", json={"amount": 150, "category": "Food", "date": "2026-03-08"}, headers=auth_headers)

    res = client.get("/api/expenses/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total_amount"] == 1400.0
    assert data["total_count"] == 3
    assert len(data["by_category"]) == 2
    assert data["by_category"][0]["category"] == "Rent"
    assert data["by_category"][0]["total"] == 1000.0
    assert data["by_category"][1]["category"] == "Food"
    assert data["by_category"][1]["total"] == 400.0
    assert data["by_category"][1]["count"] == 2

def test_create_income_and_net_flow(client, auth_headers):
    # Add salary income
    res_inc = client.post("/api/expenses", json={
        "amount": 50000.0,
        "category": "Salary",
        "date": "2026-03-01",
        "type": "income",
        "note": "Monthly tech salary"
    }, headers=auth_headers)
    assert res_inc.status_code == 201
    inc_data = res_inc.json()
    assert inc_data["type"] == "income"
    assert inc_data["amount"] == 50000.0
    assert inc_data["category"] == "Salary"

    # Add expense
    res_exp = client.post("/api/expenses", json={
        "amount": 10000.0,
        "category": "Rent",
        "date": "2026-03-02",
        "type": "expense"
    }, headers=auth_headers)
    assert res_exp.status_code == 201

    # Filter by type=income
    res_only_inc = client.get("/api/expenses?type=income", headers=auth_headers)
    assert res_only_inc.status_code == 200
    assert len(res_only_inc.json()) == 1
    assert res_only_inc.json()[0]["type"] == "income"

    # Check cash flow summary
    res_sum = client.get("/api/expenses/summary", headers=auth_headers)
    assert res_sum.status_code == 200
    sum_data = res_sum.json()
    assert sum_data["total_income"] == 50000.0
    assert sum_data["total_expenses"] == 10000.0
    assert sum_data["net_balance"] == 40000.0
    assert sum_data["savings_rate"] == 80.0

def test_expense_decimal_precision(client, auth_headers):
    # Valid 2 decimal places
    res = client.post("/api/expenses", json={
        "amount": 19.99,
        "category": "Food",
        "date": "2026-03-15"
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["amount"] == 19.99

    # Rejects more than 2 decimal places
    res_invalid = client.post("/api/expenses", json={
        "amount": 19.999,
        "category": "Food",
        "date": "2026-03-15"
    }, headers=auth_headers)
    assert res_invalid.status_code == 422

def test_expense_summary_month_year_filter(client, auth_headers):
    # Add expense in March 2026
    client.post("/api/expenses", json={"amount": 3000, "category": "Food", "date": "2026-03-10"}, headers=auth_headers)
    # Add expense in February 2026
    client.post("/api/expenses", json={"amount": 1500, "category": "Food", "date": "2026-02-15"}, headers=auth_headers)

    # Summary filtered to March 2026 only
    res_march = client.get("/api/expenses/summary?month=3&year=2026", headers=auth_headers)
    assert res_march.status_code == 200
    march_data = res_march.json()
    assert march_data["total_amount"] == 3000.0
    assert march_data["total_count"] == 1

    # Summary filtered to February 2026 only
    res_feb = client.get("/api/expenses/summary?month=2&year=2026", headers=auth_headers)
    assert res_feb.status_code == 200
    feb_data = res_feb.json()
    assert feb_data["total_amount"] == 1500.0
    assert feb_data["total_count"] == 1

def test_expense_tenant_isolation(client, auth_headers):
    # User 1 creates an expense
    created = client.post("/api/expenses", json={
        "amount": 1200, "category": "Bills", "date": "2026-03-01"
    }, headers=auth_headers).json()
    exp_id = created["id"]

    # Register and login User 2
    client.post("/api/auth/register", json={
        "name": "Second User", "email": "user2@moneymind.app", "password": "Password123!"
    })
    user2_login = client.post("/api/auth/login", json={
        "email": "user2@moneymind.app", "password": "Password123!"
    }).json()
    user2_headers = {"Authorization": f"Bearer {user2_login['token']}"}

    # User 2 cannot see User 1's expense in list
    res_list = client.get("/api/expenses", headers=user2_headers)
    assert res_list.status_code == 200
    assert len(res_list.json()) == 0

    # User 2 cannot get User 1's expense directly (IDOR prevention)
    res_get = client.get(f"/api/expenses/{exp_id}", headers=user2_headers)
    assert res_get.status_code == 404

    # User 2 cannot update User 1's expense
    res_put = client.put(f"/api/expenses/{exp_id}", json={"amount": 9999}, headers=user2_headers)
    assert res_put.status_code == 404

    # User 2 cannot delete User 1's expense
    res_del = client.delete(f"/api/expenses/{exp_id}", headers=user2_headers)
    assert res_del.status_code == 404

