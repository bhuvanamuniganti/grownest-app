const express = require("express");
const cors = require("cors");
const translatorsRoutes = require("./routes/translators");
const speakingRoutes = require("./routes/speakingRoutes")


const fileUpload = require("express-fileupload");


const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "./tmp/"
}));


app.get("/", (req, res) => {
  res.json({ message: "Backend is running" });
});

app.use("/api/ai", translatorsRoutes);
app.use("/api/speaking", speakingRoutes)


module.exports = app; 
