const express = require("express");
const cors = require("cors");
const translatorsRoutes = require("./routes/translators");
const speakingRoutes = require("./routes/speakingRoutes")
const learningRoutes = require("./routes/learningRoutes")
const imageRoutes = require("./routes/practiceImage")
const uploadRoutes = require("./routes/upload");
const receiveRoutes = require("./routes/receive");

const fileUpload = require("express-fileupload");


const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173", // local development
      "https://grownestapp.netlify.app", // production frontend
    ],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

app.use("/uploads", express.static("src/uploads"));

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/",
  limits: { fileSize: 10 * 1024 * 1024 },
}));


app.get("/", (req, res) => {
  res.json({ message: "Backend is running" });
});

app.use("/api/ai", translatorsRoutes);
app.use("/api/speaking", speakingRoutes)
app.use("/api/learning", learningRoutes)
app.use("/api", imageRoutes)
app.use("/api", uploadRoutes);
app.use("/api", receiveRoutes);


module.exports = app; 
