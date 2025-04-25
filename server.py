from flask import Flask, request, jsonify
import numpy as np
import joblib
from flask_cors import CORS
import logging
from datetime import datetime
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import json

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Security Configuration
AES_KEY = b"7f9K2b$pQ!4z@1Yd" # Must match frontend key
AES_IV_LENGTH = 16  # 16 bytes for AES-CBC

# Load model with error handling
try:
    model = joblib.load("captcha_model.pkl")
    logger.info("Model loaded successfully")
except Exception as e:
    logger.error(f"Error loading model: {str(e)}")
    raise

# Mappings
BUTTON_MAPPING = {"NoButton": 0, "Left": 1, "Right": 2}
STATE_MAPPING = {"Move": 0, "Pressed": 1, "Released": 2}
MAX_SEQUENCE_LENGTH = 100
FEATURES_PER_ROW = 6  # recordTimestamp, clientTimestamp, button, state, x, y

def decrypt_data(encrypted_data):
    """Decrypt AES-CBC encrypted data from frontend"""
    try:
        # Decode base64
        raw_data = base64.b64decode(encrypted_data)
        
        # Extract IV (first 16 bytes) and encrypted data
        iv = raw_data[:AES_IV_LENGTH]
        ciphertext = raw_data[AES_IV_LENGTH:]
        
        # Setup cipher
        cipher = Cipher(
            algorithms.AES(AES_KEY),
            modes.CBC(iv),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        # Decrypt and decode
        decrypted = decryptor.update(ciphertext) + decryptor.finalize()
        
        # Improved padding handling
        try:
            # Try JSON parsing with potential padding
            return json.loads(decrypted.decode('utf-8', errors='ignore').strip('\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10'))
        except json.JSONDecodeError:
            # If that fails, try PKCS7 padding removal
            pad_length = decrypted[-1]
            if pad_length < len(decrypted) and all(b == pad_length for b in decrypted[-pad_length:]):
                decrypted = decrypted[:-pad_length]
            return json.loads(decrypted.decode('utf-8', errors='ignore'))
    except Exception as e:
        logger.error(f"Decryption failed: {str(e)}")
        raise ValueError("Invalid encrypted data")

def normalize_cursor_data(raw_data):
    """Normalize cursor data field names to handle different formats"""
    normalized_data = []
    
    for entry in raw_data:
        # Get values using either camelCase or snake_case keys
        record_ts = (
            entry.get("recordTimestamp") or 
            entry.get("record timestamp") or 
            entry.get("record_timestamp", 0.0)
        )
        
        client_ts = (
            entry.get("clientTimestamp") or 
            entry.get("client timestamp") or 
            entry.get("client_timestamp", 0.0)
        )
        
        button = entry.get("button", "NoButton")
        state = entry.get("state", "Move")
        x = entry.get("x", 0)
        y = entry.get("y", 0)
        
        normalized_data.append([
            float(record_ts),
            float(client_ts),
            BUTTON_MAPPING.get(button, 0),
            STATE_MAPPING.get(state, 0),
            float(x),
            float(y)
        ])
    
    return normalized_data

@app.route("/predict", methods=["POST"])
def predict():
    start_time = datetime.now()
    logger.info(f"Received prediction request with content type: {request.content_type}")
    
    try:
        # Handle encrypted data
        if request.headers.get('X-Encrypted') == 'AES-CBC':
            try:
                encrypted_data = request.get_data()
                data = decrypt_data(encrypted_data)
                logger.info("Successfully decrypted data")
            except ValueError as e:
                logger.error(f"Decryption error: {e}")
                return jsonify({"error": "Decryption failed"}), 400
        # Handle JSON data
        elif request.is_json:
            data = request.get_json()
            logger.info("Received JSON data directly")
        # Handle octet-stream without encryption header
        elif request.content_type == 'application/octet-stream':
            try:
                encrypted_data = request.get_data()
                data = decrypt_data(encrypted_data)
                logger.info("Decrypted octet-stream data")
            except ValueError:
                # Try parsing as JSON if decryption fails
                try:
                    data = json.loads(request.get_data(as_text=True))
                    logger.info("Parsed octet-stream as JSON")
                except json.JSONDecodeError:
                    logger.error("Could not parse octet-stream as JSON")
                    return jsonify({"error": "Invalid data format"}), 400
        else:
            logger.error(f"Unsupported content type: {request.content_type}")
            return jsonify({"error": "Unsupported content type"}), 400
            
        # Extract cursor data with flexible field name
        cursor_data = data.get("cursorData") or data.get("cursor_data")
        if not cursor_data:
            logger.error("Missing cursor data in request")
            return jsonify({"error": "Missing cursor data"}), 400
            
        # Validate cursor data structure
        if not isinstance(cursor_data, list) or len(cursor_data) < 2:
            logger.error(f"Invalid cursor data: {type(cursor_data)}, length: {len(cursor_data) if isinstance(cursor_data, list) else 'N/A'}")
            return jsonify({"error": "At least 2 cursor data points required"}), 400
        
        # Log sample data point for debugging
        logger.info(f"Sample data point: {cursor_data[0]}")
        
        # Normalize and process raw features
        try:
            raw_features = normalize_cursor_data(cursor_data)
            raw_features = np.array(raw_features, dtype=np.float64)
        except Exception as e:
            logger.error(f"Error normalizing cursor data: {str(e)}")
            return jsonify({"error": "Invalid cursor data format"}), 400

        # Pad or truncate sequence
        if len(raw_features) < MAX_SEQUENCE_LENGTH:
            padding = np.zeros((MAX_SEQUENCE_LENGTH - len(raw_features), FEATURES_PER_ROW))
            raw_features = np.vstack((raw_features, padding))
        else:
            raw_features = raw_features[:MAX_SEQUENCE_LENGTH]

        # Flatten features
        raw_features = raw_features.flatten().reshape(1, -1)

        # Validate feature dimensions
        expected_features = MAX_SEQUENCE_LENGTH * FEATURES_PER_ROW
        if raw_features.shape[1] != expected_features:
            logger.error(f"Feature dimension mismatch. Expected {expected_features}, got {raw_features.shape[1]}")
            return jsonify({
                "error": "Feature dimension mismatch",
                "expected": expected_features,
                "received": raw_features.shape[1]
            }), 400

        # Make prediction
        prediction = int(model.predict(raw_features)[0])
        probabilities = model.predict_proba(raw_features)[0]
        confidence = float(np.max(probabilities))

        logger.info(f"Prediction completed in {(datetime.now() - start_time).total_seconds():.3f}s - "
                   f"Prediction: {prediction}, Confidence: {confidence:.2f}, "
                   f"Points: {len(cursor_data)}")

        return jsonify({
            "prediction": prediction,
            "confidence": confidence,
            "processed_points": min(len(cursor_data), MAX_SEQUENCE_LENGTH)
        })

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "model_features": MAX_SEQUENCE_LENGTH * FEATURES_PER_ROW,
        "encryption": "AES-CBC" if AES_KEY else "disabled"
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
