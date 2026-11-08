"""Tek seferlik tanı: tccb.gov.tr konuşmalarına doğrudan ve Wayback üzerinden erişim."""
import re, socket, time, urllib.request, json
socket.setdefaulttimeout(25)
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
def al(u):
    t = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=25) as r:
            h = r.read().decode("utf-8", "replace"); print("OK", u, r.status, len(h), round(time.time() - t, 1), "s"); return h
    except Exception as e:
        print("HATA", u, repr(e)[:200], round(time.time() - t, 1), "s"); return ""
print(al("https://www.tccb.gov.tr/robots.txt")[:800])
h = al("https://www.tccb.gov.tr/konusmalar/")
print(sorted(set(re.findall(r'href="([^"]*konusmalar[^"]*)"', h)))[:20])
c = al("https://web.archive.org/cdx/search/cdx?url=tccb.gov.tr/konusmalar/353/*&output=json&fl=original,timestamp&filter=statuscode:200&collapse=urlkey&limit=5000")
try:
    v = json.loads(c); print("CDX", len(v)); print(v[1:15]); print(v[-10:])
    ids = sorted({int(m.group(1)) for x in v[1:] for m in [re.search(r"/353/(\d+)/", x[0])] if m}); print("ID aralık", ids[:3], ids[-3:], len(ids))
    u, ts = v[len(v) // 2]
    d = al(f"https://web.archive.org/web/{ts}id_/{u}")
    i = d.find("<h1"); print(re.sub(r"\s+", " ", d[i:i+2500]))
    for k in ("detay", "divContentArea", "konusma", "<article", "tarih", "date"):
        j = d.find(k); print("--", k, j, re.sub(r"\s+", " ", d[j:j+400]) if j > 0 else "")
except Exception as e:
    print("cdx çözülemedi", e, c[:300])
