"""Tek seferlik Instagram / Telegram onay teşhisi. Jeton yazılmaz; yalnızca durum kodları ve alan adları dökülür."""
import json, os, re, urllib.error, urllib.parse, urllib.request
SON = [""]

def istek(adres):
    try:
        with urllib.request.urlopen(adres, timeout=30) as y:
            return json.loads(y.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            h = json.loads(e.read().decode()).get("error", {})
            SON[0] = f'{e.code} {h.get("code", "")}/{h.get("error_subcode", "")} {h.get("type", "")} {h.get("message", "")}'
        except Exception:
            SON[0] = str(e.code)
        return None
    except Exception as e:
        SON[0] = type(e).__name__
        return None

def tg(yontem, veri=None):
    tok = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    r = urllib.request.Request(f"https://api.telegram.org/bot{tok}/{yontem}", data=json.dumps(veri or {}).encode(),
                               headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=25) as y:
            return json.loads(y.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "kod": e.code, "govde": e.read().decode()[:300]}
    except Exception as e:
        return {"ok": False, "hata": type(e).__name__}

print("== Telegram")
w = tg("getWebhookInfo"); print("webhook:", {k: v for k, v in (w.get("result") or w).items() if k != "url"}, "url var mı:", bool((w.get("result") or {}).get("url")))
u = tg("getUpdates", {"timeout": 0, "limit": 50, "allowed_updates": ["message", "callback_query"]})
if u.get("ok"):
    sonuc = u["result"]
    print("bekleyen güncelleme:", len(sonuc))
    yon = "".join(c for c in os.environ.get("TELEGRAM_YONETICI", "") if c.isdigit())
    for x in sonuc:
        c = x.get("callback_query")
        if c:
            print("  callback", x["update_id"], "veri:", c.get("data"), "yönetici mi:", str(c.get("from", {}).get("id")) == yon)
        else:
            print("  mesaj", x["update_id"])
else:
    print("getUpdates:", u)

print("== Instagram")
token = os.environ.get("INSTAGRAM_TOKEN", "").strip()
import re
m = re.search(r"(IG|EAA)[A-Za-z0-9_-]{40,}", token); token = m.group(0) if m else token
print("jeton türü:", token[:3] if token else "YOK", "uzunluk:", len(token))
hesap = os.environ.get("INSTAGRAM_HESAP", "").strip()
for sunucu in ("https://graph.facebook.com/v23.0", "https://graph.instagram.com/v23.0"):
    for yol, alan in (("me", "id,name"), ("me", "user_id,username"), (hesap, "id,username,name"), (f"{hesap}/content_publishing_limit", "quota_usage,config"),
                      ("me/accounts", "name,instagram_business_account{id,username}"), ("me/permissions", "")):
        if not yol:
            continue
        r = istek(f"{sunucu}/{yol}?" + urllib.parse.urlencode({**({"fields": alan} if alan else {}), "access_token": token}))
        print(sunucu.split("//")[1].split(".")[1], yol.replace(hesap, "{hesap}"), "→", json.dumps(r, ensure_ascii=False)[:400] if r is not None else "HATA " + SON[0].replace(token, "***"))
