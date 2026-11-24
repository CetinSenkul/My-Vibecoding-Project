# Zaman Planlama ve Çalışma Takip Uygulaması — Final Proje Dokümanı

## 1. Proje Özeti
Cihazın sistem tarih ve saatini doğrudan okuyarak çalışan; 3 farklı takvim görünümü, manuel kronometre, iki farklı hedef türü, performansa dayalı dinamik renklendirme ve oyun arayüzü hissiyatında etkileşimli grafikler sunan yerel bir Windows masaüstü uygulaması.

---

## 2. Teknik Mimari ve Teknoloji Yığını
* **Platform & Dil:** Windows Masaüstü — **C# (.NET 8)** + **WPF (XAML)**
* **Veritabanı:** **SQLite** (`Microsoft.Data.Sqlite`) — Tüm veriler uygulama klasöründe tek bir yerel `planner.db` dosyasında tutulur (düşük disk kullanımı).
* **Grafik Kütüphanesi:** **LiveCharts2** (`LiveChartsCore.SkiaSharpView.WPF`) — Daire, sütun ve nokta grafikleri ile fare etkileşimli özel tooltip'ler için.
* **Zaman Kaynağı:** Sistem yerel zamanı (`DateTime.Now`, `DateTime.Today`).
* **Tema Yaklaşımı:** Parlama (glow) efektlerinin ve renk skalasının net seçilebilmesi için koyu tema (Dark Mode) tabanlı arayüz; `%0` (Siyah) günler için ince kenarlık (border) ayrımı.

---

## 3. Çekirdek İş Kuralları

### A. Performans Renk Skalası
Günlük takvim kutuları ve haftalık görev hedefleri, tamamlanma oranına (`gerçekleşen_süre / hedef_süre * 100`) göre şu renkleri alır:

| Tamamlanma Oranı | Renk | Önerilen Hex Kodu |
| :--- | :--- | :--- |
| **%0** | Siyah | `#121212` |
| **%1 – %50** | Kırmızı | `#E53935` |
| **%50 – %70** | Turuncu | `#FB8C00` |
| **%70 – %90** | Sarı | `#FDD835` |
| **%90 – %110** | Yeşil | `#43A047` |
| **%110 ve üzeri** | Mavi | `#1E88E5` |

> **Kural:** Sınır değerlerde bir üst dilim geçerlidir (örneğin tam `%50` Turuncu, tam `%70` Sarı, tam `%90` Yeşil, tam `%110` Mavi olarak değerlendirilir).

### B. Hedef Türleri
1. **Süreç Hedefleri (`Process`):**
   * Haftalık zorunlu bir çalışma sınırı yoktur (Örn: *Ders Çalışma, Kitap Okuma*).
   * Kronometre başlatılırken kategori olarak seçilir ve o başlığa harcanan toplam süreyi biriktirir.
2. **Görev Hedefleri (`Task`):**
   * Oluşturulurken **haftalık minimum hedef süre** (dakika/saat) tanımlanır.
   * İçinde bulunulan haftadaki toplam çalışma süresi, belirlenen haftalık minimum süreye oranlanır ve kart/başlık **Performans Renk Skalası** doğrultusunda renk değiştirip parlar.

---

## 4. Yerel Veritabanı Şeması (SQLite)

Uygulama ilk açıldığında `planner.db` mevcut değilse aşağıdaki 3 tabloyu otomatik oluşturmalıdır:

```sql
-- Haftanın 7 günü için varsayılan günlük çalışma hedefleri (0: Pazar ... 6: Cumartesi)
CREATE TABLE IF NOT EXISTS DailyTargets (
    DayOfWeek INTEGER PRIMARY KEY,
    TargetMinutes INTEGER NOT NULL DEFAULT 120
);

-- Süreç ve Görev hedefleri
CREATE TABLE IF NOT EXISTS Goals (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Title TEXT NOT NULL,
    Type TEXT NOT NULL CHECK (Type IN ('Process', 'Task')),
    WeeklyMinMinutes INTEGER DEFAULT 0, -- Sadece 'Task' için kullanılır
    CreatedAt TEXT NOT NULL,
    IsArchived INTEGER NOT NULL DEFAULT 0
);

-- Kronometre ile kaydedilen çalışma oturumları
CREATE TABLE IF NOT EXISTS WorkSessions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    GoalId INTEGER NOT NULL,
    SessionDate TEXT NOT NULL,      -- YYYY-MM-DD
    StartTime TEXT NOT NULL,        -- HH:mm:ss
    EndTime TEXT NOT NULL,          -- HH:mm:ss
    DurationSeconds INTEGER NOT NULL,
    FOREIGN KEY (GoalId) REFERENCES Goals(Id)
);
```

---

## 5. Önerilen Klasör Yapısı

