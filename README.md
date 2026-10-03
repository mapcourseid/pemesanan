# GeoKKPR & RTB Pro - Layanan Pemetaan Polygon GIS & Rencana Tapak Bangunan KKPR OSS

Aplikasi fullstack terintegrasi untuk pendaftaran pemetaan polygon GIS, kalkulasi biaya otomatis berbasis matriks 6 faktor penilai OSS ATR/BPN, payment gateway instant, live tracking antrean pengerjaan, workstation tim internal GIS & Drafter, serta serah terima berkas resmi.

---

## 📌 Alur 5 Tahapan Layanan (Sesuai Spesifikasi)

### 1. Tahap Pendaftaran & Input Pemesanan (Order Form)
- **Data Diri & Perusahaan**: Nama Perusahaan, PIC, Nomor WhatsApp aktif (untuk bot notifikasi otomatis), Email, Kode KBLI 5 Digit (e.g. `68111`) dan Keterangan Nama Kegiatan.
- **Luasan yang Diajukan**: Input dinamis dengan konversi otomatis (m² atau Hektar/Ha).
- **Status Penguasaan Lahan**:
  - `Belum Menguasai`
  - `Sudah Menguasai`: Menampilkan pilihan bentuk penguasaan (`SHM`, `SHGB`, `Surat Sewa`, `Lainnya`) dan slot upload berkas legalitas lahan (maks. 2MB).
- **Alamat Lokasi Pengajuan**: Nama Jalan, Provinsi, Kabupaten/Kota, Kecamatan, Kelurahan/Desa, Kode Pos.
- **Spesifikasi Bangunan**: Jumlah bangunan (unit), jumlah lantai, ketinggian bangunan (meter), dan ketersediaan IMB/PBG.
- **Smart Input Lokasi (Interactive Leaflet GIS)**:
  - *Jika Belum Memiliki Polygon*: Input titik koordinat Latitude & Longitude atau klik langsung pada peta interaktif.
  - *Jika Sudah Memiliki*: Upload draf Shapefile bundle (.zip) atau GeoJSON. Sistem langsung mengekstrak dan memvisualisasikan batas polygon di atas peta.
- **Kalkulator Biaya Otomatis**:
  - Luas < 100 m²: Rp 1.500.000
  - Luas 100 - 1.000 m²: Rp 2.000.000
  - Luas 1.000 - 2.000 m²: Rp 2.500.000
  - Luas 2.000 - 3.000 m²: Rp 3.000.000
  - **Luas > 3.000 m² (Mekanisme 6 Faktor Penilai)**:
    1. Ketersediaan RDTR (Bobot: 5% | Tersedia = 1, Tidak = 5)
    2. Lokasi Regional (Bobot: 10% | Reg 1 = 5, Reg 2 = 3, Reg 3 = 1)
    3. Penguasaan Lahan BPN (Bobot: 5% | Tersedia = 1, Tidak = 5)
    4. Ketersediaan Dokumen SHM/SHGB/Sewa (Bobot: 5% | Tersedia = 1, Tidak = 5)
    5. Luasan Area Pengajuan Ha (Bobot: 45% | Nilai 1 s.d. 5)
    6. Jenis Kegiatan KBLI (Bobot: 30% | Rendah = 1, Menengah Rendah = 2, Menengah Tinggi = 4, Tinggi = 5)
    - **Rumus**: `Skor Total = Σ(Nilai × Bobot)`
    - **Harga Final**: `Skor Total × Rp 1.500.000`
    - *Tervalidasi pada Test Case Telaga Sari Land*: Skor **4.80** → **IDR 7.200.000**.

### 2. Tahap Pembayaran & Penerbitan Invoice Instant
- **Payment Gateway Simulation**: QRIS dinamis, Virtual Account (BCA, Mandiri, BRI, BNI), dan E-Wallet (GoPay, OVO, ShopeePay, DANA).
- **Auto-Verification**: Webhook instan mengubah status transaksi menjadi "Dibayar" / "Verifikasi Berkas" tanpa konfirmasi manual.
- **E-Invoice Otomatis**: Diterbitkan seketika lengkap dengan nomor invoice resmi, rincian biaya, validasi stempel digital, tombol cetak/unduh PDF, dan simulasi pengiriman ke WhatsApp customer.

### 3. Tahap Penjadwalan Antrean & Live Tracking
- **Kode Tracking Unik & Nomor Antrean**: Penerbitan otomatis (e.g. `POL-2026-1003-014`, Antrean `#08`).
- **Notifikasi Sambutan WhatsApp**:
  > *"Terima kasih! Pembayaran Anda telah kami terima. Nomor Antrean Pengerjaan Anda: #08. Pantau progres pengerjaan Polygon & RTB Anda secara langsung di sini: https://tracking.domainanda.com/track/POL-2026-1003-014"*
- **Live Tracking Bebas Akses**: Halaman publik tanpa login menampilkan visualisasi 5 tahapan pengerjaan, posisi antrean di depan, dan peta polygon lahan.

### 4. Tahap Pemrosesan Pemetaan & Notifikasi Progres (Dashboard Tim Internal)
- **Workstation GIS & Drafter**:
  - Unduh raw data customer (draf shapefile polygon, sertifikat lahan, spek bangunan).
  - Unggah hasil pengerjaan GIS (.SHP bundle zip, .KML, .GeoJSON, dan .PDF Dokumen RTB).
  - **Pembaruan Status Real-Time**: Update 1-klik yang seketika ter-broadcast ke live tracking customer via Server-Sent Events (SSE).
  - **WhatsApp Alert Klarifikasi Batas Tanah**: Pengiriman pesan klarifikasi jika batas tanah tumpang tindih atau butuh konfirmasi patok.

### 5. Tahap Serah Terima Dokumen Polygon, RTB, & Feedback
- **Notifikasi Penyelesaian WhatsApp**: Notifikasi otomatis saat tahap Quality Control (QC) selesai.
- **Portal Pengunduhan Dokumen Selesai**:
  - File Polygon: Download bundle Zip berisi .SHP, .KML, .GeoJSON (siap guna untuk sistem OSS / KKPR Kementerian ATR/BPN).
  - Dokumen RTB: Download PDF Hasil Rencana Tapak Bangunan resmi bertanda tangan digital.
- **Post-Service Rating**: Form rating bintang 1-5 dan ulasan evaluasi tim GIS.

---

## 🚀 Menjalankan Aplikasi

Aplikasi berjalan secara fullstack (API Backend Express + Frontend Vite React):

```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:3001](http://localhost:3001)

### Tombol Cepat Pengujian:
1. **"Simulasi Uji: Telaga Sari Land"** di navigasi atas: Otomatis mengisi form dengan data validasi lengkap (Luas 25.000 m², Skor Kesulitan 4.80, Total IDR 7.200.000).
2. **"Demo Tracking #08"**: Membuka langsung halaman live tracking pesanan Telaga Sari Land yang sedang aktif dikerjakan oleh Tim GIS.
