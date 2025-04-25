import os
import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

# Mapping categorical values to numerical
button_mapping = {"NoButton": 0, "Left": 1, "Right": 2}
state_mapping = {"Move": 0, "Pressed": 1, "Released": 2}

# Define a fixed sequence length for input padding
MAX_SEQUENCE_LENGTH = 100  # Adjust based on dataset analysis

def load_data(folder_path, label_dict=None, default_label=0):
    """
    Loads raw dataset files from a folder, applies padding, and assigns correct labels.
    """
    data = []
    labels = []

    for user_folder in os.listdir(folder_path):
        user_path = os.path.join(folder_path, user_folder)
        if os.path.isdir(user_path):
            for session_file in os.listdir(user_path):
                file_path = os.path.join(user_path, session_file)
                if os.path.isdir(file_path):
                    continue  # ✅ Skip nested folders

                try:
                    df = pd.read_csv(file_path)
                except Exception as e:
                    print(f"❌ Failed to read {file_path}: {e}")
                    continue

                # Map categorical values
                df["button"] = df["button"].map(button_mapping).fillna(0)
                df["state"] = df["state"].map(state_mapping).fillna(0)

                try:
                    raw_features = df[["record timestamp", "client timestamp", "button", "state", "x", "y"]].to_numpy()
                except KeyError as e:
                    print(f"❌ Missing expected columns in {file_path}: {e}")
                    continue

                # Padding or trimming to MAX_SEQUENCE_LENGTH
                if len(raw_features) < MAX_SEQUENCE_LENGTH:
                    padding = np.zeros((MAX_SEQUENCE_LENGTH - len(raw_features), raw_features.shape[1]))
                    raw_features = np.vstack((raw_features, padding))
                else:
                    raw_features = raw_features[:MAX_SEQUENCE_LENGTH]

                data.append(raw_features.flatten())  # Flatten for ML model

                # Assign label
                session_label = label_dict.get(session_file, default_label) if label_dict else default_label
                labels.append(session_label)

    return np.array(data, dtype=np.float64), np.array(labels)

# Load label dictionary from public_labels.csv
labels_df = pd.read_csv("public_labels.csv")
labels_dict = dict(zip(labels_df["filename"], labels_df["is_illegal"]))

# Load training data (all human)
X_train, y_train = load_data("training_files")

# Load test data using label dictionary
X_test, y_test = load_data("test_files", labels_dict)

# Train Decision Tree model
model = DecisionTreeClassifier(max_depth=None)
model.fit(X_train, y_train)

# Save model
joblib.dump(model, "captcha_model.pkl")

# Predict and evaluate
y_pred = model.predict(X_test)

if len(y_test) != len(y_pred):
    print(f"❌ Mismatch: y_test has {len(y_test)} samples, y_pred has {len(y_pred)} samples.")
else:
    print("✅ Labels and predictions match in length.")
    print("Accuracy:", accuracy_score(y_test, y_pred))
    
    # Generate and plot confusion matrix
    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=['Human', 'Bot'],
                yticklabels=['Human', 'Bot'])
    plt.xlabel('Predicted')
    plt.ylabel('Actual')
    plt.title('Confusion Matrix')
    plt.tight_layout()
    plt.savefig('confusion_matrix.png')
    plt.show()
    
    # Print classification report
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['Human', 'Bot']))