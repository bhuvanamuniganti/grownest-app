import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Practice from "./pages/Practice";
import AudioBooks from "./pages/AudioBooks";
import ConfidentSpeaker from "./pages/ConfidentSpeaker/index.jsx";
import MathSection from "./pages/MathSection/index.jsx"
import PracticeFromImageSection from "./pages/PracticeFromImageSection/index.jsx";
import SharingSection from "./pages/SharingSection/index.jsx"
import LessonStoryboardSection from "./pages/LessonStoryboardSection/index.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/audio-books" element={<AudioBooks />} />
        <Route path= "/practice/confident-speaker" element = {<ConfidentSpeaker/>}  />
        <Route path = "/practice/math" element = {<MathSection/>}  />
        <Route path = "/practice/image-practice" element = {<PracticeFromImageSection/>}/>
        <Route path = "/practice/sharing-section" element ={<SharingSection/>}/>
        <Route path="/practice/story-board" element={<LessonStoryboardSection />} />
        
      </Routes>
    </BrowserRouter>
  );
}

export default App;
