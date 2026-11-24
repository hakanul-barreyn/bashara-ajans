"""Kişisel sabah bülteni: editörün kendi X hesabı için günün olayları ve tweet taslakları, e-postayla.

Her sabah 08.00'de (bulten-eposta.yml) çalışır; veri dalındaki olay arşivini, dosyaları ve kaynak listesini okur.
- Günün olayları: son 24 saatte en çok yayının verdiği olaylar
- Türkçede yok: en az üç yayının verdiği ama hiçbir Türkçe yayının vermediği olaylar
- Dosyalar: son 24 saatte hareketlenen ya da yeniden gündeme gelen dallar
Her madde için iki cümlelik özet, "kim nasıl yazdı" farkı ve farklı tonlarda tweet taslakları (yapay zekâ, Haiku; yedek Gemini).
Taslaklarda Alboroto bağlantısı yok (editörün kararı: hesap büyüyene kadar site ilan edilmez); kaynak bağlantısı ilk yanıta konur.

Teslim: Telegram'da yöneticiye özel mesaj (TELEGRAM_BOT_TOKEN, TELEGRAM_YONETICI; editör bota bir kez /start yazmış olmalı).
Taslak metinleri <code> içinde: telefonda dokununca kopyalanır; "X'te aç" bağlantısı taslağı X'in yazma ekranına doldurur.
İsteğe bağlı e-posta, gizliler (yalnızca GitHub Secrets): BULTEN_SMTP_KULLANICI, BULTEN_SMTP_SIFRE (Gmail uygulama şifresi), BULTEN_ALICI (boşsa kullanıcıya),
isteğe bağlı BULTEN_SMTP_SUNUCU (smtp.gmail.com), BULTEN_SMTP_PORT (465). Biri eksikse e-posta gönderilmez, iş hata vermez.
"""
import datetime as dt
import glob
import html
import json
import os
import smtplib
import ssl
import sys
import urllib.parse
from email.message import EmailMessage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ekler  # noqa: E402
from almanak import kamp  # noqa: E402

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

TALIMAT = """Bir editör her gün kendi X (Twitter) hesabından Filistin ve bölge haberleri paylaşıyor. Hesap küçük (yaklaşık 100 takipçi) ve Türkçe.
Okurları Türk basınında olmayan uluslararası haberleri ve aynı olayın farklı yayınlarda nasıl farklı anlatıldığını görmek için takip edecek.
Sana günün maddeleri veriliyor: olay başlığı, çerçeve notu ve her yayının adı, bulunduğu kamp, özgün başlığı ve nasıl anlattığı.

Her madde için yaz:
- ozet: iki cümle, Türkçe, ne oldu. Yalnızca verilenlerden.
- fark: bir cümle, yayınların olayı nasıl farklı anlattığı (özgün kelimeyi tırnak içinde, en fazla 4 kelime; hangi yayının kullandığını söyle). Fark yoksa null.
- tweetler: üç taslak, her biri en fazla 260 karakter, bağlantısız:
  "ciddi": net, ağırbaşlı, bilgi veren.
  "genc": canlı, doğrudan, gündelik konuşma diline yakın; ama ciddiyeti kaybetmeyen.
  "igneli": hafif ironik, zekice; ancak YALNIZCA konu buna uygunsa (bir siyasetçinin çelişkisi, bir yayının tuhaf kelime seçimi, propaganda dili). Ölüm, yaralanma, kurbanlar, yıkım, açlık anlatan haberlerde "igneli": null.
- post: Instagram / Facebook / LinkedIn için tek gönderi metni, 450-800 karakter, 2-3 kısa paragraf, bağlantısız, en fazla 3 hashtag sonda.
  İlk cümle olayı söyler; ikinci paragraf yayınların nasıl farklı anlattığını yayın adıyla verir. Ölüm ve yıkım haberinde ağırbaşlı.
- flood: yalnızca dosya maddelerinde, 3-4 tweetlik zincir (liste), her biri en fazla 260 karakter. Diğerlerinde null.

Ton: genç, akıllı, ciddi bir gazeteci sesi. Kaçınılacaklar: "değerli takipçilerim", "sizlerle paylaşmak isterim", "bilgilerinize", "maalesef", ünlem yağmuru, emoji kalabalığı (en fazla bir), birden fazla hashtag, "Allah'ım", "vay be". Klişe açılış yok ("Dikkat!", "Son dakika!" ancak gerçekten son dakikaysa). Kendinden "ben" diye bahsetme gereği yok.
Tweet, yayın adını vermeli ("Al Jazeera 'katliam' derken Times of Israel 'operasyon' dedi" gibi): karşılaştırma bu hesabın imzası.
""" + """Dil kuralları: Bölgeye “Orta Doğu” deme (bölge, Batı Asya). Kendi sesinle niyet yükleyen etiket kullanma (“katil”, “hain”, “terörist” yok); bir tarafın nitelemesini aktarıyorsan tırnak içinde ve kime ait olduğunu söyleyerek. Ölümleri “öldürüldü” diye yaz, “şehit” deme. İddiaları sahibine bağla. Verilmeyen bilgiyi, rakamı, ismi ekleme.

Yalnızca şu JSON'u döndür: {"maddeler": [{"no": <no>, "ozet": "...", "fark": "..." ya da null, "tweetler": {"ciddi": "...", "genc": "...", "igneli": "..." ya da null}, "post": "...", "flood": [...] ya da null}]}"""


