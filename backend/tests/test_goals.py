def test_create_goal_valid(client):
    payload = {
        "name": "Emergency Fund",
        "target_amount": 50000.0,
        "saved_so_far": 10000.0,
        "target_date": "2026-12-31"
    }
    response = client.post("/api/goals", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Emergency Fund"
    assert data["target_amount"] == 50000.0
    assert data["saved_so_far"] == 10000.0
    assert data["progress_percentage"] == 20.0
    assert "id" in data

def test_create_goal_invalid_target_amount(client):
    payload = {
        "name": "Trip",
        "target_amount": 0,
        "target_date": "2026-12-31"
    }
    response = client.post("/api/goals", json=payload)
    assert response.status_code == 422

def test_list_and_get_goals(client):
    client.post("/api/goals", json={"name": "Goal A", "target_amount": 1000, "target_date": "2026-12-31"})
    created_b = client.post("/api/goals", json={"name": "Goal B", "target_amount": 2000, "target_date": "2026-12-31"}).json()

    res = client.get("/api/goals")
    assert res.status_code == 200
    assert len(res.json()) == 2

    res_single = client.get(f"/api/goals/{created_b['id']}")
    assert res_single.status_code == 200
    assert res_single.json()["name"] == "Goal B"

    res_404 = client.get("/api/goals/non_existent_id")
    assert res_404.status_code == 404

def test_update_goal(client):
    created = client.post("/api/goals", json={"name": "Car", "target_amount": 10000, "target_date": "2026-12-31"}).json()
    goal_id = created["id"]

    res = client.put(f"/api/goals/{goal_id}", json={"name": "New Car", "target_amount": 15000})
    assert res.status_code == 200
    updated = res.json()
    assert updated["name"] == "New Car"
    assert updated["target_amount"] == 15000

def test_add_savings_and_cap(client):
    created = client.post(
        "/api/goals",
        json={"name": "Laptop", "target_amount": 1000.0, "saved_so_far": 200.0, "target_date": "2026-12-31"}
    ).json()
    goal_id = created["id"]

    # Add 300
    res = client.patch(f"/api/goals/{goal_id}/savings", json={"amount": 300.0})
    assert res.status_code == 200
    assert res.json()["saved_so_far"] == 500.0
    assert res.json()["progress_percentage"] == 50.0

    # Add 800 (exceeds 1000 cap)
    res_capped = client.patch(f"/api/goals/{goal_id}/savings", json={"amount": 800.0})
    assert res_capped.status_code == 200
    assert res_capped.json()["saved_so_far"] == 1000.0
    assert res_capped.json()["progress_percentage"] == 100.0

def test_delete_goal(client):
    created = client.post("/api/goals", json={"name": "Phone", "target_amount": 500, "target_date": "2026-12-31"}).json()
    goal_id = created["id"]

    del_res = client.delete(f"/api/goals/{goal_id}")
    assert del_res.status_code == 200

    get_res = client.get(f"/api/goals/{goal_id}")
    assert get_res.status_code == 404
