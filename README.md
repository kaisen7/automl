#  AutoML Web Platform

**Precision Machine Learning, Simplified.** AutoML is a comprehensive end-to-end platform designed to bridge the gap between raw data and actionable machine learning models. Upload your data, and let the platform handle the heavy lifting—from automated cleaning and model selection to deep exploratory analysis and real-time inference.

---

## Application Gallery

<div align="center">
  <img src="screenshots/01_homepage.png" width="400" alt="Home Page">
  <img src="screenshots/02_upload.png" width="400" alt="Upload Page">
  <img src="screenshots/03_results.png" width="400" alt="Results Page">
  <img src="screenshots/04_eda.png" width="400" alt="EDA Page">
  <img src="screenshots/05_predictor.png" width="400" alt="Predictor Page">
  <img src="screenshots/06_feedback.png" width="400" alt="Feedback Form">
</div>

---

##  Key Features

### 1. Automated Model Training
One-click model selection and optimization. The platform automatically evaluates multiple algorithms (Random Forest, XGBoost, Linear Models, etc.), performs cross-validation, and selects the champion model for your specific dataset.

### 2. Interactive EDA Dashboard
Deep-dive into your data with automated visualizations.
- **Outlier Detection**: IQR-based identification of anomalies.
- **Correlation Heatmaps**: Understand relationships between features.
- **Distribution Analysis**: Histograms and box-plots for every numeric column.
- **ML Readiness**: A "Readiness Score" that evaluates data quality before training.

### 3. Real-time Inference
Once trained, your model is immediately deployable.
- Input data manually through a clean, dynamic form.
- Perform bulk predictions by uploading a secondary CSV.
- Download results instantly.

### 4. Global Feedback System
A glassmorphic feedback query system integrated with the **Resend API**, ensuring your queries reach our team directly via email—even when deployed on restrictive cloud environments like Hugging Face.

---

##  Technical Stack

- **Frontend**: [React.js](https://reactjs.org/) with a custom **Glassmorphism CSS** design system.
- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python) for high-performance async processing.
- **Machine Learning**: [Scikit-learn](https://scikit-learn.org/), [Pandas](https://pandas.pydata.org/), and [NumPy](https://numpy.org/).
- **Email Delivery**: [Resend API](https://resend.com/) (HTTPS based).
- **Styling**: Vanilla CSS with modern flex/grid layouts and micro-animations.

---

##  Getting Started

### Local Development

1. **Clone the Repo**:
   ```bash
   git clone "https://github.com/Charanponaganti/automl"
   cd automl
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm start
   ```

### Environment Variables
Create a `.env` file in the `backend/` directory:
```env
RESEND_API_KEY=re_your_api_key
```

---

##  Deployment (Hugging Face)

This project is optimized for **Hugging Face Spaces**. 
1. Create a "Blank" Space with the **Docker** or **Static** SDK (depending on your build).
2. Add your `RESEND_API_KEY` to the **Variables and Secrets** section in your Space settings.
3. Push the `Auto-ML` folder content to your Space repository.

---

##  License
Custom Project License - AI-Driven Automated Machine Learning.