def _oku(yol, vars_):
    try:
        return json.load(open(yol, encoding="utf-8"))
    except (OSError, ValueError):
        return vars_


def _ad(t):
    """Bülten adı yerel saate göre: öğleden önce sabah, sonra akşam (ya da elle istenen ara brifing)."""
    import os as _o
    if _o.environ.get("BULTEN_ISTEK") == "1":
        return "Brifing"
    return "Sabah bülteni" if t.hour < 12 else "Akşam bülteni"


def _gun(t):
    return f"{t.day} {AY[t.month - 1]}"


def kaynak_listesi():
    k = _oku(os.path.join(KOK, "kaynaklar.json"), [])
    return k if isinstance(k, list) else k.get("kaynaklar", [])


_KMAP = {}


def kaynak(K, i):
    """Olay arşivindeki "k" kaynağın kimliğidir (liste sırası değil)."""
    if not _KMAP:
        _KMAP.update({x.get("id"): x for x in K})
    return _KMAP.get(i)


def topla(simdi):
    K = kaynak_listesi()
    esik = (simdi - dt.timedelta(hours=26)).isoformat()
    olaylar = {}
    for yol in sorted(glob.glob(os.path.join(KOK, "data", "olay-arsiv", "*.json")))[-3:]:
        for o in _oku(yol, []):
            if (o.get("son") or "") >= esik:
                olaylar[o["id"]] = o
    maddeler = []
    for o in olaylar.values():
        hs, kaynaklar, tr = [], set(), False
        for x in o.get("haberler", []):
            k = kaynak(K, x.get("k"))
            if not k or k.get("silahli"):
                continue   # silahlı grupların kanalları hiçbir yerde gösterilmez
            if k.get("dil") == "tr":
                tr = True
            if k.get("ad") in kaynaklar:
                continue
            kaynaklar.add(k.get("ad"))
            hs.append({"yayin": k.get("ad"), "kamp": kamp(k), "baslik": (x.get("bo") or "")[:160], "anlatim": (x.get("y") or "")[:160],
                       "url": x.get("u") if str(x.get("u", "")).startswith("http") and "t.me/" not in str(x.get("u")) else None})
        if len(hs) < 2:
            continue
        maddeler.append({"baslik": o.get("baslik"), "not": (o.get("not") or "")[:400], "son": o.get("son"), "yayinlar": hs,
                         "yayin_sayisi": len(hs), "turkce_var": tr, "kampler": sorted({h["kamp"] for h in hs})})
    maddeler.sort(key=lambda m: (m["yayin_sayisi"], m["son"]), reverse=True)
    gunun = maddeler[:5]
    yok = [m for m in maddeler if not m["turkce_var"] and m["yayin_sayisi"] >= 3 and m not in gunun][:5]
    for m in gunun:
        m["tur"] = "gunun"
    for m in yok:
        m["tur"] = "yok"
    # dosyalar
    dsy = []
    v = _oku(os.path.join(KOK, "data", "dosyalar-site.json"), {"dosyalar": []})
    dun = (simdi - dt.timedelta(days=1)).date().isoformat()
    for ds in v.get("dosyalar", []):
        for dal in ds.get("dallar", []):
            son = dal["olaylar"][-1] if dal.get("olaylar") else None
            if son and (son.get("g") or "") >= dun and (dal.get("yeniden") or dal.get("durum") == "sicak"):
                dsy.append({"tur": "dosya", "baslik": f'{ds["ad"]} › {dal["ad"]}', "dosya": ds["ad"], "yeniden": dal.get("yeniden"),
                            "not": (ds.get("ozet") or "")[:600], "onceki": dal.get("onceki"),
                            "olaylar": [f'{o["g"]}: {o["b"]}' for o in dal["olaylar"][-6:]], "yayinlar": [], "yayin_sayisi": son.get("k") or 0})
    dsy.sort(key=lambda m: (bool(m["yeniden"]), m["yayin_sayisi"]), reverse=True)
    return gunun, yok, dsy[:3]


