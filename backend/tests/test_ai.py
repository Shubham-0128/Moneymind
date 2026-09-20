def test_ai_suggestions_unauthenticated(client):
    payload = {
        "summary": {
            "monthTotal": 24500,
            "categoryBreakdown": {"Food": 8500, "Rent": 12000}
        }
    }
    response = client.post("/api/ai/suggestions", json=payload)
    assert response.status_code == 401
    assert "token required" in response.json()["detail"].lower()

def test_ai_suggestions_authenticated_fallback(client, auth_headers):
    payload = {
        "summary": {
            "monthTotal": 24500,
            "categoryBreakdown": {
                "Food": 8500,
                "Rent": 12000,
                "Bills": 4000
            }
        }
    }
    response = client.post("/api/ai/suggestions", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)
    assert len(data["suggestions"]) > 0
    # Verify fallback generated concrete category advice
    assert any("Food" in s or "Rent" in s for s in data["suggestions"])

def test_ai_suggestions_alias_route(client, auth_headers):
    payload = {
        "summary": {
            "monthTotal": 15000,
            "categoryBreakdown": {"Transport": 3000, "Food": 5000}
        }
    }
    response = client.post("/api/suggestions", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()["suggestions"]) > 0

