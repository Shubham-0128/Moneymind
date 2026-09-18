def test_ai_suggestions_fallback(client):
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
    response = client.post("/api/ai/suggestions", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)
    assert len(data["suggestions"]) > 0
