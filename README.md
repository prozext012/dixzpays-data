# Akun TikTok Vault (PWA)

App penyimpan data akun TikTok (foto, username, email/nomor, password) — bisa di-install jadi aplikasi di HP.

## Deploy ke Vercel lewat GitHub

1. Push folder ini ke repo GitHub baru:
   ```bash
   cd tiktok-vault-pwa
   git init
   git add .
   git commit -m "init tiktok vault pwa"
   git branch -M main
   git remote add origin <url-repo-github-kamu>
   git push -u origin main
   ```
2. Buka [vercel.com](https://vercel.com) → **Add New Project** → import repo tadi.
3. Vercel otomatis mendeteksi **Vite**. Pastikan settingnya:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy. Setelah selesai, buka URL-nya di HP.

## Cara install di HP

- **Android (Chrome)**: buka situsnya, tunggu 1–2 detik, akan muncul banner "Pasang sebagai aplikasi" di dalam app ini, atau tap menu titik tiga di Chrome → **Install app** / **Add to Home screen**.
- **iOS (Safari)**: iOS **tidak punya** tombol install otomatis seperti Android — ini batasan dari Apple, bukan bug. Tap tombol **Share** (kotak dengan panah ke atas) → **Add to Home Screen**. App ini akan otomatis menampilkan instruksi ini kalau dibuka dari Safari.

## Kenapa sebelumnya gagal (dan sudah diperbaiki di sini)

**1. "Gak ada pilihan install, cuma homescreen doang"**
Ini terjadi kalau salah satu syarat installability Chrome tidak terpenuhi: `manifest.json` tidak ditemukan/tidak lengkap, tidak ada service worker aktif, atau situsnya tidak HTTPS. Vercel otomatis HTTPS, dan project ini sudah menyertakan:
- `public/manifest.json` lengkap (`name`, `icons` 192 & 512px, `start_url`, `display: standalone`)
- `public/sw.js` yang terdaftar di `src/main.jsx`

**2. "Ada pilihan install, tapi ikonnya jadi logo Chrome/screenshot"**
Ini terjadi kalau file ikon yang dirujuk di manifest tidak ketemu (404) atau ukurannya tidak sesuai — Chrome lalu fallback ke screenshot halaman dengan bingkai browser. Di sini ikon sudah digenerate dalam beberapa ukuran (`192`, `512`, versi `maskable`, dan `apple-touch-icon` khusus iOS) dan sudah ditaut di `manifest.json` maupun `index.html`.

## Struktur project

```
public/
  manifest.json       # metadata PWA
  sw.js                # service worker (wajib untuk installability)
  icons/               # logo app di berbagai ukuran
src/
  App.jsx              # UI utama (data disimpan di localStorage HP)
  main.jsx             # entry point + registrasi service worker
```

## Catatan soal data

Data akun tersimpan di `localStorage` **browser/HP tempat kamu install app-nya** — jadi permanen di device itu (gak hilang walau tutup app), tapi kalau ganti HP atau uninstall+clear data, datanya ikut hilang. Kalau nanti kamu butuh data itu bisa diakses dari banyak device sekaligus (misal HP + laptop), kabari aja, itu perlu backend/database tambahan (di luar cakupan localStorage).
