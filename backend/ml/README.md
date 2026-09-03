# Water-quality model service

Place `water_quality_model.joblib` in this directory, or set `WATER_QUALITY_MODEL_PATH` to its location.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r ml/requirements.txt
python ml/app.py
```

The service listens on `http://localhost:5001` and exposes `POST /predict` with `ph`, `tds`, and `turbidity` fields. The model's class labels are returned unchanged because their meaning depends on the synthetic training labels.
