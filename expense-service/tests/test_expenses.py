import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.mark.parametrize("method", ["get", "delete"])
def test_missing_expense_returns_structured_404(client, method):
    response = getattr(client, method)("/expenses/999")
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {
        "status": "error",
        "status_code": 404,
        "code": "expense_not_found",
        "message": "هزینه با شناسه 999 پیدا نشد.",
        "expense_id": 999,
    }


def test_create_read_list_and_delete_success(client):
    payload = {"title": "ناهار", "amount": 150000}
    created = client.post("/expenses", json=payload)
    assert created.status_code == 201
    expense = created.json()
    assert expense == {"id": 1, **payload}
    response = client.get("/expenses/1")
    assert response.status_code == 200
    assert response.json() == expense
    listing = client.get("/expenses")
    assert listing.status_code == 200
    assert listing.json() == [expense]
    deleted = client.delete("/expenses/1")
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert client.get("/expenses").json() == []
    assert client.get("/expenses/1").status_code == 404
    assert client.delete("/expenses/1").json()["code"] == "expense_not_found"


def test_failed_delete_preserves_existing_expense(client):
    expense = client.post("/expenses", json={"title": "کتاب", "amount": 500}).json()
    assert client.delete("/expenses/999").status_code == 404
    assert client.get(f"/expenses/{expense['id']}").json() == expense


@pytest.mark.parametrize("method", ["get", "delete"])
@pytest.mark.parametrize("expense_id", ["abc", "0", "-1"])
def test_invalid_id_keeps_validation_error(client, method, expense_id):
    response = getattr(client, method)(f"/expenses/{expense_id}")
    assert response.status_code == 422
    assert "detail" in response.json()
    assert "code" not in response.json()


def test_invalid_expense_is_not_created(client):
    response = client.post("/expenses", json={"title": "", "amount": -10})
    assert response.status_code == 422
    assert client.get("/expenses").json() == []


def test_app_instances_have_independent_data(client):
    client.post("/expenses", json={"title": "کتاب", "amount": 500})
    with TestClient(create_app()) as other:
        assert other.get("/expenses").json() == []
