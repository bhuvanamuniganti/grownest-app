import { useLocation, useNavigate } from "react-router-dom";
import "./Practice.css";

const STORAGE_KEY = "grownest_child_profile";

function Practice() {
  const location = useLocation();
  const navigate = useNavigate();

  
  const state =
    location.state ||
    JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

  const openSection = (section) => {
    navigate(`/practice/${section}`, {
      state: state
    });
  };

  return (
    <div className="practice-page">
      <div className="practice-header">
        <button className="back-btn" onClick={() => navigate("/", { state })}>
        Back
        </button>
        <h2>Assist Your Child</h2>
      </div>

      <div className="child-info">
        <p><b>Age:</b> {state?.age}</p>
        <p><b>Class:</b> {state?.classLevel}</p>
        {state?.interest && <p><b>Interest:</b> {state.interest}</p>}
      </div>

      <div className="section-grid">

          <div
          className="practice-card"
          onClick={() => navigate("/practice/audio-books", { state })}
        >
          <h3>🎧 Audio Books</h3>
          <p>
            Learn concepts by listening to clear audio explanations.
            Makes learning engaging and easy to follow.
          </p>
        </div>

        <div
          className="practice-card"
          onClick={() => openSection("confident-speaker")}
        >
          <h3>🗣 Confident Speaker</h3>
          <p>
            Help your child express ideas clearly and confidently.
            Guided practice builds clarity and comfort in speaking.
          </p>
        </div>


        <div
          className="practice-card"
          onClick={() => openSection("math")}
        >
          <h3>➕ Maths Practice</h3>
          <p>
            Practice maths using step-by-step school-aligned methods.
            Strengthens understanding through guided problem solving.
          </p>
        </div>

        <div
          className="practice-card"
          onClick={() => openSection("image-practice")}
        >
          <h3>✍ Oral & Written Practice</h3>
          <p>
            Practice speaking and writing answers across subjects.
            Improves clarity, structure, and accuracy over time.
          </p>
        </div>


          <div
  className="practice-card"
  onClick={() => openSection("story-board")}
>
  <h3>🎬 AI Lesson Storyboard</h3>
  <p>
    Transform a textbook page into an AI-generated lesson storyboard with scene-by-scene narration, visual guidance, and parent-friendly explanations.
  </p>
</div>
        
        <div
          className="practice-card"
          onClick={() => openSection("sharing-section")}
        >
          <h3>🤝Resourse Sharing</h3>
          <p>
            Give what you can, take what you need - build a stronger learning community.
          </p>
        </div>

      </div>
    </div>
  );
}

export default Practice;
