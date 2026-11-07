"""Site adını site/marka.js'ten okur ve yayından önce statik dosyalara işler.

Ad değiştirmek için yalnızca site/marka.js düzenlenir. Bu modül her çalıştırmada:
- manifest.webmanifest'i (uygulama simgesinin adı) yeniden yazar,
- HTML sayfalarındaki data-marka öğelerini ve {ad} şablonlu başlıkları doldurur
  (arama motorları ve paylaşım önizlemeleri de doğru adı görsün diye; tarayıcıda marka.js aynısını yapar),
- RSS başlığı ve toplayıcının kimliği için adı verir.
"""
import html
import json
import os
import re

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VARSAYILAN = {"ad": "ZBS", "kisa_ad": "ZBS", "slogan": "", "aciklama": ""}


def oku(kok=KOK):
    try:
        metin = open(os.path.join(kok, "site", "marka.js"), encoding="utf-8").read()
        m = re.search(r"window\.MARKA\s*=\s*(\{.*?\})\s*;", metin, re.S)
        return {**VARSAYILAN, **json.loads(m.group(1))}
    except Exception:
        return dict(VARSAYILAN)


def _sablon(s, M):
    return re.sub(r"\{(\w+)\}", lambda m: str(M.get(m.group(1), "")), s)


def uygula(kok=KOK):
    M = oku(kok)
    yol = os.path.join(kok, "manifest.webmanifest")
    try:
        man = json.load(open(yol, encoding="utf-8"))
        man["name"], man["short_name"] = M["ad"], M["kisa_ad"] or M["ad"]
        if M.get("slogan"):
            man["description"] = M["slogan"]
        json.dump(man, open(yol, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    except Exception:
        pass
    e = lambda s: html.escape(str(s), quote=False)
    for ad in ("index.html", "arsiv.html", "kaynaklar.html", "hakkimizda.html"):
        p = os.path.join(kok, ad)
        if not os.path.exists(p):
            continue
        s = open(p, encoding="utf-8").read()
        # <x data-marka="ad">eski</x>  ->  yeni metin
        s = re.sub(r'(<(\w+)[^>]*\sdata-marka="(\w+)"[^>]*>)[^<]*(</\2>)',
                   lambda m: m.group(1) + e(M.get(m.group(3), "")) + m.group(4), s)
        # <x data-marka-sablon="{ad} Arşiv">eski</x>  (öznitelik değilse içerik)
        s = re.sub(r'(<(\w+)(?![^>]*data-marka-oznitelik)[^>]*\sdata-marka-sablon="([^"]*)"[^>]*>)[^<]*(</\2>)',
                   lambda m: m.group(1) + e(_sablon(m.group(3), M)) + m.group(4), s)

        # <meta data-marka-sablon="{aciklama}" data-marka-oznitelik="content" content="eski">
        def oz(m):
            tag = m.group(0)
            a = re.search(r'data-marka-oznitelik="(\w[\w-]*)"', tag).group(1)
            deger = html.escape(_sablon(re.search(r'data-marka-sablon="([^"]*)"', tag).group(1), M), quote=True)
            if re.search(rf'\s{a}="[^"]*"', tag):
                return re.sub(rf'(\s{a}=")[^"]*(")', lambda x: x.group(1) + deger + x.group(2), tag)
            return tag[:-1].rstrip("/") + f' {a}="{deger}">'
        s = re.sub(r'<[^>]*data-marka-oznitelik="[^"]*"[^>]*>', oz, s)
        open(p, "w", encoding="utf-8").write(s)
    return M


if __name__ == "__main__":
    print(uygula())
