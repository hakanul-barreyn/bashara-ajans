"""Raporların PDF sürümleri (Google Scholar ve arşiv için). Yerel sunucudan sayfaları açar, grafikler çizilince A4 PDF basar.
Kullanım: python toplayici/rapor_pdf.py <site kökü> <çıktı klasörü>"""
import http.server, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright
KOK, CIK = sys.argv[1], sys.argv[2]
os.makedirs(CIK, exist_ok=True)
SAYFA = {"rapor": "rapor.html", "kimin": "kimin.html", "alisma": "olaylar.html", "liderler": "liderler.html", "taksim": "taksim.html"}
os.chdir(KOK)
srv = socketserver.TCPServer(("127.0.0.1", 8799), http.server.SimpleHTTPRequestHandler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch()
    for ad, yol in SAYFA.items():
        s = b.new_page(viewport={"width": 1100, "height": 1400})
        s.add_init_script("try{localStorage.setItem('zbs-dil','tr')}catch(e){}")
        s.goto(f"http://127.0.0.1:8799/{yol}", wait_until="networkidle")
        s.wait_for_timeout(4000)
        s.emulate_media(media="print")
        s.pdf(path=os.path.join(CIK, ad + ".pdf"), format="A4", print_background=True, margin={"top": "16mm", "bottom": "16mm", "left": "14mm", "right": "14mm"},
              display_header_footer=True, header_template="<span></span>",
              footer_template='<div style="font-size:8px;width:100%;text-align:center;color:#666">Alboroto Veri Masası · alborotonews.com · <span class="pageNumber"></span>/<span class="totalPages"></span></div>')
        print("pdf:", ad)
        s.close()
    b.close()
srv.shutdown()
