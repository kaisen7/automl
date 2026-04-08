
---
title: AutoML Backend API
emoji: 🤖
colorFrom: purple
colorTo: gray
sdk: docker
sdk_version: "0.0.1"
python_version: "3.10"
app_file: Dockerfile
app_port: 7860
pinned: false
---

# AutoML Backend API

FastAPI-based AutoML service for training and prediction.

## API Endpoints

- `POST /upload` - Upload CSV dataset
- `POST /train` - Train AutoML model
- `POST /predict` - Make predictions
- `GET /eda` - Get exploratory data analysis
- `GET /model_info` - Get model information
- `POST /reset` - Reset all state

## Quick Start

Access the API at `/docs` for interactive documentation.
```