def yazdir(maddeler, simdi):
    anahtar = os.environ.get("GEMINI_API_KEY", "").strip()
    model = os.environ.get("GEMINI_MODEL") or "gemini-3.5-flash-lite"
    girdi = []
    for i, m in enumerate(maddeler):
        g = {"no": i, "tur": {"gunun": "günün olayı", "yok": "Türkçe yayınlarda yok", "dosya": "süren dosyada gelişme"}[m["tur"]],
             "baslik": m["baslik"], "not": m["not"]}
        if m["yayinlar"]:
            g["yayinlar"] = [{k: h[k] for k in ("yayin", "kamp", "baslik", "anlatim")} for h in m["yayinlar"][:10]]
        if m["tur"] == "dosya":
            g["dal_olaylari"] = m["olaylar"]
            if m.get("yeniden"):
                g["not"] += f' (Bu dal {m["yeniden"]} gün sessiz kaldıktan sonra yeniden gündemde.)'
        girdi.append(g)
    kod, s = ekler.gemini_cagir(anahtar, model, TALIMAT + "\n\nBugün: " + _gun(simdi) + "\n\n" + json.dumps(girdi, ensure_ascii=False),
                                zaman=180, gorev="kisisel")
    if kod != 200 or not isinstance(s, dict):
        print(f"Taslaklar yazılamadı ({kod}); bülten taslaksız gider")
        return
    for c in s.get("maddeler") or []:
        if isinstance(c, dict) and isinstance(c.get("no"), int) and 0 <= c["no"] < len(maddeler):
            m = maddeler[c["no"]]
            m["ozet"] = ekler.guvenli(c.get("ozet"))[:500]
            m["fark"] = ekler.guvenli(c.get("fark"))[:300] or None
            tw = c.get("tweetler") if isinstance(c.get("tweetler"), dict) else {}
            m["tweetler"] = {t: ekler.guvenli(tw.get(t))[:280] for t in ("ciddi", "genc", "igneli") if tw.get(t)}
            if c.get("post"):
                m["post"] = ekler.guvenli(c.get("post"))[:1200]
            if isinstance(c.get("flood"), list):
                m["flood"] = [ekler.guvenli(x)[:280] for x in c["flood"][:5] if x]


# ---------------------------------------------------------------- e-posta

def _e(s):
    return html.escape(str(s or ""), quote=True)


def _x(metin):
    return "https://x.com/intent/post?text=" + urllib.parse.quote(metin)


TON = {"ciddi": "Ciddi", "genc": "Genç", "igneli": "İğneli"}


