import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  FileText,
  Database,
  Clock,
} from "lucide-react";

const STORAGE_KEY = "tiktok-vault-accounts";
const CATEGORY_STORAGE_KEY = "tiktok-vault-categories";
const FILTER_ORDER_KEY = "tiktok-vault-filter-order";
const DEFAULT_CATEGORIES = ["Pribadi", "Jualan", "Backup", "Lainnya"];
const PHOTO_RATIO = "774 / 480";
const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const CATEGORY_PALETTE = [
  "text-cyan-300 border-cyan-400/40 bg-cyan-400/10",
  "text-pink-300 border-pink-500/40 bg-pink-500/10",
  "text-amber-300 border-amber-400/40 bg-amber-400/10",
  "text-violet-300 border-violet-400/40 bg-violet-400/10",
  "text-emerald-300 border-emerald-400/40 bg-emerald-400/10",
  "text-orange-300 border-orange-400/40 bg-orange-400/10",
  "text-sky-300 border-sky-400/40 bg-sky-400/10",
  "text-rose-300 border-rose-400/40 bg-rose-400/10",
];

// Badge di atas foto: latar hitam (kayak tombol edit/hapus), pinggiran garis tipis senada kategori
const CATEGORY_BORDER_PALETTE = [
  "border-cyan-400/70",
  "border-pink-400/70",
  "border-amber-400/70",
  "border-violet-400/70",
  "border-emerald-400/70",
  "border-orange-400/70",
  "border-sky-400/70",
  "border-rose-400/70",
];

function getCategoryColor(name, categories) {
  const idx = categories.indexOf(name);
  if (idx === -1) return "text-zinc-300 border-zinc-500/40 bg-zinc-500/10";
  return CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length];
}

function getCategoryBorderColor(name, categories) {
  const idx = categories.indexOf(name);
  if (idx === -1) return "border-zinc-500/60";
  return CATEGORY_BORDER_PALETTE[idx % CATEGORY_BORDER_PALETTE.length];
}

function reconcileOrder(order, categories) {
  const validSet = new Set(["Semua", ...categories]);
  let next = (order || []).filter((c) => validSet.has(c));
  if (!next.includes("Semua")) next.unshift("Semua");
  categories.forEach((c) => {
    if (!next.includes(c)) next.push(c);
  });
  return next;
}

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

function formatUpdatedAt(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  const day = DAY_NAMES_ID[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);

  let relative;
  if (diffDays <= 0) relative = "hari ini";
  else if (diffDays === 1) relative = "kemarin";
  else relative = `${diffDays} hari lalu`;

  return `${day} ${hh}.${mm} - ${relative}`;
}

