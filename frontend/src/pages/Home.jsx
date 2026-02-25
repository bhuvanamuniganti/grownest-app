import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Home.css";

const STORAGE_KEY = "child_profile";

function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  // Load from router state OR localStorage
  const storedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const previousData = location.state || storedData;

  const [parentLanguage, setParentLanguage] = useState(
    previousData.parentLanguage || ""
  );
  const [age, setAge] = useState(previousData.age || "");
  const [classLevel, setClassLevel] = useState(
    previousData.classLevel || ""
  );
  const [interest, setInterest] = useState(
    previousData.interest || ""
  );

  const [childLang1, setChildLang1] = useState(
    previousData.childLanguages?.[0] || ""
  );
  const [childLang2, setChildLang2] = useState(
    previousData.childLanguages?.[1] || ""
  );
  const [childLang3, setChildLang3] = useState(
    previousData.childLanguages?.[2] || ""
  );

  const indianLanguages = [
    "English",
    "Hindi",
    "Telugu",
    "Tamil",
    "Kannada",
    "Malayalam",
    "Marathi",
    "Bengali",
    "Gujarati",
    "Punjabi",
    "Odia",
    "Urdu"
  ];

  const handleContinue = () => {
    if (!parentLanguage || !age || !classLevel) {
      alert("Please fill all required fields");
      return;
    }

    if (!childLang1 || !childLang2 || !childLang3) {
      alert("Please select all child languages");
      return;
    }

    const profileData = {
      parentLanguage,
      age,
      classLevel,
      interest,
      childLanguages: [childLang1, childLang2, childLang3]
    };

    //  Persist data for future visits
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));

    navigate("/practice", {
      state: profileData
    });
  };

  return (
    <div className="home-bg">
      <div className="home-card">
        <h1>GrowNest 🌱</h1>
        <p className="subtitle">
          You don’t need to be an expert. We’ll guide you
        </p>

        <div className="form-content">
          <label>Parent Language</label>
          <select
            value={parentLanguage}
            onChange={(e) => setParentLanguage(e.target.value)}
          >
            <option value="">Select parent language</option>
            {indianLanguages.map((lang) => (
              <option key={lang}>{lang}</option>
            ))}
          </select>

          <label>Child Age</label>
          <select value={age} onChange={(e) => setAge(e.target.value)}>
            <option value="">Select age</option>
            {[...Array(13)].map((_, i) => (
              <option key={i}>{i + 3}</option>
            ))}
          </select>

          <label>Class</label>
          <select
            value={classLevel}
            onChange={(e) => setClassLevel(e.target.value)}
          >
            <option value="">Select class</option>
            <option>Kindergarten</option>
            {[...Array(10)].map((_, i) => (
              <option key={i}>Class {i + 1}</option>
            ))}
          </select>

          <label>Child Interest (optional)</label>
          <select
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
          >
            <option value="">None</option>
            <option>Cricket</option>
            <option>Football</option>
            <option>Tennis</option>
            <option>Badminton</option>
            <option>Chess</option>
            <option>Carroms</option>
            <option>Drawing</option>
            <option>Painting</option>
            <option>Singing</option>
            <option>Dancing</option>
            <option>Puzzles</option>
            <option>Gardening</option>
          </select>

          <label>Child Languages</label>

          <select
            value={childLang1}
            onChange={(e) => setChildLang1(e.target.value)}
          >
            <option value="">Select language 1</option>
            {indianLanguages.map((lang) => (
              <option key={lang}>{lang}</option>
            ))}
          </select>

          <select
            value={childLang2}
            onChange={(e) => setChildLang2(e.target.value)}
          >
            <option value="">Select language 2</option>
            {indianLanguages.map((lang) => (
              <option key={lang}>{lang}</option>
            ))}
          </select>

          <select
            value={childLang3}
            onChange={(e) => setChildLang3(e.target.value)}
          >
            <option value="">Select language 3</option>
            {indianLanguages.map((lang) => (
              <option key={lang}>{lang}</option>
            ))}
          </select>
        </div>

        <button className="primary-btn" onClick={handleContinue}>
          Continue →
        </button>
      </div>
    </div>
  );
}

export default Home;
