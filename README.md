# AutoML Web Platform — Mini Kaggle

> Upload a CSV dataset and let the system automatically preprocess, train, evaluate, and compare multiple ML models — no code required.

---

## Overview

AutoML Web Platform is a browser-based machine learning pipeline that takes a raw CSV file and returns a ranked comparison of trained models with performance metrics. Think of it as a lightweight, self-hosted Kaggle Auto ML — built for data practitioners who want fast baselines without writing boilerplate.

---

## Features

- **CSV Upload** — drag-and-drop or file picker; instant schema preview
- **Auto Preprocessing** — handles missing values, categorical encoding, and feature scaling automatically
- **Multi-Model Training** — trains Logistic Regression, Decision Tree, and Random Forest in parallel
- **Model Evaluation** — reports accuracy, precision, recall, F1-score, and ROC-AUC per model
- **Best Model Highlight** — automatically ranks and crowns the top performer
- **Results Download** — export metrics as CSV and download the best model as a `.pkl` file

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI |
| ML & Data | scikit-learn, pandas, numpy |
| Frontend | React + Recharts |
| Styling | Tailwind CSS |
| Model Serialization | joblib |
| Optional Storage | PostgreSQL / SQLite |

---

## Project Structure

```
automl-platform/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── routers/
│   │   ├── upload.py            # CSV upload endpoint
│   │   ├── train.py             # Training pipeline endpoint
│   │   └── results.py           # Results & download endpoints
│   ├── services/
│   │   ├── preprocessor.py      # Missing values, encoding, scaling
│   │   ├── trainer.py           # Model training orchestrator
│   │   └── evaluator.py         # Metrics computation
│   ├── models/
│   │   └── schemas.py           # Pydantic request/response schemas
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Upload.jsx        # CSV drag-and-drop
│   │   │   ├── DataPreview.jsx   # Schema + sample rows
│   │   │   ├── TrainConfig.jsx   # Target column selector
│   │   │   ├── ResultsTable.jsx  # Model comparison table
│   │   │   └── MetricsChart.jsx  # Bar chart of metrics
│   │   ├── pages/
│   │   │   └── Home.jsx
│   │   └── App.jsx
│   ├── package.json
│   └── tailwind.config.js
├── docker-compose.yml
└── README.md
```

---

## Pipeline Flow

```
Upload CSV
    ↓
Schema Detection  (column types, target column selection)
    ↓
Auto Preprocessing
    ├── Drop or impute missing values
    ├── Label / one-hot encode categoricals
    └── StandardScaler on numeric features
    ↓
Train Models (in parallel)
    ├── Logistic Regression
    ├── Decision Tree
    └── Random Forest
    ↓
Evaluate Each Model
    └── Accuracy, F1, Precision, Recall, ROC-AUC
    ↓
Rank & Display Results
    ↓
Download  (metrics CSV  |  best model .pkl)
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- (Optional) Docker & Docker Compose

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`. Interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI will be live at `http://localhost:5173`.

### Docker (recommended)

```bash
docker-compose up --build
```

Both services start automatically. The UI is served at `http://localhost:3000`.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload` | Upload CSV; returns schema and preview |
| `POST` | `/train` | Start training pipeline; returns job ID |
| `GET` | `/results/{job_id}` | Poll for results and metrics |
| `GET` | `/download/model/{job_id}` | Download best model as `.pkl` |
| `GET` | `/download/results/{job_id}` | Download metrics as CSV |

---

## Models Trained

| Model | Library | Notes |
|---|---|---|
| Logistic Regression | `sklearn.linear_model` | Strong baseline for linear problems |
| Decision Tree | `sklearn.tree` | Interpretable; prone to overfit |
| Random Forest | `sklearn.ensemble` | Usually best performer; slower to train |

All models are trained with an 80/20 train-test split and 5-fold cross-validation.

---

## Preprocessing Logic

1. **Missing values** — numeric columns: median imputation; categorical columns: mode imputation
2. **Encoding** — binary categoricals: label encoding; multi-class: one-hot encoding
3. **Scaling** — `StandardScaler` applied to all numeric features after encoding
4. **Target detection** — auto-detects binary vs. multi-class classification based on the selected target column

---

## Roadmap

- [ ] Regression task support (in addition to classification)
- [ ] XGBoost and LightGBM models
- [ ] Hyperparameter tuning via Optuna
- [ ] SHAP feature importance visualizations
- [ ] User authentication and saved experiments
- [ ] Async training with job queue (Celery + Redis)
- [ ] Cloud deployment (Railway / Render / AWS)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

Please ensure all new backend code is covered by tests in `backend/tests/` and passes `ruff` linting.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