function compressImage(file, maxSize = 640, quality = 0.72) {
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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes / 1024 < 10 ? 1 : 0)}kb`;
  return `${(bytes / 1024 / 1024).toFixed(1)}mb`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Generator PDF murni JS, tanpa library eksternal ---------- */

function escapePdfText(str) {
  let safe = "";
  for (const ch of String(str ?? "")) {
    const code = ch.codePointAt(0);
    safe += code >= 32 && code <= 126 ? ch : "?";
  }
  return safe.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function accountToPdfLines(a, idx) {
  const lines = [];
  lines.push(`${idx + 1}. @${a.username}  [${a.category}]`);
  lines.push(`   Email/No HP : ${a.contact || "-"}`);
  lines.push(`   Password    : ${a.password || "-"}`);
  lines.push(`   Diperbarui  : ${formatUpdatedAt(a.updatedAt || a.createdAt)}`);
  lines.push("");
  return lines;
}

function buildPdfPages(accounts) {
  const header = [
    "AKUN TIKTOK VAULT",
    `Diekspor: ${new Date().toLocaleString("id-ID")}`,
    `Total akun: ${accounts.length}`,
    "",
  ];
  let allLines = [...header];
  if (accounts.length === 0) {
    allLines.push("Belum ada akun tersimpan.");
  } else {
    accounts.forEach((a, i) => {
      allLines = allLines.concat(accountToPdfLines(a, i));
    });
  }

  const LINES_PER_PAGE = 50;
  const pages = [];
  for (let i = 0; i < allLines.length; i += LINES_PER_PAGE) {
    pages.push(allLines.slice(i, i + LINES_PER_PAGE));
  }
  return pages.length ? pages : [[""]];
}

function buildPdfDocument(pagesLines) {
  let pdf = "%PDF-1.4\n";
  const offsets = [];

  function addObj(str) {
    offsets.push(pdf.length);
    pdf += str;
  }

  addObj(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  const kids = pagesLines.map((_, i) => `${4 + i * 2} 0 R`);
  addObj(
    `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pagesLines.length} >>\nendobj\n`
  );

  addObj(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  pagesLines.forEach((lines, i) => {
    const pageObjNum = 4 + i * 2;
    const contentObjNum = 5 + i * 2;

    addObj(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
    );

    let stream = "BT\n/F1 11 Tf\n14 TL\n50 792 Td\n";
    lines.forEach((line, idx) => {
      const escaped = escapePdfText(line);
      stream += idx === 0 ? `(${escaped}) Tj\n` : `T*\n(${escaped}) Tj\n`;
    });
    stream += "ET";

    addObj(
      `${contentObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  });

  const xrefStart = pdf.length;
  const totalObjs = offsets.length;
  let xrefTable = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xrefTable += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += xrefTable;
  pdf += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdf;
}

function generatePdfBlob(accounts) {
  const pages = buildPdfPages(accounts);
  const pdfString = buildPdfDocument(pages);
  return new Blob([pdfString], { type: "application/pdf" });
}

/* ---------------------------------------------------------------------- */

function Toast({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-100 text-zinc-900 text-sm font-medium shadow-lg flex items-center gap-2"
    >
      <Check className="h-4 w-4" />
      {message}
    </motion.div>
  );
}

function InstallBanner({ onInstall, onDismiss, iosHint }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
      animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 230, damping: 26 }}
      className="overflow-hidden"
    >
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-start gap-3">
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
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onInstall}
              className="mt-2 text-xs font-semibold rounded-full bg-zinc-50 text-zinc-900 px-3 py-1.5 hover:bg-white transition-colors"
            >
              Install sekarang
            </motion.button>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onDismiss}
          className="text-zinc-600 hover:text-zinc-300 shrink-0"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}

function BackupSheet({ onClose, onExportJson, onExportPdf, onImportClick, jsonSize, pdfSize }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold tracking-tight text-zinc-50">Backup Data</h2>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Tutup">
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        <div className="space-y-2 pb-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onExportJson}
            className="w-full flex items-center gap-3 rounded-2xl bg-zinc-800 border border-zinc-700 p-3.5 hover:border-cyan-400/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100">Download Data</p>
              <p className="text-xs text-zinc-500">File cadangan (.json), bisa dimasukin lagi nanti</p>
            </div>
            <span className="text-xs text-zinc-500 shrink-0">{jsonSize}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onImportClick}
            className="w-full flex items-center gap-3 rounded-2xl bg-zinc-800 border border-zinc-700 p-3.5 hover:border-cyan-400/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100">Masukan Data</p>
              <p className="text-xs text-zinc-500">Pulihkan dari file .json yang pernah kamu download</p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onExportPdf}
            className="w-full flex items-center gap-3 rounded-2xl bg-zinc-800 border border-zinc-700 p-3.5 hover:border-pink-400/50 transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-pink-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100">Download PDF</p>
              <p className="text-xs text-zinc-500">Bisa dibuka & dibaca di WPS / Word</p>
            </div>
            <span className="text-xs text-zinc-500 shrink-0">{pdfSize}</span>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CopyField({ icon: Icon, value, mask, onCopy, placeholder }) {
  const [revealed, setRevealed] = useState(!mask);
  return (
    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Icon className="h-3 w-3 shrink-0 text-zinc-600" />
      <span className="flex-1 truncate font-mono text-zinc-300">
        {value ? (mask && !revealed ? "•".repeat(Math.min(value.length, 12)) : value) : placeholder}
      </span>
      {value && mask && (
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => setRevealed((r) => !r)}
          className="text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
          aria-label={revealed ? "Sembunyikan" : "Tampilkan"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={revealed ? "on" : "off"}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              className="flex"
            >
              {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      )}
      {value && (
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => onCopy(value)}
          className="text-zinc-500 hover:text-cyan-300 transition-colors shrink-0"
          aria-label="Salin"
        >
          <Copy className="h-3 w-3" />
        </motion.button>
      )}
    </div>
  );
}

