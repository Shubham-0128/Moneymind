def test_create_expense_valid(client):
    payload = {
        "amount": 2500.50,
        "category": "Food",
        "date": "2026-03-15",
        "note": "Dinner with team"
    }
    response = client.post("/api/expenses", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["amount"] == 2500.50
    assert data["category"] == "Food"
    assert data["date"] == "2026-03-15"
    assert data["note"] == "Dinner with team"
    assert "id" in data

def test_create_expense_invalid_amount(client):
    payload = {
        "amount": -50.0,
        "category": "Food",
        "date": "2026-03-15"
    }
    response = client.post("/api/expenses", json=payload)
    assert response.status_code == 422
    assert response.json()["error"] is True

def test_create_expense_invalid_date(client):
    payload = {
        "amount": 100.0,
        "category": "Food",
        "date": "not-a-valid-date"
    }
    response = client.post("/api/expenses", json=payload)
    assert response.status_code == 422

def test_list_and_filter_expenses(client):
    client.post("/api/expenses", json={"amount": 100, "category": "Food", "date": "2026-03-10"})
    client.post("/api/expenses", json={"amount": 500, "category": "Rent", "date": "2026-03-01"})
    client.post("/api/expenses", json={"amount": 200, "category": "Food", "date": "2026-03-12"})

    # All expenses
    res = client.get("/api/expenses")
    assert res.status_code == 200
    assert len(res.json()) == 3

    # Filter category
    res_filtered = client.get("/api/expenses?category=Food")
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()) == 2
    assert all(e["category"] == "Food" for e in res_filtered.json())

    # Filter date range
    res_date = client.get("/api/expenses?start_date=2026-03-11&end_date=2026-03-15")
    assert res_date.status_code == 200
    assert len(res_date.json()) == 1
    assert res_date.json()[0]["amount"] == 200

def test_get_expense_by_id(client):
    created = client.post("/api/expenses", json={"amount": 150, "category": "Bills", "date": "2026-03-10"}).json()
    exp_id = created["id"]

    res = client.get(f"/api/expenses/{exp_id}")
    assert res.status_code == 200
    assert res.json()["id"] == exp_id

    # Non-existent
    res_404 = client.get("/api/expenses/non_existent_id")
    assert res_404.status_code == 404
    assert res_404.json()["error"] is True

def test_update_expense(client):
    created = client.post("/api/expenses", json={"amount": 300, "category": "Shopping", "date": "2026-03-10"}).json()
    exp_id = created["id"]

    update_res = client.put(f"/api/expenses/{exp_id}", json={"amount": 450, "note": "Updated note"})
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["amount"] == 450
    assert updated["note"] == "Updated note"
    assert updated["category"] == "Shopping"

def test_delete_expense(client):
    created = client.post("/api/expenses", json={"amount": 300, "category": "Shopping", "date": "2026-03-10"}).json()
    exp_id = created["id"]

    del_res = client.delete(f"/api/expenses/{exp_id}")
    assert del_res.status_code == 200

    # Verify deleted
    get_res = client.get(f"/api/expenses/{exp_id}")
    assert get_res.status_code == 404

def test_expense_summary(client):
    client.post("/api/expenses", json={"amount": 1000, "category": "Rent", "date": "2026-03-01"})
    client.post("/api/expenses", json={"amount": 250, "category": "Food", "date": "2026-03-05"})
    client.post("/api/expenses", json={"amount": 150, "category": "Food", "date": "2026-03-08"})

    res = client.get("/api/expenses/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_amount"] == 1400.0
    assert data["total_count"] == 3
    assert len(data["by_category"]) == 2
    # Rent is highest total (1000)
    assert data["by_category"][0]["category"] == "Rent"
    assert data["by_category"][0]["total"] == 1000.0
    assert data["by_category"][1]["category"] == "Food"
    assert data["by_category"][1]["total"] == 400.0
    assert data["by_category"][1]["count"] == 2