def html_yap(gunun, yok, dsy, simdi):
    def tweet(metin, etiket):
        return (f'<div style="border:1px solid #e3dfd6;border-radius:10px;padding:10px 12px;margin:8px 0;background:#fff">'
                f'<div style="font:600 11px monospace;color:#5d6560;letter-spacing:.06em;text-transform:uppercase">{_e(etiket)} · {len(metin)} karakter</div>'
                f'<div style="font-size:15px;line-height:1.5;margin:6px 0 8px;white-space:pre-wrap">{_e(metin)}</div>'
                f'<a href="{_e(_x(metin))}" style="display:inline-block;background:#141816;color:#fff;text-decoration:none;font-weight:600;font-size:13px;padding:6px 12px;border-radius:999px">X\'te aç</a></div>')

    def madde(m):
        p = [f'<h3 style="font:700 18px/1.3 Georgia,serif;margin:22px 0 6px">{_e(m["baslik"])}</h3>']
        if m.get("yeniden"):
            p.append(f'<div style="color:#b3261e;font:600 12px monospace">{m["yeniden"]} gün sonra yeniden gündemde</div>')
        if m.get("ozet"):
            p.append(f'<p style="margin:6px 0;font-size:15px;line-height:1.55">{_e(m["ozet"])}</p>')
        elif m.get("not"):
            p.append(f'<p style="margin:6px 0;font-size:15px;line-height:1.55">{_e(m["not"])}</p>')
        if m.get("fark"):
            p.append(f'<p style="margin:6px 0;font-size:14px;color:#2f3532;background:#f1eee7;padding:8px 10px;border-radius:8px"><b>Kim nasıl yazdı:</b> {_e(m["fark"])}</p>')
        for t, metin in (m.get("tweetler") or {}).items():
            p.append(tweet(metin, TON.get(t, t)))
        if m.get("post"):
            p.append(f'<div style="border:1px solid #e3dfd6;border-radius:10px;padding:10px 12px;margin:8px 0;background:#fff"><div style="font:600 11px monospace;color:#5d6560;letter-spacing:.06em;text-transform:uppercase">Post · Instagram / Facebook / LinkedIn · {len(m["post"])} karakter</div><div style="font-size:15px;line-height:1.5;margin:6px 0;white-space:pre-wrap">{_e(m["post"])}</div></div>')
        if m.get("flood"):
            p.append('<div style="font:600 12px monospace;color:#5d6560;margin-top:10px">FLOOD</div>')
            for i, x in enumerate(m["flood"], 1):
                p.append(tweet(x, f"{i}/{len(m['flood'])}"))
        bag = [h for h in m.get("yayinlar", []) if h.get("url")][:6]
        if bag:
            p.append('<p style="margin:8px 0 2px;font-size:12px;color:#5d6560">Kaynaklar (bağlantıyı ana tweete değil ilk yanıta koy):</p><ul style="margin:0;padding-left:18px;font-size:13px">')
            p += [f'<li><a href="{_e(h["url"])}" style="color:#1f6e4b">{_e(h["yayin"])}</a>: {_e(h["baslik"][:110])}</li>' for h in bag]
            p.append("</ul>")
        return "".join(p)

    def bolum(ad, aciklama, liste):
        if not liste:
            return ""
        return (f'<h2 style="font:800 13px sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#b3261e;margin:30px 0 0;'
                f'border-top:2px solid #141816;padding-top:10px">{_e(ad)}</h2><p style="margin:4px 0 0;color:#5d6560;font-size:13px">{_e(aciklama)}</p>'
                + "".join(madde(m) for m in liste))

    return (f'<!doctype html><html lang="tr"><body style="margin:0;background:#faf8f4;color:#141816;font-family:-apple-system,Segoe UI,sans-serif">'
            f'<div style="max-width:640px;margin:0 auto;padding:20px 16px 40px">'
            f'<div style="font:800 15px sans-serif;letter-spacing:.06em;text-transform:uppercase">Sabah bülteni</div>'
            f'<div style="color:#5d6560;font-size:13px">{_e(_gun(simdi))} · {len(gunun) + len(yok) + len(dsy)} madde · taslaklar düzeltilmek için</div>'
            + bolum("Günün olayları", "Son 24 saatte en çok yayının verdiği olaylar", gunun)
            + bolum("Türkçe yayınlarda yok", "En az üç yayının verdiği, izlediğimiz Türkçe yayınların hiçbirinde çıkmayan olaylar", yok)
            + bolum("Dosyalar", "Süren hikâyelerde son 24 saat", dsy)
            + '<p style="margin-top:34px;font-size:12px;color:#5d6560">Taslakları yapay zekâ yazdı; atmadan önce kaynaktan doğrula. '
              'Ölüm ve kayıp rakamlarını kaynağın kendisinden kontrol et.</p></div></body></html>')


