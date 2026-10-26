# 🧩 Yapboz Düellosu: kendi sunucunda

İki seçenek var:

- **A. Bulutta (önerilen).** Bilgisayarına hiçbir şey kurmazsın. Oyun ücretsiz bir bulut sunucusunda çalışır ve sabit bir bağlantısı olur. Aşağıdaki "Bulutta çalıştırma" bölümüne bak.
- **B. Kendi bilgisayarında.** Node.js kurar, bir dosyaya çift tıklarsın. Bunun için "1. Bir kerelik hazırlık" bölümünden başla.

---

## Bulutta çalıştırma (Render, ücretsiz, kurulum yok)

Her şey tarayıcıdan yapılır. Toplam 10 dakika kadar sürer.

**1. Kodu GitHub'a yükle**
1. https://github.com adresinde ücretsiz hesap aç.
2. Sağ üstteki **+** menüsünden **New repository** seç. Ad olarak `yapboz` yaz, **Public** ya da **Private** seç ve **Create repository**'ye bas.
3. Açılan sayfada **uploading an existing file** bağlantısına tıkla.
4. Bu klasörün **içindeki** her şeyi sürükleyip bırak: `server.js`, `package.json`, `package-lock.json`, `render.yaml`, `public` klasörü ve diğerleri. Ardından **Commit changes**'a bas.

**2. Render'da yayına al**
1. https://render.com adresinde **GitHub ile giriş yap**.
2. **New +** menüsünden **Blueprint** seç, `yapboz` deposunu bağla ve **Apply**'a bas.
   `render.yaml` dosyası ayarları kendisi yapar. Yapmazsa **New +** menüsünden **Web Service** seç ve şu ayarları gir: Build: `npm install`, Start: `npm start`, Plan: **Free**.
3. Birkaç dakika içinde sana `https://yapboz-duellosu-xxxx.onrender.com` gibi **sabit** bir adres verilir. Bu adres her zaman aynı kalır. Bağlantıyı arkadaşlarına bir kere göndermen yeter.

**Ücretsiz planda bilmen gerekenler**
- 15 dakika boyunca kimse bağlanmazsa sunucu uyur. İlk açan kişi yaklaşık 1 dakika bekler, sonra her şey normal çalışır. Oyun ya da lobi açık olduğu sürece sunucu uyanık kalır.
- Sunucu uyuyunca açık odalar silinir. Yeni oyun için yeni oda kurulur.
- Kodu değiştirmek istersen GitHub'daki dosyayı güncellemen yeterli. Render yeni sürümü kendisi yayına alır.

---

Bilgisayarın oyun sunucusu olur. Arkadaşların telefondan ya da bilgisayardan, sadece tarayıcıyla katılır. Uygulama kurmaları gerekmez. İstersen farklı Wi-Fi'lardan ya da mobil veriden de bağlanabilirler.

## 1. Bir kerelik hazırlık

**Node.js kur.** https://nodejs.org adresinden **LTS** sürümünü indirip kur. Sürüm 18 ya da daha yeni olmalı.

**İnternetten oynanacaksa cloudflared'i de kur.** Ücretsizdir ve hesap açman gerekmez.

| Sistem  | Komut                                         |
|---------|-----------------------------------------------|
| Windows | `winget install --id Cloudflare.cloudflared`  |
| macOS   | `brew install cloudflared`                    |
| Linux   | Cloudflare'in indirme sayfasındaki paketi kur |

Kurduktan sonra açık terminal pencerelerini kapatıp yeniden aç.

## 2. Sunucuyu başlat

### Windows

| Ne istiyorsun?                              | Çift tıkla     |
|---------------------------------------------|----------------|
| Herkes aynı Wi-Fi'da                        | `baslat.bat`   |
| Farklı Wi-Fi'lar ya da mobil veri           | `internet.bat` |

İlk çalıştırmada gerekli paketler otomatik kurulur, bu yaklaşık 10 saniye sürer.

### macOS / Linux

```bash
./baslat.sh              # aynı Wi-Fi
./baslat.sh --internet   # her yerden
```

npm ile de başlatabilirsin: `npm install`, ardından `npm start` ya da `npm run internet`.

## 3. Arkadaşlarını çağır

Sunucu açıldığında terminalde bağlantılar ve bunların QR kodları görünür:

```
📶 AYNI WI-FI'DAKİ CİHAZLAR İÇİN:
👉 http://192.168.1.34:3000

🌍 HERKES İÇİN BAĞLANTI (farklı Wi-Fi / mobil veri):
👉 https://rastgele-kelimeler.trycloudflare.com
```

1. Bağlantıyı kendi telefonunda ya da bilgisayarında aç. Ardından **Online oyna**, **Yeni oda kur**, resim ve zorluk seçimi.
2. Lobide bir **davet bağlantısı** çıkar. Bunu WhatsApp'tan gönder. Bağlantıya tıklayan oda koduyla birlikte gelir, sadece adını yazar.
3. Herkes lobide görününce **Oyunu başlat**.

## Bilmen gerekenler

**Pencereyi kapatma.** Terminal penceresi kapanırsa ya da bilgisayar uykuya geçerse oyun durur. Oyun sürerken bilgisayarı fişe tak ve uyku modunu kapat.

