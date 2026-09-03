import os
import warnings

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from satellite import satellite_bp
from swot import swot_bp

warnings.filterwarnings('ignore', category=UserWarning, module='sklearn')

app = Flask(__name__)
app.register_blueprint(satellite_bp, url_prefix='/satellite')
app.register_blueprint(swot_bp, url_prefix='/swot')
MODEL_PATH = os.getenv('WATER_QUALITY_MODEL_PATH', os.path.join(os.path.dirname(__file__), 'water_quality_model.joblib'))
FEATURES = ['ph', 'tds', 'turbidity']

try:
    loaded_model = joblib.load(MODEL_PATH)
    print(f'Water-quality model loaded from {MODEL_PATH}')
except FileNotFoundError:
    loaded_model = None
    print(f'Water-quality model not found at {MODEL_PATH}')
except Exception as error:
    loaded_model = None
    print(f'Water-quality model could not be loaded: {error}')


@app.get('/health')
def health():
    return jsonify({'status': 'healthy' if loaded_model is not None else 'degraded', 'model_loaded': loaded_model is not None, 'features': FEATURES})


@app.post('/predict')
def predict():
    if loaded_model is None:
        return jsonify({'error': 'Water-quality model is not loaded'}), 503

    data = request.get_json(silent=True) or {}
    missing = [feature for feature in FEATURES if feature not in data]
    if missing:
        return jsonify({'error': f'Missing required features: {", ".join(missing)}'}), 400

    try:
        values = {feature: float(data[feature]) for feature in FEATURES}
        input_df = pd.DataFrame([values], columns=FEATURES)
        prediction = loaded_model.predict(input_df)[0]
        response = {'predicted_water_quality': int(prediction), 'features': values}

        if hasattr(loaded_model, 'predict_proba'):
            probabilities = loaded_model.predict_proba(input_df)[0]
            classes = getattr(loaded_model, 'classes_', range(len(probabilities)))
            response['confidence'] = round(float(max(probabilities)), 4)
            response['class_probabilities'] = {str(label): round(float(probability), 4) for label, probability in zip(classes, probabilities)}

        return jsonify(response)
    except (TypeError, ValueError) as error:
        return jsonify({'error': f'Features must be numeric: {error}'}), 400
    except Exception as error:
        return jsonify({'error': str(error)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('ML_PORT', '5001')))
