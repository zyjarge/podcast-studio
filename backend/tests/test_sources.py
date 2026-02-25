"""Tests for RSS Sources API"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestRSSSourcesAPI:
    """Test RSS Sources endpoints"""

    def test_list_sources(self):
        """Test listing sources"""
        response = client.get("/api/v1/sources/")
        assert response.status_code == 200
        # Database may have existing data from previous tests
        assert isinstance(response.json(), list)

    def test_create_source(self):
        """Test creating a new source"""
        payload = {
            "name": "Tech News",
            "url": "https://example.com/rss",
            "enabled": True,
            "auto_mode": False
        }
        response = client.post("/api/v1/sources/", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Tech News"
        assert data["url"] == "https://example.com/rss"
        assert data["enabled"] is True
        assert "id" in data

    def test_get_source(self):
        """Test getting a single source"""
        # Create first
        payload = {
            "name": "Test Source",
            "url": "https://test.com/rss",
            "enabled": True,
            "auto_mode": False
        }
        create_resp = client.post("/api/v1/sources/", json=payload)
        source_id = create_resp.json()["id"]

        # Get
        response = client.get(f"/api/v1/sources/{source_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Test Source"

    def test_update_source(self):
        """Test updating a source"""
        # Create first
        payload = {
            "name": "Original Name",
            "url": "https://original.com/rss",
            "enabled": True,
            "auto_mode": False
        }
        create_resp = client.post("/api/v1/sources/", json=payload)
        source_id = create_resp.json()["id"]

        # Update
        update_payload = {"name": "Updated Name", "enabled": False}
        response = client.put(f"/api/v1/sources/{source_id}", json=update_payload)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["enabled"] is False

    def test_delete_source(self):
        """Test deleting a source"""
        # Create first
        payload = {
            "name": "To Delete",
            "url": "https://delete.com/rss",
            "enabled": True,
            "auto_mode": False
        }
        create_resp = client.post("/api/v1/sources/", json=payload)
        source_id = create_resp.json()["id"]

        response = client.delete(f"/api/v1/sources/{source_id}")
        assert response.status_code == 200

        # Verify deleted
        get_resp = client.get(f"/api/v1/sources/{source_id}")
        assert get_resp.status_code == 404

    def test_get_nonexistent_source(self):
        """Test getting a source that doesn't exist"""
        response = client.get("/api/v1/sources/99999")
        assert response.status_code == 404
