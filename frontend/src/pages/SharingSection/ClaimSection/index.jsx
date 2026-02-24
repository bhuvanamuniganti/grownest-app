import { useEffect, useState } from "react";
import { API_BASE } from "../../../api";
import axios from "axios";
import { toast } from "react-toastify";
import "./index.css";

const PLACEHOLDER_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="100%" height="100%" fill="#f8fafc"/><g fill="#cbd5e1" font-family="Arial,Helvetica,sans-serif" font-size="18"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">No image</text></g></svg>`
  );

// ✅ Mobile safe auth headers
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------- Thank-you modal (minimal, self-contained) ----------
function ThankYouModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="thankyou-modal-overlay" role="dialog" aria-modal="true">
      <div className="thankyou-modal">
        <div className="thankyou-header">
          <h3>✅ Thank you for choosing us!</h3>
          <button className="btn-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="thankyou-body">
          <p>
            We’ve received your order. It will be shipped to your address soon.
            You’ll get an update once it’s on the way!
          </p>
        </div>
        <div className="thankyou-actions">
          <button className="btn primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReceiveSection({ setMe }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqCategory, setReqCategory] = useState("");

  const [thankOpen, setThankOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/receive`, {
          withCredentials: true,
          headers: getAuthHeaders(), // ✅ added
        });
        setItems(res.data || []);
      } catch (err) {
        console.error("Failed to fetch receive items", err);
        toast.error("Could not load items");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ✅ Safe image src
  /*const buildImageSrc = (u) => {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;   // ✅ Cloudinary URL 그대로 사용
    return `${API_BASE}${u}`;                // ✅ relative path only
  };*/



  const buildImageSrc = (u) => {
  if (!u) return PLACEHOLDER_SVG;

  // ✅ Cloudinary URL
  if (/^https?:\/\//i.test(u)) return u;

  // ✅ Old DB images stored as filename only → serve from /uploads/
  const fixedPath = u.startsWith("/uploads/") ? u : `/uploads/${u}`;
  return `${API_BASE}${fixedPath}`;
};



  async function handleClaim(item) {
    try {
      const { data } = await axios.post(
        `${API_BASE}/api/receive/claim/${item.id}`,
        {},
        {
          withCredentials: true,
          headers: getAuthHeaders(), // ✅ added
        }
      );

      setItems((prev) => prev.filter((x) => x.id !== item.id));
      if (setMe) setMe((p) => ({ ...p, points: (p.points || 0) - 10 }));

      toast.success(
        data?.message || "Thank you for choosing us! We’ve received your order."
      );

      setThankOpen(true);
    } catch (err) {
      console.error("Claim failed", err);
      toast.error("⚠️ Could not claim item");
    }
  }

  async function handleRequest(e) {
    e?.preventDefault();
    if (!reqTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }
    try {
      await axios.post(
        `${API_BASE}/api/request`,
        {
          title: reqTitle.trim(),
          description: reqDesc.trim(),
          category: reqCategory.trim(),
        },
        {
          withCredentials: true,
          headers: getAuthHeaders(), // ✅ added
        }
      );
      toast.success("✅ Request submitted!");
      setReqTitle("");
      setReqDesc("");
      setReqCategory("");
    } catch (err) {
      console.error("Request submit failed", err);
      toast.error("Could not submit request");
    }
  }

  if (loading) return <p>Loading…</p>;

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.title || "").toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q) ||
      (item.category || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="receive-container">
      <h2>📥 Receive Items</h2>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn clear" onClick={() => setSearch("")}>
          Clear
        </button>
      </div>

      <div className="cards-grid">
        {filtered.map((item) => {
          const mine = !!item.isMine;
          return (
            <div key={item.id} className="card glass horizontal-card">
              <div className="card-media-small">
                <img
                  src={buildImageSrc(item.imageUrl)}
                  alt={item.title || "Uploaded item"}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = PLACEHOLDER_SVG;
                  }}
                />
              </div>

              <div className="card-text">
                <h3>{item.title || "Untitled"}</h3>
                <p className="desc">{item.description}</p>
                <p>
                  <strong>Category:</strong> {item.category}
                </p>
                <p>
                  <strong>Quality:</strong> {item.quality || "Good"}
                </p>

                <span className="badge">
                  {mine ? "Your upload" : `By ${item.uploader_name}`}
                </span>

                <div className="actions">
                  {!mine ? (
                    <button
                      className="btn primary"
                      onClick={() => handleClaim(item)}
                    >
                      Claim
                    </button>
                  ) : (
                    <button className="btn ghost" disabled>
                      Your upload
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <p>No items match your search.</p>}
      </div>

      <div className="request-form glass">
        <h3>🙋 Didn’t find what you need? Request an item</h3>
        <form onSubmit={handleRequest}>
          <input
            type="text"
            placeholder="Item title"
            value={reqTitle}
            onChange={(e) => setReqTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Description"
            value={reqDesc}
            onChange={(e) => setReqDesc(e.target.value)}
            rows={3}
          />
          <input
            type="text"
            placeholder="Category"
            value={reqCategory}
            onChange={(e) => setReqCategory(e.target.value)}
          />
          <div className="form-actions">
            <button
              className="btn primary"
              type="submit"
              style={{ marginRight: "3px" }}
            >
              Submit Request
            </button>
            <button
              className="btn clear"
              type="button"
              onClick={() => {
                setReqTitle("");
                setReqDesc("");
                setReqCategory("");
              }}
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      <ThankYouModal open={thankOpen} onClose={() => setThankOpen(false)} />
    </div>
  );
}