# Tek seferlik: canlı siteyi Android telefon öykünmesiyle açar; konsol hatalarını, başarısız istekleri ve ekran görüntüsünü kaydeder
import json, os, time
from playwright.sync_api import sync_playwright
os.makedirs("tarama/a", exist_ok=True)
SAYFALAR = ["tarihce.html", "", "raporlar.html", "almanak.html", "en/tarihce.html"]
rapor = []
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for cihaz in ["Pixel 7", "Galaxy S9+"]:
        for s in SAYFALAR:
            for tur in ("ilk", "ikinci"):
                c = b.new_context(**pw.devices[cihaz]) if tur == "ilk" or s == SAYFALAR[0] else None
                if c is None: continue
                p = c.new_page(); kayit = {"cihaz": cihaz, "sayfa": s, "tur": tur, "konsol": [], "hata": [], "istek": [], "yavas": []}
                p.on("console", lambda m, k=kayit: k["konsol"].append(m.type + ": " + m.text[:300]) if m.type in ("error", "warning") else None)
                p.on("pageerror", lambda e, k=kayit: k["hata"].append(str(e)[:400]))
                p.on("requestfailed", lambda r, k=kayit: k["istek"].append(r.url[:160] + " " + str(r.failure)))
                p.on("response", lambda r, k=kayit: k["istek"].append(str(r.status) + " " + r.url[:160]) if r.status >= 400 else None)
                t0 = time.time()
                try:
                    p.goto("https://alborotonews.com/" + s, wait_until="domcontentloaded", timeout=60000)
                except Exception as e:
                    kayit["hata"].append("goto: " + str(e)[:200])
                for sn in (3, 8, 20):
                    p.wait_for_timeout((sn - (time.time() - t0)) * 1000 if sn > time.time() - t0 else 0)
                    kayit[f"yukleniyor_{sn}s"] = p.evaluate("() => [...document.querySelectorAll('body *')].filter(e => e.children.length===0 && /Yükleniyor|Loading/.test(e.textContent) && e.offsetParent).length")
                kayit["sw"] = p.evaluate("() => navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null")
                ad = f"{cihaz.replace(' ', '')}-{(s or 'ana').replace('/', '_')}-{tur}"
                p.screenshot(path=f"tarama/a/{ad}.png")
                if tur == "ilk" and s == SAYFALAR[0]:
                    # ikinci açılış: aynı bağlamda (service worker devrede) yeniden yükle
                    t0 = time.time(); k2 = {"cihaz": cihaz, "sayfa": s, "tur": "yeniden", "konsol": [], "hata": [], "istek": []}
                    p.on("pageerror", lambda e, k=k2: k["hata"].append(str(e)[:400]))
                    try: p.reload(wait_until="domcontentloaded", timeout=60000)
                    except Exception as e: k2["hata"].append("reload: " + str(e)[:200])
                    p.wait_for_timeout(12000)
                    k2["yukleniyor_12s"] = p.evaluate("() => [...document.querySelectorAll('body *')].filter(e => e.children.length===0 && /Yükleniyor|Loading/.test(e.textContent) && e.offsetParent).length")
                    k2["sw"] = p.evaluate("() => navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null")
                    p.screenshot(path=f"tarama/a/{ad}-yeniden.png"); rapor.append(k2)
                rapor.append(kayit); c.close()
    b.close()
json.dump(rapor, open("tarama/a/rapor.json", "w"), ensure_ascii=False, indent=1)
for r in rapor: print(r["cihaz"], r["sayfa"], r["tur"], {k: v for k, v in r.items() if k.startswith("yukleniyor")}, len(r["hata"]), r["hata"][:2])
