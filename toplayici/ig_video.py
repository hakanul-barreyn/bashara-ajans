"""Kartlardan Instagram Reels videosu (1080x1920, 30 kare/sn, H.264 + sessiz AAC ses izi).

Her kart ekranın ortasında hafifçe yakınlaşarak durur; arkada aynı kartın bulanık ve karartılmış hâli dikey alanı doldurur;
kartlar arasında yumuşak geçiş. Müzik yok (API ile Instagram'ın müzik kütüphanesi eklenemiyor; telifli müzik de kullanmıyoruz),
ama Instagram ses izi olmayan videoları reddedebildiği için sessiz bir ses izi eklenir.
Video GitHub'ın sunucusunda ffmpeg ile üretilir; ücretsizdir.
"""
import os
import shutil
import subprocess

GENIS, YUKSEK, FPS = 1080, 1920, 30
GECIS = 0.5


def sureler(n):
    """Kart başına saniye: kapak daha uzun, liste kartları okunacak kadar, kapanış kısa."""
    return [4.5] + [5.0] * max(0, n - 2) + ([3.5] if n > 1 else [])


def uret(kartlar, cikti, log=print):
    """kartlar: JPEG yolları (1080x1350). Döndürür: başarılı mı"""
    ff = shutil.which("ffmpeg")
    if not ff or not kartlar:
        return False
    sur = sureler(len(kartlar))
    arg = [ff, "-y", "-loglevel", "error"]
    for k, d in zip(kartlar, sur):
        arg += ["-loop", "1", "-framerate", str(FPS), "-t", f"{d + GECIS:.2f}", "-i", k]
    toplam = sum(sur) + GECIS
    arg += ["-f", "lavfi", "-t", f"{toplam:.2f}", "-i", "anullsrc=r=48000:cl=stereo"]
    f = []
    ust = (YUKSEK - 1350) // 2
    for i, d in enumerate(sur):
        kare = int((d + GECIS) * FPS)
        f.append(f"[{i}:v]split=2[a{i}][b{i}]")
        f.append(f"[a{i}]scale={GENIS}:{YUKSEK}:force_original_aspect_ratio=increase,crop={GENIS}:{YUKSEK},"
                 f"boxblur=28:2,eq=brightness=-0.22:saturation=0.8[z{i}]")
        f.append(f"[b{i}]scale=2160:2700,zoompan=z='min(1+0.05*on/{kare},1.05)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                 f":s=1080x1350:fps={FPS}[k{i}]")
        f.append(f"[z{i}][k{i}]overlay=0:{ust}:shortest=1,format=yuv420p,setsar=1,fps={FPS}[v{i}]")
    son = "v0"
    zaman = 0.0
    for i in range(1, len(sur)):
        zaman += sur[i - 1]
        f.append(f"[{son}][v{i}]xfade=transition=fade:duration={GECIS}:offset={zaman:.2f}[x{i}]")
        son = f"x{i}"
    arg += ["-filter_complex", ";".join(f), "-map", f"[{son}]", "-map", f"{len(sur)}:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "64k", "-ar", "48000", "-shortest", "-movflags", "+faststart", cikti]
    try:
        subprocess.run(arg, check=True, timeout=240)
        return os.path.isfile(cikti) and os.path.getsize(cikti) > 10000
    except Exception as e:
        log(f"Instagram: video üretilemedi ({type(e).__name__})")
        return False
