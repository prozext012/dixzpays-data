import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Pencil,
  X,
  Upload,
  User,
  Check,
  Lock,
  AtSign,
  Download,
  Share,
} from "lucide-react";

const STORAGE_KEY = "tiktok-vault-accounts";
const CATEGORIES = ["Pribadi", "Jualan", "Backup", "Lainnya"];
const CATEGORY_COLOR = {
  Pribadi: "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",
  Jualan: "text-pink-300 border-pink-500/40 bg-pink-500/10",
  Backup: "text-amber-300 border-amber-400/40 bg-amber-400/10",
  Lainnya: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10",
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function compressImage(file, maxSize = 360, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gagal memuat gambar"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function Avatar({ photo, size = "h-14 w-14" }) {
  return (
    <div className={`relative ${size} shrink-0`}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow:
            "2px 0 0 0 rgba(37,244,238,0.55), -2px 0 0 0 rgba(254,44,85,0.55)",
        }}
      />
      <div className="relative h-full w-full rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center border border-zinc-700">
        {photo ? (
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-6 w-6 text-zinc-500" />
        )}
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-100 text-zinc-900 text-sm font-medium shadow-lg flex items-center gap-2">
      <Check className="h-4 w-4" />
      {message}
    </div>
  );
}

function InstallBanner({ onInstall, onDismiss, iosHint }) {
  return (
    <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-start gap-3">
      <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
        <Download className="h-5 w-5 text-cyan-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-100">Pasang sebagai aplikasi</p>
        {iosHint ? (
          <p className="text-xs text-zinc-500 mt-0.5">
            Tap tombol <Share className="inline h-3 w-3 mx-0.5" /> Share di Safari, lalu pilih
            "Add to Home Screen".
          </p>
        ) : (
          <p className="text-xs text-zinc-500 mt-0.5">
            Biar bisa dibuka kayak aplikasi biasa, tanpa address bar.
          </p>
        )}
        {!iosHint && (
          <button
            onClick={onInstall}
            className="mt-2 text-xs font-semibold rounded-full bg-zinc-50 text-zinc-900 px-3 py-1.5 hover:bg-white transition-colors"
          >
            Install sekarang
          </button>
        )}
      </div>
      <button onClick={onDismiss} className="text-zinc-600 hover:text-zinc-300 shrink-0" aria-label="Tutup">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function CopyField({ icon: Icon, value, mask, onCopy, placeholder }) {
  const [revealed, setRevealed] = useState(!mask);
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
      <span className="flex-1 truncate font-mono text-zinc-300">
        {value ? (mask && !revealed ? "•".repeat(Math.min(value.length, 14)) : value) : placeholder}
      </span>
      {value && mask && (
        <button
          onClick={() => setRevealed((r) => !r)}
          className="text-zinc-500 hover:text-zinc-200 transition-colors"
          aria-label={revealed ? "Sembunyikan" : "Tampilkan"}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      {value && (
        <button
          onClick={() => onCopy(value)}
          className="text-zinc-500 hover:text-cyan-300 transition-colors"
          aria-label="Salin"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function AccountCard({ account, onEdit, onDelete, onCopy }) {
  return (
    <div className="group relative rounded-2xl bg-zinc-900 border border-zinc-800 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex gap-3">
        <Avatar photo={account.photo} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-zinc-50 truncate">@{account.username}</p>
            <span
              className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[account.category] || CATEGORY_COLOR.Lainnya}`}
            >
              {account.category}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            <CopyField icon={AtSign} value={account.contact} onCopy={onCopy} placeholder="Belum ada email/nomor" />
            <CopyField icon={Lock} value={account.password} mask onCopy={onCopy} placeholder="Belum ada password" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(account)}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-cyan-300 hover:bg-zinc-800 transition-colors"
          aria-label="Edit akun"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={() => onDelete(account.id)}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-pink-400 hover:bg-zinc-800 transition-colors"
          aria-label="Hapus akun"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AccountModal({ initial, onClose, onSave }) {
  const [username, setUsername] = useState(initial?.username || "");
  const [contact, setContact] = useState(initial?.contact || "");
  const [password, setPassword] = useState(initial?.password || "");
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [photo, setPhoto] = useState(initial?.photo || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
    } catch {
      setError("Gagal memproses foto, coba foto lain.");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = () => {
    if (!username.trim()) {
      setError("Username wajib diisi.");
      return;
    }
    onSave({
      id: initial?.id || uid(),
      username: username.trim().replace(/^@/, ""),
      contact: contact.trim(),
      password,
      category,
      photo,
      createdAt: initial?.createdAt || Date.now(),
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold tracking-tight text-zinc-50">
            {initial ? "Edit Akun" : "Tambah Akun"}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Tutup">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-center mb-5">
          <button onClick={() => fileRef.current?.click()} className="relative" aria-label="Unggah foto">
            <Avatar photo={photo} size="h-20 w-20" />
            <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center">
              <Upload className="h-3 w-3" />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
        {busy && <p className="text-center text-xs text-zinc-500 mb-3">Memproses foto...</p>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username_tiktok"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Email / Nomor HP</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="email@contoh.com atau 08xxxxxxxxxx"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password akun"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Kategori</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    category === c ? CATEGORY_COLOR[c] : "text-zinc-500 border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-pink-400 text-sm mt-3">{error}</p>}

        <button
          onClick={handleSubmit}
          className="mt-5 w-full rounded-xl bg-zinc-50 text-zinc-900 font-bold py-3 hover:bg-white transition-colors"
        >
          Simpan Akun
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setAccounts(raw ? JSON.parse(raw) : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = localStorage.getItem("tiktok-vault-install-dismissed");
    if (dismissed) return;

    if (isIOS()) {
      setShowInstallBanner(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const persist = useCallback((next) => {
    setAccounts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      showToast("Penyimpanan penuh, hapus foto/akun lama.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") showToast("Aplikasi terpasang");
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem("tiktok-vault-install-dismissed", "1");
  };

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast("Disalin ke clipboard");
    } catch {
      showToast("Gagal menyalin");
    }
  };

  const handleSave = (account) => {
    const exists = accounts.some((a) => a.id === account.id);
    const next = exists ? accounts.map((a) => (a.id === account.id ? account : a)) : [account, ...accounts];
    persist(next);
    setModalOpen(false);
    setEditing(null);
    showToast(exists ? "Akun diperbarui" : "Akun ditambahkan");
  };

  const handleDelete = (id) => {
    persist(accounts.filter((a) => a.id !== id));
    setConfirmDelete(null);
    showToast("Akun dihapus");
  };

  const filtered = accounts.filter((a) => {
    const matchesQuery = a.username.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === "Semua" || a.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-md mx-auto px-4 pt-8 pb-24">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-600 mb-1">Vault</p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span style={{ textShadow: "1.5px 0 0 rgba(37,244,238,0.7), -1.5px 0 0 rgba(254,44,85,0.7)" }}>
              Akun TikTok
            </span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{accounts.length} akun tersimpan</p>
        </header>

        {showInstallBanner && (
          <InstallBanner onInstall={handleInstallClick} onDismiss={dismissBanner} iosHint={isIOS()} />
        )}

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari username..."
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/50"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-4 px-4">
          {["Semua", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                activeCategory === c
                  ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                  : "text-zinc-500 border-zinc-800 hover:border-zinc-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-zinc-600 text-sm text-center py-16">Memuat data...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-500 text-sm">
              {accounts.length === 0 ? "Belum ada akun. Tambahkan akun TikTok pertamamu." : "Tidak ada akun yang cocok."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={(a) => {
                  setEditing(a);
                  setModalOpen(true);
                }}
                onDelete={(id) => setConfirmDelete(id)}
                onCopy={handleCopy}
              />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-zinc-50 text-zinc-900 flex items-center justify-center shadow-xl hover:bg-white transition-colors"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
        aria-label="Tambah akun"
      >
        <Plus className="h-6 w-6" />
      </button>

      {modalOpen && (
        <AccountModal
          initial={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center">
            <p className="text-zinc-100 font-medium mb-1">Hapus akun ini?</p>
            <p className="text-zinc-500 text-sm mb-4">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 rounded-xl bg-pink-500 py-2.5 text-sm font-semibold text-white hover:bg-pink-600"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} />
    </div>
  );
}
