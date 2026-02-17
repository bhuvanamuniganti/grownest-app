import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Practice from "./pages/Practice";
import AudioBooks from "./pages/AudioBooks";
import ConfidentSpeaker from "./pages/ConfidentSpeaker/index.jsx";



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/audio-books" element={<AudioBooks />} />
        <Route path= "/practice/confident-speaker" element = {<ConfidentSpeaker/>}  />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