```text
TimePlannerApp/
├── Data/
│   └── DatabaseService.cs       # SQLite bağlantı ve CRUD işlemleri
├── Models/
│   ├── DailyTarget.cs
│   ├── Goal.cs
│   └── WorkSession.cs
├── Services/
│   ├── ColorScaleService.cs     # Yüzde -> Renk ve parlama hesaplama
│   └── AnalyticsService.cs      # Günlük/Haftalık/Aylık/Genel veri toplama
├── Views/
│   ├── CalendarView.xaml        # Aylık / Haftalık / Günlük görünümler
│   ├── GoalsView.xaml           # Hedefler ve günlük saat ayarları
│   ├── StopwatchControl.xaml    # Kronometre paneli
│   └── AnalyticsView.xaml       # LiveCharts2 grafikleri
└── MainWindow.xaml              # Ana menü ve görünüm geçişleri
```

---

## 6. Aşamalı Geliştirme Planı (Vibecoding Yol Haritası)

> **Geliştirme Kuralı:** Her aşama bağımsız olarak uygulanmalı, derlenip doğrulandıktan sonra bir sonraki aşamaya geçilmelidir.

### Aşama 1: Proje İskeleti, SQLite Kurulumu ve 3 Modlu Takvim
* **Kapsam:**
  * WPF (.NET 8) projesi oluşturma ve `DatabaseService` ile `planner.db` tablolarını otomatik başlatma.
  * Ana menüde 3 takvim modu arasında geçiş:
    1. **Aylık Görünüm:** Kutu kutu (7 sütunlu grid) ay görünümü; üst barda yıl ve ay değiştirme kontrolleri.
    2. **Haftalık Görünüm:** Varsayılan olarak içinde bulunulan haftayı gösteren, ileri/geri butonlarıyla diğer haftalara geçilebilen görünüm.
    3. **Günlük Görünüm:** Seçili günü `00:00 – 23:59` arası saatlik dilimler halinde gösteren dikey zaman çizelgesi.
  * Sistemden güncel tarih ve saatin anlık okunup bugünün vurgulanması.
* **Doğrulama Kriteri:** Uygulama hatasız derlenir, `planner.db` oluşur, 3 takvim modu arasında geçiş ve tarih değiştirme sorunsuz çalışır.

### Aşama 2: Hedef Yönetimi ve Günlük Saat Ayarları
* **Kapsam:**
  * Başlık şeklinde hedef ekleme, düzenleme ve silme ekranı.
  * Hedef eklerken **Süreç** veya **Görev** (haftalık minimum süre girişiyle) seçimi.
  * Ayarlar ekranında haftanın her günü (Pazartesi–Pazar) için hedef çalışma saati belirleme ve SQLite'a kaydetme.
* **Doğrulama Kriteri:** Uygulama kapatılıp açıldığında oluşturulan hedefler ve günlük saat hedefleri veritabanından eksiksiz geri yüklenir.

### Aşama 3: Kronometre ve Oturum Kayıt Sistemi
* **Kapsam:**
  * `DispatcherTimer` tabanlı, manuel **Başlat / Duraklat / Bitir ve Kaydet** butonlu kronometre.
  * Kronometre başlatılırken aktif hedefin (Süreç veya Görev) seçilmesi.
  * Kayıt anında başlangıç saati, bitiş saati ve toplam geçen sürenin `WorkSessions` tablosuna yazılması; hedefin toplam süresinin güncellenmesi.
  * Kaydedilen oturumların **Günlük Görünüm**'deki ilgili saat aralıklarına görsel blok olarak yerleşmesi.
* **Doğrulama Kriteri:** Test amaçlı bir oturum başlatılıp bitirildiğinde saat aralığı ve süre veritabanına doğru yazılır, günlük zaman çizelgesinde görünür.

### Aşama 4: Dinamik Renklendirme ve Parlama Efektleri
* **Kapsam:**
  * `ColorScaleService` üzerinden gün bazlı tamamlanma oranının hesaplanması ve Aylık/Haftalık takvimdeki gün kutularının renk skalasına göre boyanması (`%0` Siyah → `%110+` Mavi).
  * Görev hedeflerinin o haftaki tamamlanma oranına göre kart kenarlıklarının ve WPF `DropShadowEffect` parlama (glow) efektinin ilgili renge bürünmesi.
* **Doğrulama Kriteri:** Farklı sürelerde oturumlar eklendiğinde hem ilgili takvim günü hem de görev kartı anlık olarak doğru renge geçer.

### Aşama 5: Analiz Paneli ve Oyun Tarzı İnteraktif Grafikler
* **Kapsam:**
  * `LiveCharts2` entegrasyonu ve **Günlük / Haftalık / Aylık / Genel** olmak üzere 4 zaman filtresi sekmesi.
  * Her filtre için **Daire (Pie/Donut)** ve **Sütun (Column)** grafikleri.
  * **Hover Etkileşimi:** Fare bir dilim veya sütun üzerine geldiğinde parçanın öne çıkması/parlaması (animasyonlu vurgu) ve oyunlardaki *item bilgisi* penceresi gibi şık bir özel tooltip içinde hedef adı, toplam saat ve yüzde bilgisinin gösterilmesi.
  * **Görevler İçin Nokta Grafiği (Scatter/Dot Plot):** Görev hedeflerinin **Günlük, Haftalık ve Aylık** bazda çalışma dağılımını gösteren nokta grafiği.
* **Doğrulama Kriteri:** Tüm grafikler SQLite verilerinden beslenir, zaman filtreleri arasında geçişte ve fare etkileşimlerinde donma olmaz.