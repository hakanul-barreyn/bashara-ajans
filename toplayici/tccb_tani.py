"""Tek seferlik tanı: tccb.gov.tr konuşmalar sayfalarının yapısı (robots.txt'e uyar)."""
import re, urllib.request, urllib.robotparser
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
def al(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=40) as r:
        return r.read().decode("utf-8", "replace")
rp = urllib.robotparser.RobotFileParser("https://www.tccb.gov.tr/robots.txt")
try:
    print(al("https://www.tccb.gov.tr/robots.txt")[:1500]); rp.read()
except Exception as e: print("robots hata", e)
for u in ["https://www.tccb.gov.tr/konusmalar/", "https://www.tccb.gov.tr/konusmalar/?&page=2"]:
    print("====", u, rp.can_fetch(UA, u))
    try:
        h = al(u); print(len(h))
        ls = sorted(set(re.findall(r'href="([^"]*konusmalar[^"]*)"', h)))
        print("\n".join(ls[:40]))
        for m in re.finditer(r"\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2} \w+ \d{4}", h): print("TARIH", h[max(0,m.start()-200):m.end()+50].replace("\n"," ")); break
        print("SAYFALAMA", sorted(set(re.findall(r'href="([^"]*page=[^"]*)"', h)))[:10])
    except Exception as e: print("hata", e)
h = al("https://www.tccb.gov.tr/konusmalar/")
ls = [x for x in re.findall(r'href="(/konusmalar/\d+/\d+/[^"]+)"', h)]
print("ORNEK", ls[:3])
if ls:
    u = "https://www.tccb.gov.tr" + ls[0]; print(rp.can_fetch(UA, u))
    d = al(u); print(len(d))
    i = d.find("<h1"); print(d[i:i+3000])
    for k in ("class=\"detay", "id=\"divContentArea", "class=\"text", "<article"):
        j = d.find(k); print(k, j, d[j:j+500] if j > 0 else "")
