from __future__ import annotations

import pytest


def test_auth_login_new_user(make_client):
    client = make_client()
    res = client.post(
        "/api/v1/auth/login",
        json={"phone": "+919876543210", "email": "tester@example.com", "name": "Tester", "role": "worker"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_new"] is True
    assert data["phone"] == "+919876543210"
    assert data["email"] == "tester@example.com"
    assert data["name"] == "Tester"
    assert "user_id" in data


def test_auth_login_existing_user_persists_id(make_client):
    client = make_client()
    # 1. Register with phone
    r1 = client.post("/api/v1/auth/login", json={"phone": "+919111111111", "name": "First"})
    user_id_1 = r1.json()["user_id"]

    # 2. Login again with same phone
    r2 = client.post("/api/v1/auth/login", json={"phone": "+919111111111"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["user_id"] == user_id_1
    assert data["is_new"] is False


def test_auth_login_links_email_to_existing_phone(make_client):
    client = make_client()
    r1 = client.post("/api/v1/auth/login", json={"phone": "+919222222222"})
    user_id = r1.json()["user_id"]

    # Supply email on subsequent request
    r2 = client.post("/api/v1/auth/login", json={"phone": "+919222222222", "email": "linkme@example.com"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["user_id"] == user_id
    assert data["email"] == "linkme@example.com"


def test_auth_get_user_profile(make_client):
    client = make_client()
    created = client.post("/api/v1/auth/login", json={"phone": "+919333333333", "name": "ProfileTest"}).json()

    res = client.get(f"/api/v1/auth/user/{created['user_id']}")
    assert res.status_code == 200
    assert res.json()["name"] == "ProfileTest"


def test_auth_empty_credentials_rejected(make_client):
    client = make_client()
    res = client.post("/api/v1/auth/login", json={})
    assert res.status_code == 400