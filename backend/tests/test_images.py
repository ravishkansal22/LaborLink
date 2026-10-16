from app.models import ImageUpload
from app.services.images import safe_original_name


def _upload(client, data: bytes, name: str = "photo.png", ctype: str = "image/png"):
    return client.post("/api/v1/images", files={"file": (name, data, ctype)})


def test_upload_png_and_attach_to_job(client, settings, png_bytes, job_payload):
    resp = _upload(client, png_bytes)
    assert resp.status_code == 201
    body = resp.json()
    assert body["content_type"] == "image/png"
    assert body["size_bytes"] == len(png_bytes)
    stored = list(settings.upload_path.iterdir())
    assert [p.name for p in stored] == [f"{body['id']}.png"]

    job_payload["image_id"] = body["id"]
    job = client.post("/api/v1/jobs", json=job_payload).json()
    assert job["request"]["image_id"] == body["id"]
    assert job["work_order"]["image_assessment"]["status"] == "not_analysed"
    assert "A photo of the problem area" not in job["work_order"]["missing_information"]
    assert any("photo was not analysed" in w for w in job["price_estimate"]["warnings"])


def test_content_type_is_detected_from_bytes_not_client_claim(client):
    resp = _upload(client, b"MZ\x90\x00 not an image", name="evil.png", ctype="image/png")
    assert resp.status_code == 415
    assert resp.json()["error"]["code"] == "unsupported_media_type"


def test_empty_upload_rejected(client):
    assert _upload(client, b"").status_code == 415


def test_oversized_upload_rejected(client, settings, png_bytes):
    big = png_bytes + b"\x00" * (settings.max_upload_bytes + 1)
    resp = _upload(client, big)
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "payload_too_large"
    assert not settings.upload_path.exists() or not any(settings.upload_path.iterdir())


def test_missing_file_field_is_validation_error(client):
    resp = client.post("/api/v1/images", files={"other": ("a.png", b"x", "image/png")})
    assert resp.status_code == 422


def test_original_filename_is_sanitised(client, png_bytes, settings):
    resp = _upload(client, png_bytes, name="../../etc/pass wd.png")
    assert resp.status_code == 201
    with client.app.state.session_factory() as s:
        record = s.get(ImageUpload, resp.json()["id"])
    assert record.original_filename == "pass_wd.png"
    assert (settings.upload_path / record.stored_filename).exists()


def test_safe_original_name_edge_cases():
    assert safe_original_name(None) is None
    assert safe_original_name("..") is None
    assert safe_original_name(r"C:\Users\x\img.jpg") == "img.jpg"
