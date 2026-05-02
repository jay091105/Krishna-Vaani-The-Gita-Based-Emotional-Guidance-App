# 🌟 Krishna Vaani – The Gita-Based Emotional Guidance App

A full-stack web application that provides **emotion-aware guidance inspired by the Bhagavad Gita**.
It analyzes user emotions, retrieves relevant Gita verses, and delivers **Krishna-style wisdom** to promote mental clarity and inner peace.

---

## 🚀 Features

* 🧠 **Emotion Detection**

  * Uses fine-tuned DistilBERT model
  * Fallback: keyword-based emotion classification

* 📖 **Gita Verse Retrieval**

  * Fetches relevant verses from a MongoDB database

* 🕉️ **Krishna-Style Guidance**

  * Generates meaningful responses using predefined templates

* 💾 **Save & Track**

  * Save favorite verses
  * Track emotional history and trends

* 📊 **Analytics Dashboard**

  * Visual insights of emotional patterns

---

## 🏗️ Tech Stack

### 🔹 Frontend

* React.js
* Axios
* Recharts (Data Visualization)
* Framer Motion (Animations)

### 🔹 Backend

* Flask (Python)
* MongoDB (Database)
* PyMongo

### 🔹 Machine Learning

* Hugging Face Transformers
* DistilBERT Model
* PyTorch

---

## 📂 Project Structure

```bash
.
├── backend/
│   ├── app.py
│   ├── db.py
│   ├── data_loader.py
│   ├── requirements.txt
│   ├── dataset/
│   │   └── Gita.xlsx
│   └── models/
│       └── gita_emotion_model/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
└── README.md
```

---

## ⚙️ Installation & Setup

### 🔹 Backend Setup

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### 🔹 Environment Variables

Create a `.env` file inside `backend/`:

```env
MONGO_URI=your_mongodb_connection_string
```

---

### 🔹 Run Backend

```bash
python app.py
```

Server runs at:

```
http://localhost:5000
```

---

### 🔹 Frontend Setup

```bash
cd frontend
npm install
npm start
```

Frontend runs at:

```
http://localhost:3000
```

---

## 📡 API Endpoints

| Method | Endpoint                       | Description          |
| ------ | ------------------------------ | -------------------- |
| GET    | `/api/health`                  | Health check         |
| POST   | `/api/guidance`                | Get Krishna guidance |
| POST   | `/api/save-verse`              | Save verse           |
| GET    | `/api/saved-verses`            | Get saved verses     |
| DELETE | `/api/saved-verse/:id`         | Delete saved verse   |
| GET    | `/api/emotion-history`         | Emotion history      |
| GET    | `/api/emotion-stats`           | Analytics            |
| GET    | `/api/gita-chapters`           | Gita chapters        |
| POST   | `/api/update-reading-progress` | Update progress      |

---

## 🧠 How It Works

1. User inputs text (emotion/problem)
2. Model detects emotion
3. Relevant Gita verse is fetched
4. Krishna-style response is generated
5. Result is shown with meaning & guidance

---

## ⚠️ Important Notes

* If ML model fails → fallback system works automatically
* MongoDB must be properly configured
* Ensure `Gita.xlsx` dataset exists

---

## 🛠️ Future Improvements

* 🔥 Add real-time chat interface
* 🌍 Multi-language support
* 🤖 Advanced AI-based responses
* 📱 Mobile app version

---

## 🤝 Contributing

Contributions are welcome!

```bash
git fork
git clone
git checkout -b feature-name
git commit -m "Added feature"
git push origin feature-name
```

---

## 📜 License

This project is open-source and available under the MIT License.

---

## 🙏 Acknowledgement

Inspired by the timeless wisdom of the **Bhagavad Gita** and the teachings of **Lord Krishna**.

---

## 👨‍💻 Author

**Jay (B.Tech IT Student)**
Passionate about building meaningful tech solutions using AI & Web Development.
