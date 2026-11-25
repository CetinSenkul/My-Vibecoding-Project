# Time Planner v1.0 — Zaman Planlama ve Çalışma Takip Uygulaması

Cihazın sistem tarih ve saatini doğrudan okuyarak çalışan; 3 farklı takvim görünümü, dairesel halkalı kronometre, Süreç/Görev hedef yönetimi, tamamlanan hedefler bölmesi, özel sebepli izin günü (`DayOff`) sistemi, 4 dinamik tema modu ve oyun arayüzü hissiyatında etkileşimli `LiveCharts2` grafikleri sunan yerel bir Windows masaüstü uygulaması (**C# / .NET 8 WPF + SQLite**).

## Öne Çıkan Özellikler

* **3 Modlu Takvim:**
  * **Aylık Görünüm:** Pazartesi–Pazar 7 sütunlu grid, ay/yıl seçicileri, bugüne özel `Bugün` vurgusu ve performans renklendirmesi.
  * **Haftalık Görünüm:** Aktif haftanın 7 gününü hedef, gerçekleşen süre ve oturum özetleriyle listeler.
  * **Günlük Görünüm (`00:00 – 23:59`):** Kaydedilen çalışma oturumlarını saat aralıklarına göre görsel bloklar halinde gösterir ve canlı sistem saati çizgisini taşır.
* **Hedef Yönetimi & Tamamlanan Hedefler:**
  * **Süreç Hedefleri (`Process`):** Sınırsız toplam süre ve oturum takibi.
  * **Görev Hedefleri (`Task`):** Haftalık minimum hedef süreye göre dinamik ilerleme çubuğu ve parlama efekti.
  * **Tamamlanan Hedefler Bölmesi:** `✓ Tamamla` ile tamamlanan hedefler ayrı bölmeye taşınır, istenirse `Geri Al` ile aktifleştirilir; Aylık/Genel analiz ve takvim kayıtlarında görünmeye devam eder.
* **Özel Sebep & İzin Günü (`DayOff`) Sistemi:**
  * Aylık/Haftalık takvimde sağ tık veya Günlük görünüm butonuyla herhangi bir gün **İzinli (Gri)** olarak işaretlenebilir; izinli günler günlük hedeften ve analiz ortalamalarından muaf tutulur.
* **4 Dinamik Tema Modu (`ThemeService`):**
  * **Karanlık (Dark)**, **Aydınlık (Light)**, **Uzay (Space — yıldız/nebula dokulu)** ve **Mevsimler (İlkbahar / Yaz / Sonbahar / Kış — takvim ayına göre otomatik)**.
* **Kronometre & Oturum Kaydı:**
  * Kaymasız `DispatcherTimer` + `DateTime.Now` tabanlı dairesel halkalı kronometre (`Başlat / Duraklat / Kaydet / Sıfırla`), gece yarısı geçiş bölmesi ve günlük oturum geçmişi.
* **Dinamik Performans Renk Skalası & Parlama (`DropShadowEffect`):**
  * `%0` Siyah (`#121212`) → `%1–50` Kırmızı (`#E53935`) → `%50–70` Turuncu (`#FB8C00`) → `%70–90` Sarı (`#FDD835`) → `%90–110` Yeşil (`#43A047`) → `%110+` Mavi (`#1E88E5`).
* **Analiz Paneli (`LiveCharts2`):**
  * **Günlük / Haftalık / Aylık / Genel** zaman filtreleriyle **Daire (Donut)** ve **Sütun (Column)** grafikleri.
  * Görev hedefleri için **Günlük / Haftalık / Aylık** **Nokta Dağılımı (Scatter/Dot Plot)**.
  * Fare etkileşimli animasyonlu vurgu/parlama ve oyun *item kartı* tarzında özel tooltip.

## Teknoloji Yığını

* **Platform & UI:** C# (.NET 8) — WPF (XAML)
* **Veritabanı:** Yerel SQLite (`Microsoft.Data.Sqlite` → `planner.db`)
* **Grafikler:** `LiveChartsCore.SkiaSharpView.WPF` (SkiaSharp)

## Kurulum ve Çalıştırma

Önkoşul: Windows üzerinde **.NET 8 SDK** (veya `.NET 8 Desktop Runtime` + güncel .NET SDK).

```powershell
dotnet restore TimePlannerApp/TimePlannerApp.csproj
dotnet run --project TimePlannerApp/TimePlannerApp.csproj
```

Uygulama ilk açıldığında çalışma dizininde `planner.db` dosyasını ve gerekli tabloları (`DailyTargets`, `Goals`, `WorkSessions`, `DayOffs`, `AppSettings`) otomatik oluşturur.

## Tasarım Referansı

![Arayüz Referans Görseli](Code_Generated_Image.png)
