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

def test_get_current_user_profile(client, auth_headers, auth_user):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == auth_user.id
    assert data["email"] == auth_user.email
    assert data["name"] == auth_user.name

def test_get_current_user_profile_unauthorized(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert "token required" in response.json()["detail"].lower()

def test_unauthenticated_user_lookup_endpoint_removed(client):
    response = client.get("/api/auth/users/usr_test_123")
    assert response.status_code == 404

def test_config_dev_secret_fallback():
    from backend.config import Settings, DEV_FALLBACK_SECRET
    s = Settings(ENVIRONMENT="development", SECRET_KEY="")
    assert s.SECRET_KEY == DEV_FALLBACK_SECRET

def test_config_production_secret_enforced():
    import pytest
    from backend.config import Settings
    with pytest.raises(ValueError, match="SECRET_KEY must be configured"):
        Settings(ENVIRONMENT="production", SECRET_KEY="")

def test_config_allowed_origins_parsing():
    from backend.config import Settings
    s = Settings(ALLOWED_ORIGINS="http://localhost:8000,http://localhost:3000")
    assert s.ALLOWED_ORIGINS == ["http://localhost:8000", "http://localhost:3000"]


