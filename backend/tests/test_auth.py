def test_register_success(client):
    payload = {
        "name": "Sarah Connor",
        "email": "sarah@example.com",
        "password": "Password123!"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Sarah Connor"
    assert data["email"] == "sarah@example.com"
    assert "password" not in data
    assert "password_hash" not in data
    assert "id" in data

def test_register_duplicate_email(client):
    payload = {
        "name": "Sarah Connor",
        "email": "sarah@example.com",
        "password": "Password123!"
    }
    client.post("/api/auth/register", json=payload)
    second_res = client.post("/api/auth/register", json=payload)
    assert second_res.status_code == 400
    assert "already exists" in second_res.json()["detail"]

def test_register_invalid_email(client):
    payload = {
        "name": "Sarah Connor",
        "email": "not-an-email",
        "password": "Password123!"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422

def test_login_success(client):
    client.post("/api/auth/register", json={
        "name": "John Doe",
        "email": "john@example.com",
        "password": "SecretPassword123"
    })

    login_res = client.post("/api/auth/login", json={
        "email": "john@example.com",
        "password": "SecretPassword123"
    })
    assert login_res.status_code == 200
    data = login_res.json()
    assert "token" in data
    assert data["user"]["email"] == "john@example.com"

def test_login_invalid_password(client):
    client.post("/api/auth/register", json={
        "name": "John Doe",
        "email": "john@example.com",
        "password": "SecretPassword123"
    })

    login_res = client.post("/api/auth/login", json={
        "email": "john@example.com",
        "password": "WrongPassword"
    })
    assert login_res.status_code == 401
    assert "Invalid email or password" in login_res.json()["detail"]

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "database_dialect" in data