def metin_yap(gunun, yok, dsy, simdi):
    s = [f"{_ad(simdi)} · {_gun(simdi)}", ""]
    for ad, liste in (("GÜNÜN OLAYLARI", gunun), ("TÜRKÇE YAYINLARDA YOK", yok), ("DOSYALAR", dsy)):
        if not liste:
            continue
        s += [ad, ""]
        for m in liste:
            s += [m["baslik"], m.get("ozet") or m.get("not") or ""]
            if m.get("fark"):
                s.append("Kim nasıl yazdı: " + m["fark"])
            for t, x in (m.get("tweetler") or {}).items():
                s += [f"[{TON.get(t, t)}] {x}"]
            if m.get("post"):
                s += ["[Post] " + m["post"]]
            s += [f"Orijinal: {h['yayin']} {h['url']}" for h in m.get("yayinlar", []) if h.get("url")][:5]
            s.append("")
    return "\n".join(s)


def _tg(token, sohbet, metin):
    import urllib.request
    govde = json.dumps({"chat_id": sohbet, "text": metin, "parse_mode": "HTML", "link_preview_options": {"is_disabled": True}}).encode()
    istek = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=govde, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(istek, timeout=20) as r:
            return json.loads(r.read()).get("ok", False), ""
    except Exception as e:
        aciklama = ""
        try:
            aciklama = json.loads(e.read().decode()).get("description", "")
        except Exception:
            pass
        return False, f"{getattr(e, 'code', type(e).__name__)} {aciklama}".strip()


def telegram_iletileri(gunun, yok, dsy, simdi):
    """Her madde ayrı ileti (Telegram'ın 4096 karakter sınırı); en başta kısa bir içindekiler."""
    E = lambda t: html.escape(str(t or ""), quote=False)
    bas = [f"<b>{E(_ad(simdi))} · {E(_gun(simdi))}</b>"]
    for ad, liste in (("Günün olayları", gunun), ("Türkçe yayınlarda yok", yok), ("Dosyalar", dsy)):
        if liste:
            bas.append(f"\n<b>{ad}</b>")
            bas += [f"• {E(m['baslik'])}" for m in liste]
    bas.append("\n<i>Taslağa dokununca kopyalanır; “X’te aç” taslağı X’e doldurur. Atmadan önce kaynaktan doğrula.</i>")
    iletiler = ["\n".join(bas)]
    etiket = {"gunun": "GÜNÜN OLAYI", "yok": "TÜRKÇE YAYINLARDA YOK", "dosya": "DOSYA"}
    for m in gunun + yok + dsy:
        p = [f"<b>{etiket[m['tur']]}</b>" + (f" · {m['yeniden']} gün sonra yeniden gündemde" if m.get("yeniden") else ""),
             f"<b>{E(m['baslik'])}</b>", E(m.get("ozet") or m.get("not") or "")]
        if m.get("fark"):
            p.append(f"<i>Kim nasıl yazdı:</i> {E(m['fark'])}")
        for t, metin in (m.get("tweetler") or {}).items():
            p.append(f"\n<b>{TON.get(t, t)}</b> · {len(metin)} karakter\n<code>{E(metin)}</code>\n<a href=\"{html.escape(_x(metin))}\">X’te aç →</a>")
        if m.get("post"):
            p.append(f"\n<b>Post (Instagram / Facebook / LinkedIn)</b> · {len(m['post'])} karakter\n<code>{E(m['post'])}</code>")
        if m.get("flood"):
            p.append("\n<b>Flood</b>")
            for i, x in enumerate(m["flood"], 1):
                p.append(f"{i}/{len(m['flood'])} <code>{E(x)}</code>")
        bag = [h for h in m.get("yayinlar", []) if h.get("url")][:5]
        if bag:
            p.append("\n<b>Orijinal haberler</b> (tweette ilk yanıta, postta ilk yoruma koy):\n" + "\n".join(f'• <a href="{html.escape(h["url"])}">{E(h["yayin"])}</a>: {E((h.get("baslik") or "")[:90])}' for h in bag))
        # Telegram sınırı 4096: madde uzunsa (post + bağlantılar) parçalara böl; HTML etiketi asla ortadan kesilmesin
        parca = ""
        for x in (x for x in p if x):
            x = x[:3800]
            if parca and len(parca) + len(x) + 1 > 3900:
                iletiler.append(parca)
                parca = ""
            parca = (parca + "\n" + x) if parca else x
        if parca:
            iletiler.append(parca)
    return iletiler


