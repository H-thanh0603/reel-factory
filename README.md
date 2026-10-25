# Reel Factory 🎬

Xưởng sản xuất video dọc (1080×1920) tự động cho **Reels / TikTok / Shorts** — tiếng Việt 100%, dùng TTS [VieNeu-TTS v3-Turbo](https://github.com/pnnbao97/VieNeu-TTS).

Mỗi video gồm: kịch bản hook–nội dung–CTA → giọng đọc AI (25 giọng Việt) → hình ảnh động render bằng Chrome (Playwright) → phụ đề tự động → nhạc nền procedural (không vấn đề bản quyền) → MP4 H.264 + AAC.

## Nội dung mẫu: 50 video

- **Chủ đề đa dạng:** AI & công nghệ, vũ trụ, khoa học, tâm lý học, tiền bạc, kinh doanh, lịch sử, đời sống
- **8 phong cách hình ảnh:** `neon-dark`, `paper`, `gradient-pop`, `terminal`, `minimal-light`, `retro-vhs`, `corporate-blue`, `sunset-warm`
- **25 giọng đọc** (Bắc/Trung/Nam, nam/nữ, phong cách tin tức/tự nhiên/kể chuyện)
- **3 layout:** hook (tuyên ngôn lớn), list (danh sách đánh số), stat (số liệu đếm tăng)

## Cấu trúc

```
content/videos0*.json   # 50 kịch bản (say = lời thoại, show = chữ trên màn hình)
pipeline/
  tts_batch.py          # VieNeu-TTS → wav + tính timeline + phụ đề → spec.json
  mix_audio.py          # ghép lời thoại + nhạc nền → final_audio.wav
  music_gen.py          # sinh 4 biến thể nhạc nền procedural (numpy)
  render.js             # Playwright chụp khung 1080×1920 → ffmpeg → mp4
  factory.js            # điều phối: TTS → mix → render, N worker song song
dist/                   # video thành phẩm
```

## Cách chạy

```bash
# Yêu cầu: repo VieNeu-TTS ở thư mục kế bên (.venv có sẵn vieneu),
# google-chrome, ffmpeg, node, python3 (numpy trong venv của VieNeu-TTS)
npm install playwright-core

# Build 1 video
node pipeline/factory.js 001

# Build tất cả video chưa làm (3 worker)
CONC=3 node pipeline/factory.js

# Xem thử 1 khung hình bất kỳ (debug)
SNAPSHOT=9.5 node pipeline/render.js output/011/spec.json
```

Video hoàn thành nằm trong `dist/<id>-<slug>.mp4`, sẵn sàng đăng trực tiếp.

## Thêm video mới

Thêm entry vào `content/videos01.json`:

```json
{"id":"051","slug":"chu-de-moi","category":"AI","theme":"terminal","layout":"hook",
 "voice":"Mai Anh","music":"pulse","title":"...","hashtags":["#ai"],
 "segments":[
   {"say":"Câu hook gây tò mò...","show":"*Chữ lớn* trên màn hình"},
   {"say":"Nội dung...","show":"Điểm chính","sub":"Chú thích nhỏ"},
   {"say":"Kết + kêu gọi theo dõi...","show":"Hẹn gặp lại"}]}
```

TTS được cache theo segment (`output/<id>/tts/`), sửa 1 câu chỉ render lại đúng phần đó.
