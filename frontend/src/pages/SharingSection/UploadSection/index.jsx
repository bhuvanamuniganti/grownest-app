import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { API_BASE } from "../../../api";
import "./index.css";

export default function UploadSection({ setMe }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // camera state
  const [cameraOn, setCameraOn] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [useFront, setUseFront] = useState(false); // false = back, true = front

  const [imageLoadError, setImageLoadError] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // ---------- Improved educational-item detector (RELAXED) ----------
  // kept for local checking but server is authoritative
  // (not touched)

  // ==== UPLOAD (uses server-side strict classifier) ====
  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setUploading(true);
      setError("");
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        withCredentials: true,
      });

      const aiData = res.data || {};

      if (aiData.quality && aiData.quality.toLowerCase() === "low") {
        setResult(null);
        toast.error("⚠️ Upload rejected: Low-quality");
        return;
      }

      setResult(aiData);
      setImageLoadError(false);
      if (setMe) setMe((prev) => ({ ...prev, points: (prev.points || 0) + 10 }));
      toast.success("🎉 Uploaded & analyzed with AI! You earned +10 points");
    } catch (err) {
      console.error("Upload failed (frontend):", err);

      const serverData = err?.response?.data;
      if (serverData) {
        if (serverData.reason === "low_quality" || (serverData.error && serverData.error.toLowerCase().includes("low quality"))) {
          setResult(null);
          setError("Upload rejected: Low-quality.");
          toast.error("⚠️ Upload rejected: Low-quality");
          return;
        }

        if (serverData.error && serverData.error.toLowerCase().includes("not recognized as an educational")) {
          setResult(null);
          const reasonText = serverData.reason ? ` (${serverData.reason})` : "";
          setError("Uploaded image is not recognized as an educational item.");
          toast.error(`⚠️ Not an educational item — upload rejected${reasonText}.`);
          return;
        }

        if (serverData.reason && (serverData.reason === "classifier_failure" || serverData.reason === "classifier_error" || serverData.reason === "non_json_response")) {
          setResult(null);
          setError("Upload failed: classifier error. Try a clearer photo or check server logs.");
          toast.error("⚠️ Upload rejected: classifier ambiguous/error.");
          return;
        }

        const msg = serverData.error || JSON.stringify(serverData);
        setError(msg);
        toast.error(`⚠️ Upload failed: ${msg}`);
        return;
      }

      setError(err?.message || "Upload failed");
      toast.error("⚠️ Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleUploadMore() {
    setResult(null);
    setFile(null);
    revokePreview();
    setError("");
    setImageLoadError(false);
  }

  // preview cleanup
  function revokePreview() {
    if (preview && preview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(preview);
      } catch {}
    }
    setPreview(null);
  }

  useEffect(() => {
    return () => {
      revokePreview();
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- NEW: auto-select camera based on viewport ----------
  useEffect(() => {
    const chooseCameraForWidth = () => {
      const largeBreakpoint = 1024;
      setUseFront(window.innerWidth >= largeBreakpoint);
    };

    chooseCameraForWidth();
    window.addEventListener("resize", chooseCameraForWidth);
    return () => window.removeEventListener("resize", chooseCameraForWidth);
  }, []);
  // -----------------------------------------------------------------

  // ==== CAMERA ====
  async function startCamera() {
    setError("");
    setFrameReady(false);

    if (preview) {
      revokePreview();
      setFile(null);
      setResult(null);
    }

    try {
      const facingMode = useFront ? "user" : { ideal: "environment" };
      const constraints = { video: { facingMode } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        const onCanPlay = () => {
          const w = videoRef.current.videoWidth || 0;
          const h = videoRef.current.videoHeight || 0;
          setVideoSize({ w, h });
          setFrameReady(w > 0 && h > 0);
          videoRef.current.removeEventListener("canplay", onCanPlay);
        };

        videoRef.current.addEventListener("canplay", onCanPlay);

        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("video.play() error:", playErr);
        }

        setTimeout(() => {
          if (!frameReady && videoRef.current) {
            const w = videoRef.current.videoWidth || 0;
            const h = videoRef.current.videoHeight || 0;
            setVideoSize({ w, h });
            setFrameReady(w > 0 && h > 0);
          }
        }, 800);
      }

      setCameraOn(true);
    } catch (err) {
      console.error("startCamera error:", err);
      setError(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera and reload."
          : "Unable to access camera. Use HTTPS/localhost and check permissions."
      );
      toast.error("Couldn't open camera — check console & permissions.");
      setCameraOn(false);
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
    }
  }

  function stopCamera() {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch (err) {
      console.warn("stopCamera error", err);
    } finally {
      setCameraOn(false);
      setFrameReady(false);
      setVideoSize({ w: 0, h: 0 });
      if (videoRef.current) {
        try {
          videoRef.current.srcObject = null;
          videoRef.current.pause();
        } catch {}
      }
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !frameReady) {
      toast.error("Camera frame not ready");
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement("canvas");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Failed to capture image");
          return;
        }
        const capturedFile = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });

        if (preview && preview.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(preview);
          } catch {}
        }

        const objectUrl = URL.createObjectURL(capturedFile);
        setFile(capturedFile);
        setPreview(objectUrl);
        setResult(null);
        setImageLoadError(false);
        toast.success("Photo captured — ready to upload");

        // stop camera so preview occupies the same area
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  }

  function handleRemoveAndReopen() {
    if (preview && preview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(preview);
      } catch {}
    }
    setPreview(null);
    setFile(null);
    setResult(null);
    setImageLoadError(false);
    setTimeout(() => startCamera(), 150);
  }

  // derive safe display src
  function makeDisplaySrc(resultObj) {
    if (!resultObj) return null;
    const raw = resultObj.imageUrl || resultObj.filename || resultObj.file || "";
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return encodeURI(raw);
    const base =
      typeof API_BASE === "string" && API_BASE ? API_BASE.replace(/\/$/, "") : window.location.origin;
    const path = raw.startsWith("/") ? raw : "/" + raw;
    return encodeURI(base + path);
  }

  const displaySrc = result ? makeDisplaySrc(result) : null;

  return (
    <div className="glass upload-section" style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h2>📤 Smart Upload (AI-powered)</h2>
      <p>Upload an item image. AI will extract text, check quality, and auto-fill details.</p>

      <div
        className="upload-flex"
        style={{
          display: "flex",
          gap: 24,
          marginTop: 20,
          flexWrap: "nowrap",
          alignItems: "flex-start",
        }}
      >
        <div
          className="upload-left"
          style={{
            flex: "0 0 320px",
            maxWidth: "40%",
            position: "relative",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {!result && (
            <div className="button-row">
              <button className="action-btn primary" onClick={startCamera} type="button">📷 Open</button>
              <button className="action-btn danger" onClick={stopCamera} type="button">✖ Close</button>
              <button
                className={`action-btn capture ${!frameReady ? "disabled" : ""}`}
                onClick={capturePhoto}
                type="button"
                disabled={!frameReady}
              >
                📸 Capture
              </button>

              <label className="action-btn file" style={{ gap: 6 }}>
                📁 File
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) {
                      setFile(f);
                      setPreview(f.type === "application/pdf" ? "/pdf-preview.png" : URL.createObjectURL(f));
                      setResult(null);
                      try {
                        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
                      } catch {}
                      streamRef.current = null;
                      setCameraOn(false);
                      setFrameReady(false);
                    }
                  }}
                />
              </label>
            </div>
          )}

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 8, background: "#fff" }}>
            {result ? (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    height: 360,
                    borderRadius: 8,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f8fafc",
                    border: "1px solid rgba(0,0,0,0.03)",
                  }}
                >
                  {displaySrc && !imageLoadError ? (
                    <img
                      src={displaySrc}
                      alt="uploaded"
                      style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                      onError={() => {
                        console.error("Failed loading uploaded image:", result?.imageUrl, "resolved ->", displaySrc);
                        setImageLoadError(true);
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", color: "#64748b", padding: 24 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Image unavailable</div>
                      <div style={{ fontSize: 13 }}>The uploaded image could not be loaded by the browser.</div>
                      {result?.imageUrl && (
                        <div style={{ marginTop: 8 }}>
                          <a
                            href={
                              result.imageUrl.startsWith("http")
                                ? result.imageUrl
                                : (API_BASE ? API_BASE.replace(/\/$/, "") : window.location.origin) +
                                  (result.imageUrl.startsWith("/") ? result.imageUrl : "/" + result.imageUrl)
                            }
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#2563eb" }}
                          >
                            Open image in new tab
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <span
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    padding: "6px 10px",
                    background: "#10b981",
                    color: "#fff",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  ✅ Uploaded
                </span>
              </div>
            ) : preview ? (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    height: 360,
                    borderRadius: 8,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f8fafc",
                  }}
                >
                  <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                </div>

                <button
                  onClick={handleRemoveAndReopen}
                  type="button"
                  className="action-btn danger small-absolute"
                >
                  ✖ Remove
                </button>

                <div style={{ marginTop: 12 }}>
                  <form onSubmit={handleUpload}>
                    <button className="action-btn upload" disabled={uploading || !file} style={{ width: "100%" }}>
                      {uploading ? "Uploading…" : "Upload & Analyze"}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div>
                <video ref={videoRef} style={{ width: "100%", height: 360, objectFit: "cover", borderRadius: 8, background: "#000" }} playsInline muted />
                <div style={{ marginTop: 8, fontSize: 13, color: "#444" }}>
                  <strong>Status:</strong> {cameraOn ? (frameReady ? "Ready" : "Camera on — waiting for frame") : "Camera stopped"}{" "}
                  <span style={{ marginLeft: 12 }}>{videoSize.w > 0 ? `${videoSize.w}×${videoSize.h}` : null}</span>
                </div>
                {error && <div style={{ color: "red", marginTop: 6 }}>{error}</div>}
              </div>
            )}
          </div>
        </div>

        {result && (
          <div
            className="upload-right"
            style={{
              flex: "1 1 420px",
              padding: 16,
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3 style={{ marginTop: 0 }}>🧠 AI Details</h3>
              <p><strong>Quality:</strong> {result.quality || "—"}</p>
              <p><strong>Title:</strong> {result.title}</p>
              <p><strong>Category:</strong> {result.category}</p>
              <p style={{ marginBottom: 6 }}><strong>Description:</strong> {result.description}</p>
              <p><strong>Saved ID:</strong> {result.id}</p>
              <p><strong>File:</strong> {result.imageUrl}</p>
            </div>

            <button className="action-btn neutral" style={{ marginTop: 16 }} onClick={handleUploadMore}>
              Upload More Items
            </button>
          </div>
        )}
      </div>

      {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}