function AccountCard({ account, categories, onEdit, onDelete, onCopy }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden"
    >
      {/* Foto: landscape, lebar penuh kartu */}
      <div className="relative w-full bg-zinc-800" style={{ aspectRatio: PHOTO_RATIO }}>
        {account.photo ? (
          <img src={account.photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="h-8 w-8 text-zinc-600" />
          </div>
        )}

        {/* Baris atas: badge kategori kiri, edit/hapus kanan */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-1">
          <span
            className={`text-[9px] uppercase tracking-wide font-bold px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm border-2 shadow-sm text-white ${getCategoryBorderColor(account.category, categories)}`}
          >
            {account.category}
          </span>
          <div className="flex gap-1 shrink-0">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => onEdit(account)}
              className="p-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white hover:text-cyan-300 transition-colors"
              aria-label="Edit akun"
            >
              <Pencil className="h-3 w-3" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => onDelete(account.id)}
              className="p-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white hover:text-pink-400 transition-colors"
              aria-label="Hapus akun"
            >
              <Trash2 className="h-3 w-3" />
            </motion.button>
          </div>
        </div>
      </div>

      <div className="p-3">
        <p className="text-sm font-semibold text-zinc-50 truncate">@{account.username}</p>

        <div className="mt-2.5 space-y-1.5">
          <CopyField icon={AtSign} value={account.contact} mask onCopy={onCopy} placeholder="Belum ada email/nomor" />
          <CopyField icon={Lock} value={account.password} mask onCopy={onCopy} placeholder="Belum ada password" />
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-zinc-800 flex items-center gap-1.5 text-[10.5px] text-zinc-300">
          <Clock className="h-3 w-3 shrink-0 text-cyan-400" />
          <span>{formatUpdatedAt(account.updatedAt || account.createdAt)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function AccountModal({ initial, categories, onClose, onSave, onAddCategory, onDeleteCategory }) {
  const [username, setUsername] = useState(initial?.username || "");
  const [contact, setContact] = useState(initial?.contact || "");
  const [password, setPassword] = useState(initial?.password || "");
  const [category, setCategory] = useState(initial?.category || categories[0]);
  const [photo, setPhoto] = useState(initial?.photo || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [updateTimestamp, setUpdateTimestamp] = useState(true);
  const fileRef = useRef(null);
  const newCategoryRef = useRef(null);

  useEffect(() => {
    if (addingCategory) newCategoryRef.current?.focus();
  }, [addingCategory]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const confirmNewCategory = () => {
    const name = newCategory.trim();
    if (!name) {
      setAddingCategory(false);
      return;
    }
    onAddCategory(name);
    setCategory(name);
    setNewCategory("");
    setAddingCategory(false);
  };

  const handleSubmit = () => {
    if (!username.trim()) {
      setError("Username wajib diisi.");
      return;
    }
    const now = Date.now();
    const updatedAt = initial && !updateTimestamp ? initial.updatedAt || initial.createdAt : now;
    onSave({
      id: initial?.id || uid(),
      username: username.trim().replace(/^@/, ""),
      contact: contact.trim(),
      password,
      category,
      photo,
      createdAt: initial?.createdAt || now,
      updatedAt,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: "100%", opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 230, damping: 26 }}
        className="w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold tracking-tight text-zinc-50">
            {initial ? "Edit Akun" : "Tambah Akun"}
          </h2>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Tutup">
            <X className="h-5 w-5" />
          </motion.button>
        </div>

        {/* Foto: landscape, lebar penuh */}
        <div className="mb-5">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => fileRef.current?.click()}
            className="relative w-full block rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700"
            style={{ aspectRatio: PHOTO_RATIO }}
            aria-label="Unggah foto"
          >
            {photo ? (
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-zinc-500">
                <Upload className="h-6 w-6" />
                <span className="text-xs">Unggah foto</span>
              </div>
            )}
            <span className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center">
              <Upload className="h-4 w-4" />
            </span>
          </motion.button>
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
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Email / Nomor HP</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="email@contoh.com atau 08xxxxxxxxxx"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password akun"
              className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-zinc-50 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/60 transition-colors"
            />
          </div>

          <div className="mt-2 pt-5 border-t border-zinc-800">
            <label className="text-xs text-zinc-500 mb-1 block">Kategori</label>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {categories.map((c) => (
                  <motion.div
                    key={c}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    className={`flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1 text-xs ${
                      category === c ? getCategoryColor(c, categories) : "text-zinc-500 border-zinc-700"
                    }`}
                  >
                    <button onClick={() => setCategory(c)}>{c}</button>
                    {categories.length > 1 && (
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        onClick={() => onDeleteCategory(c)}
                        className="p-0.5 rounded-full hover:bg-black/30 opacity-70 hover:opacity-100 transition-opacity"
                        aria-label={`Hapus kategori ${c}`}
                      >
                        <X className="h-3 w-3" />
                      </motion.button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {addingCategory ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1"
                >
                  <input
                    ref={newCategoryRef}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmNewCategory()}
                    placeholder="Nama kategori"
                    className="w-28 rounded-full bg-zinc-800 border border-cyan-400/50 px-3 py-1.5 text-xs text-zinc-50 placeholder-zinc-600 focus:outline-none"
                  />
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={confirmNewCategory}
                    className="p-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-cyan-300"
                    aria-label="Simpan kategori"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setAddingCategory(true)}
                  className="px-3 py-1.5 rounded-full text-xs border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Tambah
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-pink-400 text-sm mt-3">
            {error}
          </motion.p>
        )}

        <div className="mt-5 flex gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            style={{ flex: initial ? "3 3 0%" : "1 1 100%" }}
            className="rounded-xl bg-zinc-50 text-zinc-900 font-bold py-3 hover:bg-white transition-colors"
          >
            Simpan Akun
          </motion.button>

          {initial && (
            <button
              type="button"
              onClick={() => setUpdateTimestamp((v) => !v)}
              style={{ flex: "1 1 0%" }}
              className={`rounded-xl border flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
                updateTimestamp ? "bg-cyan-500/10 border-cyan-400/50" : "bg-zinc-800 border-zinc-700"
              }`}
              aria-label="Update waktu diperbarui"
            >
              <span className="text-[8px] uppercase tracking-wide text-zinc-400">Waktu</span>
              <div
                className={`h-5 w-9 rounded-full flex items-center px-0.5 transition-colors ${
                  updateTimestamp ? "bg-cyan-400 justify-end" : "bg-zinc-600 justify-start"
                }`}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  className="h-4 w-4 rounded-full bg-white block shadow"
                />
              </div>
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- Filter chips: bisa di-reorder dengan tekan-lama lalu geser ---------- */

function FilterChips({ order, categories, activeCategory, onSelect, onReorder }) {
  const [localOrder, setLocalOrder] = useState(order);
  const [draggingId, setDraggingId] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const chipRefs = useRef({});
  const orderRef = useRef(order);
  const dragStartRect = useRef(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef(null);
  const movedRef = useRef(false);

  useEffect(() => {
    setLocalOrder(order);
    orderRef.current = order;
  }, [order]);

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startDrag = (name) => {
    const el = chipRefs.current[name];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragStartRect.current = rect;
    setDragPos({ x: rect.left, y: rect.top });
    setDraggingId(name);
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const handlePointerDown = (e, name) => {
    movedRef.current = false;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    longPressTimer.current = setTimeout(() => startDrag(name), 550);
  };

  // Batalin long-press kalau jari gerak duluan sebelum waktunya (dianggap bukan niat geser)
  const handleContainerPointerMove = (e) => {
    if (longPressTimer.current) {
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      if (dx > 10 || dy > 10) clearTimer();
    }
  };

  // Selama drag aktif, pasang listener di window langsung -> gerakan & pelepasan jari selalu ke-tangkep,
  // gak peduli jari keluar dari area chip, dan cuma ke-proses SEKALI (gak dobel kayak sebelumnya).
  useEffect(() => {
    if (!draggingId) return;

    const handleMove = (e) => {
      movedRef.current = true;
      const dx = e.clientX - pointerStart.current.x;
      const dy = e.clientY - pointerStart.current.y;
      setDragPos({ x: dragStartRect.current.left + dx, y: dragStartRect.current.top + dy });

      const current = orderRef.current;
      const draggedIdx = current.indexOf(draggingId);
      for (const name of current) {
        if (name === draggingId) continue;
        const el = chipRefs.current[name];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const targetIdx = current.indexOf(name);
          if (targetIdx !== -1 && targetIdx !== draggedIdx) {
            const next = [...current];
            next.splice(draggedIdx, 1);
            next.splice(targetIdx, 0, draggingId);
            orderRef.current = next;
            setLocalOrder(next);
          }
          break;
        }
      }
    };

    const handleUp = () => {
      onReorder(orderRef.current);
      setDraggingId(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [draggingId, onReorder]);

  const handleChipPointerUp = (name) => {
    clearTimer();
    if (!draggingId && !movedRef.current) {
      onSelect(name);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-5 relative" onPointerMove={handleContainerPointerMove}>
      <AnimatePresence initial={false}>
        {localOrder.map((name) => {
          const isSemua = name === "Semua";
          const active = activeCategory === name;
          const isDragging = draggingId === name;
          const colorClass = active
            ? isSemua
              ? "bg-zinc-100 text-zinc-900 border-zinc-100"
              : getCategoryColor(name, categories)
            : "text-zinc-500 border-zinc-800 hover:border-zinc-700";
          return (
            <motion.button
              key={name}
              layout={!isDragging}
              ref={(el) => {
                chipRefs.current[name] = el;
              }}
              onPointerDown={(e) => handlePointerDown(e, name)}
              onPointerUp={() => handleChipPointerUp(name)}
              initial={false}
              animate={{ opacity: isDragging ? 0.3 : 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              whileTap={{ scale: 0.94 }}
              style={{ touchAction: "none" }}
              className={`select-none shrink-0 px-3 py-1.5 rounded-full text-xs border transition-colors ${colorClass}`}
            >
              {name}
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Klon melayang: posisinya ngikutin jari 1:1 selama digeser */}
      {draggingId && dragStartRect.current && (
        <div
          style={{
            position: "fixed",
            left: dragPos.x,
            top: dragPos.y,
            width: dragStartRect.current.width,
            height: dragStartRect.current.height,
            zIndex: 100,
            pointerEvents: "none",
          }}
          className={`flex items-center justify-center rounded-full text-xs font-medium shadow-2xl scale-110 text-zinc-50 bg-zinc-800 border-2 ${
            draggingId === "Semua" ? "border-zinc-100" : getCategoryBorderColor(draggingId, categories)
          }`}
        >
          {draggingId}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [filterOrder, setFilterOrder] = useState(["Semua", ...DEFAULT_CATEGORIES]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const importInputRef = useRef(null);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    let acc = [];
    let cats = DEFAULT_CATEGORIES;
    let order = ["Semua", ...DEFAULT_CATEGORIES];

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      acc = raw ? JSON.parse(raw) : [];
    } catch {
      acc = [];
    }
    try {
      const rawCat = localStorage.getItem(CATEGORY_STORAGE_KEY);
      const parsed = rawCat ? JSON.parse(rawCat) : DEFAULT_CATEGORIES;
      cats = parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
    } catch {
      cats = DEFAULT_CATEGORIES;
    }
    try {
      const rawOrder = localStorage.getItem(FILTER_ORDER_KEY);
      order = rawOrder ? JSON.parse(rawOrder) : ["Semua", ...cats];
    } catch {
      order = ["Semua", ...cats];
    }

    const reconciled = reconcileOrder(order, cats);

    setAccounts(acc);
    setCategories(cats);
    setFilterOrder(reconciled);
    setActiveCategory(reconciled[0] || "Semua");
    try {
      localStorage.setItem(FILTER_ORDER_KEY, JSON.stringify(reconciled));
    } catch {
      // abaikan
    }

    setLoading(false);
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

  const persistCategories = useCallback((next) => {
    setCategories(next);
    try {
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // abaikan, kategori tetap jalan untuk sesi ini
    }
  }, []);

  const handleReorderFilters = (newOrder) => {
    setFilterOrder(newOrder);
    try {
      localStorage.setItem(FILTER_ORDER_KEY, JSON.stringify(newOrder));
    } catch {
      // abaikan
    }
  };

  const handleAddCategory = (name) => {
    const exists = categories.some((c) => c.toLowerCase() === name.toLowerCase());
    if (exists) return;
    const nextCategories = [...categories, name];
    persistCategories(nextCategories);
    handleReorderFilters(reconcileOrder(filterOrder, nextCategories));
    showToast("Kategori ditambahkan");
  };

  const handleDeleteCategory = (name) => {
    if (categories.length <= 1) return;
    const nextCategories = categories.filter((c) => c !== name);
    persistCategories(nextCategories);
    handleReorderFilters(reconcileOrder(filterOrder, nextCategories));
    if (activeCategory === name) setActiveCategory("Semua");
    showToast("Kategori dihapus");
  };

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

  /* ---------- Backup: export JSON, export PDF, import JSON ---------- */
  /* Sengaja cuma dihitung pas backupOpen true, biar nambah/edit akun gak jadi berat */

  const exportPayload = useMemo(
    () =>
      backupOpen
        ? JSON.stringify({ accounts, categories, filterOrder, exportedAt: Date.now(), version: 2 }, null, 2)
        : "",
    [backupOpen, accounts, categories, filterOrder]
  );
  const jsonSizeLabel = useMemo(
    () => (backupOpen ? formatBytes(new Blob([exportPayload]).size) : ""),
    [backupOpen, exportPayload]
  );
  const pdfBlob = useMemo(() => (backupOpen ? generatePdfBlob(accounts) : null), [backupOpen, accounts]);
  const pdfSizeLabel = useMemo(() => (pdfBlob ? formatBytes(pdfBlob.size) : ""), [pdfBlob]);

  const dateStr = () => new Date().toISOString().slice(0, 10);

  const handleExportJson = () => {
    const blob = new Blob([exportPayload], { type: "application/json" });
    downloadBlob(blob, `tiktok-vault-backup-${dateStr()}.json`);
    showToast("Data diunduh");
  };

  const handleExportPdf = () => {
    if (!pdfBlob) return;
    downloadBlob(pdfBlob, `tiktok-vault-${dateStr()}.pdf`);
    showToast("PDF diunduh");
  };

  const handleImportClick = () => {
    if (accounts.length > 0) {
      showToast("Gagal, data akun sudah ada");
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (accounts.length > 0) {
      showToast("Gagal, data akun sudah ada");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedAccounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];
        const importedCategories =
          Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories
            : DEFAULT_CATEGORIES;
        const importedOrder = Array.isArray(parsed.filterOrder)
          ? reconcileOrder(parsed.filterOrder, importedCategories)
          : reconcileOrder(["Semua", ...importedCategories], importedCategories);

        persist(importedAccounts);
        persistCategories(importedCategories);
        handleReorderFilters(importedOrder);
        setActiveCategory(importedOrder[0] || "Semua");
        showToast("Data berhasil dimuat");
        setBackupOpen(false);
      } catch {
        showToast("File tidak valid");
      }
    };
    reader.onerror = () => showToast("Gagal membaca file");
    reader.readAsText(file);
    e.target.value = "";
  };

  /* -------------------------------------------------------------------- */

  const filtered = accounts.filter((a) => {
    const matchesQuery = a.username.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === "Semua" || a.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  const activeCategoryCount =
    activeCategory !== "Semua" ? accounts.filter((a) => a.category === activeCategory).length : null;

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
          <p className="text-sm text-zinc-500 mt-1">
            {accounts.length} akun tersimpan
            <AnimatePresence>
              {activeCategoryCount !== null && (
                <motion.span
                  key={activeCategory}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.18 }}
                  className="inline-block"
                >
                  , {activeCategoryCount} akun
                </motion.span>
              )}
            </AnimatePresence>
          </p>
        </header>

        <AnimatePresence>
          {showInstallBanner && (
            <InstallBanner onInstall={handleInstallClick} onDismiss={dismissBanner} iosHint={isIOS()} />
          )}
        </AnimatePresence>

        {/* Pencarian 90% + tombol backup 10% */}
        <div className="flex gap-2 mb-3">
          <div className="relative" style={{ flex: "9 9 0%" }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari username..."
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/50 transition-colors"
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setBackupOpen(true)}
            style={{ flex: "1 1 0%" }}
            className="rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-cyan-300 hover:border-cyan-400/50 transition-colors"
            aria-label="Backup data"
          >
            <Database className="h-4 w-4" />
          </motion.button>
        </div>

        <FilterChips
          order={filterOrder}
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
          onReorder={handleReorderFilters}
        />

        {loading ? (
          <p className="text-zinc-600 text-sm text-center py-16">Memuat data...</p>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-zinc-500 text-sm">
              {accounts.length === 0 ? "Belum ada akun. Tambahkan akun TikTok pertamamu." : "Tidak ada akun yang cocok."}
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  categories={categories}
                  onEdit={(a) => {
                    setEditing(a);
                    setModalOpen(true);
                  }}
                  onDelete={(id) => setConfirmDelete(id)}
                  onCopy={handleCopy}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-zinc-50 text-zinc-900 flex items-center justify-center shadow-xl hover:bg-white transition-colors"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
        aria-label="Tambah akun"
      >
        <Plus className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {modalOpen && (
          <AccountModal
            initial={editing}
            categories={categories}
            onClose={() => {
              setModalOpen(false);
              setEditing(null);
            }}
            onSave={handleSave}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {backupOpen && (
          <BackupSheet
            onClose={() => setBackupOpen(false)}
            onExportJson={handleExportJson}
            onExportPdf={handleExportPdf}
            onImportClick={handleImportClick}
            jsonSize={jsonSizeLabel}
            pdfSize={pdfSizeLabel}
          />
        )}
      </AnimatePresence>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-center"
            >
              <p className="text-zinc-100 font-medium mb-1">Hapus akun ini?</p>
              <p className="text-zinc-500 text-sm mb-4">Data yang dihapus tidak bisa dikembalikan.</p>
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Batal
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 rounded-xl bg-pink-500 py-2.5 text-sm font-semibold text-white hover:bg-pink-600"
                >
                  Hapus
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{toast && <Toast message={toast} />}</AnimatePresence>
    </div>
  );
}
