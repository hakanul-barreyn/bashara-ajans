# Tek seferlik: canlı site, Android öykünmesi; önce ana sayfa (service worker kurulur), sonra aynı bağlamda tarihçe; hızlı ve yavaş ağ
import json, os, time
from playwright.sync_api import sync_playwright
os.makedirs("tarama/a", exist_ok=True)
YUK = "() => [...document.querySelectorAll('body *')].filter(e => e.children.length===0 && /Yükleniyor|Loading|yükleniyor/.test(e.textContent) && e.offsetParent).map(e => e.className || e.tagName).slice(0,5)"
rapor = []
def bekle_icerik(p, sec, sel):
    t0 = time.time()
    while time.time() - t0 < sec:
        try:
            if p.evaluate(sel): return round(time.time() - t0, 1)
        except Exception: pass
        p.wait_for_timeout(500)
    return None
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for ag in ("normal", "yavas"):
        c = b.new_context(**pw.devices["Pixel 7"]); p = c.new_page()
        k = {"ag": ag, "hata": [], "konsol": [], "olay": []}
        p.on("pageerror", lambda e: k["hata"].append(str(e)[:300]))
        p.on("console", lambda m: k["konsol"].append(m.type + ": " + m.text[:200]) if m.type == "error" and "cloudflareinsights" not in m.text else None)
        p.on("requestfailed", lambda r: k["olay"].append("FAIL " + r.url[:140] + " " + str(r.failure)))
        cdp = c.new_cdp_session(p)
        if ag == "yavas":
            cdp.send("Network.enable"); cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 400, "downloadThroughput": 400 * 1024 / 8, "uploadThroughput": 400 * 1024 / 8})
        p.goto("https://alborotonews.com/", wait_until="domcontentloaded", timeout=120000)
        k["ana_icerik_s"] = bekle_icerik(p, 60, "() => document.querySelectorAll('.hb-kart, .kart, article').length > 3")
        p.wait_for_timeout(4000)
        k["sw_ana"] = p.evaluate("() => navigator.serviceWorker && navigator.serviceWorker.controller ? 'var' : 'yok'")
        p.screenshot(path=f"tarama/a/{ag}-ana.png")
        for tur in ("tarihce-1", "tarihce-2"):
            t0 = time.time()
            p.goto("https://alborotonews.com/tarihce.html", wait_until="domcontentloaded", timeout=120000)
            k[tur + "_dom_s"] = round(time.time() - t0, 1)
            k[tur + "_icerik_s"] = bekle_icerik(p, 90, "() => document.querySelectorAll('.ta-kart').length > 10")
            k[tur + "_sw"] = p.evaluate("() => navigator.serviceWorker && navigator.serviceWorker.controller ? 'var' : 'yok'")
            k[tur + "_yukleniyor"] = p.evaluate(YUK)
            p.screenshot(path=f"tarama/a/{ag}-{tur}.png")
        # kaydırma: haritaların ve görsellerin yüklenmesi
        for i in range(25):
            p.mouse.wheel(0, 2500); p.wait_for_timeout(300)
        k["kaydirma_sonu_hata"] = len(k["hata"])
        p.screenshot(path=f"tarama/a/{ag}-kaydirma.png")
        rapor.append(k); c.close()
    b.close()
json.dump(rapor, open("tarama/a/rapor2.json", "w"), ensure_ascii=False, indent=1)
for r in rapor: print(json.dumps(r, ensure_ascii=False)[:1500])