def telegram_gonder(iletiler):
    import re
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    m = re.search(r"\d{6,12}:[A-Za-z0-9_-]{30,}", token)
    token = m.group(0) if m else ""
    sohbet = os.environ.get("TELEGRAM_YONETICI", "").strip()
    if not token or not sohbet:
        print("::notice::Telegram'a gönderilmedi: TELEGRAM_BOT_TOKEN ve TELEGRAM_YONETICI (senin Telegram kimlik numaran) gizlileri gerekli.")
        return False
    import time
    for i, t in enumerate(iletiler):
        ok, hata = _tg(token, sohbet, t)
        for _ in range(4):   # 429: Telegram'ın istediği kadar bekleyip yeniden dene (bot kanal gönderimiyle paylaşılıyor)
            if ok or "429" not in hata:
                break
            bekle = re.search(r"retry after (\d+)", hata)
            time.sleep(min(60, int(bekle.group(1)) if bekle else 5) + 1)
            ok, hata = _tg(token, sohbet, t)
        if not ok:
            ipucu = " → bota bir kez /start yazman gerekiyor" if "chat not found" in hata or "blocked" in hata or "403" in hata else ""
            if ipucu:   # hangi bota yazılacağını ve kimlik numarasının biçimini söyle (numaranın kendisi yazılmaz)
                try:
                    import urllib.request
                    with urllib.request.urlopen(f"https://api.telegram.org/bot{token}/getMe", timeout=20) as r:
                        ben = json.loads(r.read()).get("result") or {}
                    ipucu += f" (bot: @{ben.get('username')}; TELEGRAM_YONETICI {len(sohbet)} karakter, " + ("yalnızca rakam" if sohbet.lstrip('-').isdigit() else "RAKAM DIŞI KARAKTER VAR") + ")"
                except Exception:   # noqa: BLE001
                    pass
            print(f"::warning::Telegram iletisi gönderilemedi ({i + 1}/{len(iletiler)}): {hata}{ipucu}")
            return False
        time.sleep(1.1)
    print(f"Bülten Telegram'a gönderildi ({len(iletiler)} ileti)")
    return True


def gonder(konu, html_govde, duz):
    kul, sifre = os.environ.get("BULTEN_SMTP_KULLANICI", "").strip(), os.environ.get("BULTEN_SMTP_SIFRE", "").replace(" ", "").strip()
    alici = os.environ.get("BULTEN_ALICI", "").strip() or kul
    if not kul or not sifre:
        return False
    e = EmailMessage()
    e["Subject"], e["From"], e["To"] = konu, f"Alboroto bülten <{kul}>", alici
    e.set_content(duz)
    e.add_alternative(html_govde, subtype="html")
    sunucu = os.environ.get("BULTEN_SMTP_SUNUCU", "").strip() or "smtp.gmail.com"
    port = int(os.environ.get("BULTEN_SMTP_PORT", "").strip() or 465)
    with smtplib.SMTP_SSL(sunucu, port, context=ssl.create_default_context(), timeout=60) as s:
        s.login(kul, sifre)
        s.send_message(e)
    print("Bülten e-postası gönderildi")
    return True


def main():
    simdi = dt.datetime.now(dt.timezone.utc)
    gunun, yok, dsy = topla(simdi)
    tum = gunun + yok + dsy
    print(f"Bülten: {len(gunun)} günün olayı, {len(yok)} Türkçede yok, {len(dsy)} dosya")
    if not tum:
        print("Bülten için madde yok")
        return
    try:
        yazdir(tum, simdi)
    except Exception as e:
        print(f"Taslak hatası: {e}")
    yerel = simdi + dt.timedelta(hours=3)
    h = html_yap(gunun, yok, dsy, yerel)
    if os.environ.get("BULTEN_ONIZLEME"):
        open(os.environ["BULTEN_ONIZLEME"], "w", encoding="utf-8").write(h)
    tg = telegram_gonder(telegram_iletileri(gunun, yok, dsy, yerel))
    ep = gonder(f"{_ad(yerel)} · {_gun(yerel)}" + (f" · {gunun[0]['baslik'][:60]}" if gunun else ""), h, metin_yap(gunun, yok, dsy, yerel))
    if not tg and not ep:
        print("Bülten hiçbir kanala gönderilemedi. Önizleme:")
        print(metin_yap(gunun, yok, dsy, yerel)[:3000])


if __name__ == "__main__":
    main()