**İnternet bağlantısı her açılışta değişir.** `trycloudflare.com` adresi her başlatmada yenisiyle değişir. Yeni bağlantıyı arkadaşlarına tekrar gönder.

**Windows güvenlik duvarı izin sorabilir.** İlk açılışta "Node.js ağ erişimi" penceresi çıkarsa **Özel ağlar** kutusunu işaretleyip izin ver. Yoksa aynı Wi-Fi'daki telefonlar bağlanamaz.

**Odalar bellekte tutulur.** Sunucuyu kapatıp açınca açık odalar silinir. Boş kalan odalar da 2 saat sonra kendiliğinden kapanır.

**Kurucu giderse oda sahipsiz kalmaz.** Kurucu 30 saniyeden uzun süre bağlı değilse kurucu rolü sıradaki oyuncuya geçer.

**Bağlantı kısa süre koparsa sorun olmaz.** Telefon kilitlenip açıldığında sayfa yeniden bağlanır ve kaldığın yerden devam edersin.

**Bağlantıya sahip olan herkes katılabilir.** Bağlantıyı yalnızca oynayacağın kişilerle paylaş.

## Sesli sohbet

Lobide **Sesli sohbete katıl** düğmesine bas, tarayıcı mikrofon izni sorunca izin ver. Oyun sırasında üst çubuktaki 🎙️ düğmesi mikrofonunu açıp kapatır. Konuşan kişinin adı yeşil parlar. Mikrofon iznini vermeyen biri de katılıp yalnızca dinleyebilir.

- **Sesler sunucudan geçmez.** Oyuncular birbirine doğrudan bağlanır, sunucu sadece bağlantıyı kurar. Bu yüzden ücretsiz Render planı ses yüzünden yorulmaz. Aynı odada en fazla 8 kişi sesli konuşabilir.
- **https gerekir.** Tarayıcılar mikrofonu yalnızca güvenli adreslerde açar. Render adresi (`https://…onrender.com`) ve Cloudflare tüneli bu şartı sağlar. Kendi bilgisayarındaki `http://192.168…` adresinde sesli sohbet **çalışmaz**, oyun çalışmaya devam eder.
- **Kulaklık önerilir.** Tarayıcı yankıyı bastırır ama telefon hoparlöründe yine de yankı olabilir.

### Bazı kişiler birbirini duyamıyorsa (TURN sunucusu)

Çoğu ağda bağlantı doğrudan kurulur. Bazı mobil operatörler ve şirket ağları doğrudan bağlantıyı engeller. O zaman sesleri aktaran bir **TURN** sunucusu gerekir. Metered, Cloudflare gibi sağlayıcıların ücretsiz ya da düşük ücretli TURN hizmetleri var. Aldığın bilgileri Render'da **Environment** bölümüne ortam değişkeni olarak ekle:

| Değişken | Örnek |
|---|---|
| `TURN_URLS` | `turn:ornek.relay.com:80,turns:ornek.relay.com:443` |
| `TURN_USERNAME` | sağlayıcının verdiği kullanıcı adı |
| `TURN_CREDENTIAL` | sağlayıcının verdiği şifre |

Kaydettikten sonra Render sunucuyu yeniden başlatır ve sesli sohbet bu sunucuyu yedek olarak kullanır.

## Sorun giderme

| Sorun | Çözüm |
|---|---|
| Telefon `192.168…` adresini açamıyor | Telefon ve bilgisayar aynı Wi-Fi'da mı? Güvenlik duvarında Node.js'e izin verdin mi? Misafir ağlar cihazları birbirinden yalıtabilir, bu durumda `internet.bat` kullan. |
| "cloudflared bulunamadı" | 1. adımdaki kurulumu yap, terminali kapatıp yeniden aç. |
| "3000 numaralı port kullanımda" | Başka bir port seç. Windows'ta `set PORT=3001 && node server.js`, macOS/Linux'ta `PORT=3001 node server.js` |
| Sesli sohbete katılınca "https ile açılmalı" uyarısı | Yerel `http://192.168…` adresindesin. Render adresini ya da `internet.bat` ile açılan https bağlantısını kullan. |
| Sesli sohbette biri diğerini duymuyor | Önce iki taraf da çıkıp yeniden katılsın. Sürerse yukarıdaki TURN bölümüne bak. |
| Kırmızı "Bağlantı koptu" yazısı | Sunucu penceresi açık mı, bilgisayar uyudu mu? Sayfa kendiliğinden yeniden bağlanmayı dener. |

## Alternatif: ngrok

Cloudflare yerine ngrok kullanmak istersen ücretsiz hesap açıp ngrok'u kur. Sunucuyu `baslat.bat` ile normal başlat, ikinci bir terminalde şunu çalıştır:

```bash
ngrok http 3000
```

Ekranda çıkan `https://….ngrok-free.app` adresini paylaş.

## Dosyalar

```
server.js          Oyun sunucusu (hakem, odalar, gerçek zamanlı bağlantı)
public/index.html  Oyunun kendisi (telefon ve bilgisayar uyumlu)
baslat.bat         Windows, aynı Wi-Fi
internet.bat       Windows, her yerden
baslat.sh          macOS / Linux
render.yaml        Render bulut ayarları
```
