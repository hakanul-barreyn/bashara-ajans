"""Tek seferlik: Wikimedia Commons'ta kategori kategori açık lisanslı görsel listesi (raporlar girişi için aday arama)."""
import json, sys, urllib.parse, urllib.request
UA = "alboroto-gorsel/1.0 (+https://alborotonews.com)"
KAT = sys.argv[1:] or [
    # tarihçe akışları için aday görseller
    "Ottoman_Palestine", "Sinai_and_Palestine_campaign", "Fall_of_Jerusalem_(1917)", "Balfour_Declaration", "Sykes-Picot_Agreement",
    "Izz_ad-Din_al-Qassam", "1936–1939_Arab_revolt_in_Palestine", "Arab_Higher_Committee", "Peel_Commission",
    "United_Nations_Partition_Plan_for_Palestine", "1948_Palestine_war", "Nakba", "1949_Armistice_Agreements", "Kafr_Qasim_massacre",
    "Gamal_Abdel_Nasser", "Suez_Crisis", "Ba'ath_Party", "Six-Day_War", "Battle_of_Karameh", "Yom_Kippur_War",
    "Fatah", "Palestine_Liberation_Organization", "Yasser_Arafat", "Popular_Front_for_the_Liberation_of_Palestine", "George_Habash",
    "Leila_Khaled", "Dawson's_Field_hijackings", "Ghassan_Kanafani", "Black_September_in_Jordan", "Algerian_War",
    "Land_Day", "First_Intifada", "Palestinian_Declaration_of_Independence", "Gulf_War_Scud_attacks_on_Israel", "Oslo_Accords",
    "Ahmed_Yassin", "Hamas", "Fathi_Shaqaqi", "Second_Intifada", "Hassan_Nasrallah", "Ismail_Haniyeh",
    "Great_March_of_Return", "Shireen_Abu_Akleh", "Gaza_flotilla_raid", "Naji_al-Ali", "Handala"]
out = {}
for kat in KAT:
    q = {"action": "query", "format": "json", "generator": "categorymembers", "gcmtitle": "Category:" + kat, "gcmtype": "file|subcat", "gcmlimit": 80,
         "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1600}
    try:
        with urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q), headers={"User-Agent": UA}), timeout=40) as r:
            v = json.loads(r.read())
    except Exception as e:
        out[kat] = {"hata": str(e)}
        continue
    xs = []
    for p in (v.get("query") or {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        g = lambda k: ((md.get(k) or {}).get("value") or "")[:200]
        xs.append({"t": p.get("title"), "url": ii.get("thumburl") or ii.get("url"), "sayfa": ii.get("descriptionurl"), "w": ii.get("width"),
                   "lisans": g("LicenseShortName"), "yazar": g("Artist"), "kaynak": g("Credit"), "tarih": g("DateTimeOriginal"), "acik": g("ImageDescription")})
    out[kat] = xs
json.dump(out, open("commons.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: len(v) if isinstance(v, list) else v for k, v in out.items()})
