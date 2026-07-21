# 🌱 GrowNest

**AI-Powered Family Learning Companion for Stress-Free Home Learning**

---

## 📌 Repository Access

🔗 **GitHub Repository:**
[https://github.com/bhuvanamuniganti/grownest-app](https://github.com/bhuvanamuniganti/grownest-app)

The repository is currently public.

---

🌐 **Live Demo:**  
https://grownestapp.store/

----

## 🚀 OpenAI Build Week Contributions

GrowNest existed before OpenAI Build Week as an AI-assisted learning platform.

During the Build Week submission period, I significantly extended the project using GPT-5.6 and Codex by adding major new functionality, including:

- AI Lesson Storyboard for converting textbook pages into guided lessons
- Interactive AI Understanding Test with personalized feedback
- AI-powered speaking practice with recording, transcription, translation, and evaluation
- AI-powered educational resource sharing
- Smart AI-assisted book upload with automatic metadata extraction
- Personalized educational book recommendations
- Significant backend API expansion using GPT-5.6
- Refactoring frontend into reusable React components
- UI redesign and improved parent-focused experience

Only these Build Week additions are being submitted for evaluation.

---

## 🌍 Problem Statement

In many Indian middle-class, lower-income, and single-parent households, parents deeply value education but often feel underconfident while guiding their children at home.

To provide the best education, families sometimes stretch finances significantly — occasionally sacrificing personal needs — for coaching classes and digital tools. Despite these efforts, children may begin to associate learning with stress, comparison, and excessive screen dependency.

During foundational years, this stress affects emotional well-being, confidence, and self-expression.

GrowNest is designed to reduce academic stress, strengthen parent–child bonding, and provide emotionally safe learning support at home — regardless of parents educational background.

---

## 🌼 What It Does

GrowNest is an AI-powered family learning companion that focuses on emotional well-being, confidence-building, and structured academic support.


## 🤝 Built with GPT-5.6 & Codex

GrowNest was built through an iterative collaboration between me and OpenAI's GPT-5.6 and Codex.

Rather than generating the entire application automatically, I used Codex as an AI engineering partner throughout development while making the final product, engineering, and user experience decisions myself.

### How I Collaborated with Codex

Throughout the project, I used Codex as an AI engineering partner while retaining responsibility for the product vision, feature design, implementation decisions, and testing.

Examples of how Codex accelerated development include:

- Refactoring React components into reusable modules.
- Building and refining Express.js API routes for AI-powered learning features.
- Designing and improving prompts for OCR, explanations, understanding evaluation, and book recommendations.
- Debugging frontend and backend integration issues.
- Improving state management and API communication between React and Express.
- Generating boilerplate code that I then reviewed, modified, tested, and integrated into the application.
- Assisting with documentation, code organization, and README improvements for the final submission.

Every feature was iteratively refined through multiple conversations with Codex before being integrated into the final application.

### Product Decisions

I designed the overall learning experience, including:

- A photo-to-learning workflow instead of manual text entry
- AI explanations before comprehension testing
- An Understanding Test where children explain concepts in their own words, create questions, reflect on curiosity, and connect learning to real life
- Personalized AI feedback instead of simple right/wrong scoring
- Book recommendations to encourage continued learning

### Engineering Decisions

While Codex accelerated implementation, I made the key engineering decisions, including:

- Designing the complete learning workflow:
  **Image Upload → OCR → Translation → AI Explanation → Audiobook → Understanding Test → AI Evaluation → Book Recommendations**
- Separating AI prompt generation from AI evaluation using dedicated backend APIs.
- Choosing React, Node.js, Express, and SQLite for a lightweight full-stack architecture.
- Designing reusable frontend components for learning activities.
- Iteratively testing and refining the application to ensure a smooth parent and child experience.

GPT-5.6 and Codex assisted with implementation, while I made the architectural and integration decisions, including:

- Modular Express API design
- React component architecture
- Frontend–backend communication
- Prompt refinement for educational use cases
- Testing, debugging, and iterative improvements

### Human + AI Collaboration

This project combines human creativity with AI-assisted software development.

I defined the educational vision, user experience, and learning workflow. GPT-5.6 and Codex accelerated implementation, debugging, documentation, and prompt refinement, while every major feature was reviewed, tested, and integrated by me.

### 🔊 Downloadable Audiobooks (Offline Listening)

* Reduce continuous screen exposure
* Encourage calm listening instead of scrolling
* Promote healthier digital habits
* Increase meaningful parent–child listening time
* Create deeper parent–child bonding and quality shared moments

---

### 🎤 Confidence-First Speaking Practice

* Safe speaking environment
* AI-generated supportive feedback
* Feedback in the parent’s native language
* Encouragement instead of criticism
* Reduces fear and performance anxiety
* Builds self-confidence gradually

---

### ➗ School-Method Aligned Math Support

* Step-by-step structured explanations
* Mirrors classroom teaching method
* No need for parents to be math experts
* Prevents confusion from different explanation styles
* Builds confidence in problem-solving

---

### 📸 Photo-Based Learning (Snap-to-Explain)

* Capture textbook questions instantly
* Receive structured, easy-to-understand explanations
* Works across different school boards
* Curriculum-independent support

---

### 🧠 AI-Powered Understanding Test

After learning a topic, children don't just answer predefined questions—they actively demonstrate their understanding.

* Explain the lesson in their own words
* Create and answer their own questions
* Reflect on what surprised them
* Share what they want to learn next
* Connect lessons to real-life experiences
* Receive AI-generated personalized feedback
* Identify concepts understood and areas to revisit
* Get suggested next learning topics

---

## 🛠 How It Was Built

### Frontend

* React.js + Vite
* Responsive, mobile-first design

### Backend

* Node.js + Express

### AI Integration

OpenAI models power multiple stages of the learning experience:

* Vision-based OCR for extracting text from learning materials
* AI-powered explanations in simple language
* Translation into the parent's preferred language
* Text-to-Speech narration for audiobook learning
* AI-generated understanding evaluation
* Personalized learning feedback
* Educational book recommendations

### Speech & Audio

* Speech-to-Text
* Text-to-Speech
* Downloadable offline audio

---

### Deployment

- Frontend: Netlify
- Backend: Google Cloud (Node.js + Express API)

---

## ⚙️ Setup & Installation

### Prerequisites

Before running the project, make sure you have:

- Node.js (v18 or later recommended)
- npm
- An OpenAI API Key

### 1. Clone the Repository

```bash
git clone https://github.com/bhuvanamuniganti/grownest-app.git
cd grownest-app
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Install Backend Dependencies

```bash
cd ../backend
npm install
```

All required libraries (React, Express, OpenAI SDK, SQLite, and other project dependencies) will be installed automatically from the respective `package.json` files.

### 4. Configure Environment Variables

Create a `.env` file inside the `backend` folder:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 5. Start the Backend Server

```bash
npm run dev
```

The backend will run at:

```
http://localhost:5000
```

### 6. Start the Frontend

Open a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will run at:

```
http://localhost:5173
```




## ⚡ Challenges We Ran Into

* Designing AI explanations simple enough for varied education levels
* Supporting multiple Indian languages accurately
* Ensuring smooth performance on low-end Android devices
* Managing full-stack architecture independently within limited time

---

## 🏆 Accomplishments

* Built a complete AI-powered full-stack learning platform as a solo developer
* Developed an end-to-end learning workflow from image capture to personalized AI feedback
* Integrated OCR, translation, explanation, text-to-speech, understanding evaluation, and book recommendations
* Designed a confidence-first learning experience focused on parent-child collaboration

---


## 🧠 What We Learned

AI is most powerful when it strengthens human relationships rather than replacing them.

By focusing on emotional safety, parental dignity, and stress-free learning, GrowNest demonstrates how technology can support mental well-being alongside education.

---

## 🚀 Future Roadmap

* Anonymous educational resource sharing
* Mood tracking & emotional check-ins
* Parent confidence indicators
* Screen-time reduction insights
* Scalable partnerships with schools and NGOs