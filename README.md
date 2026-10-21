# Shifo Med — klinikaga onlayn yozilish

Bemor yo'nalish, shifokor, kun va bo'sh vaqtni tanlab qabulga yoziladi; o'z qabul sahifasidan uni ko'radi yoki bekor qiladi. Qabulxona admin panelda kunlik jadvalni yuritadi (keldi → qabul tugadi / kelmadi), shifokorlarning ish kunlari va soatlarini, xizmat narxlarini o'zi o'zgartiradi. Yangi qabul va bekor qilish haqida Telegram xabari keladi.

Next.js 16 · TypeScript (strict) · PostgreSQL · Tailwind CSS v4

**Demo:** https://murodulloh-klinika.vercel.app · admin panel: `/admin` (demo: `admin` / `admin123`)

## Imkoniyatlar

**Bemor uchun**
- 4 qadam: yo'nalish → shifokor → kun va vaqt → ma'lumotlar
- Har bir shifokorning o'z ish kunlari, soatlari va qabul davomiyligi (15–60 daqiqa)
- Faqat haqiqatan bo'sh vaqtlar ko'rinadi; bugungi ish vaqti tugagan bo'lsa, keyingi ish kuni tanlanadi
- Shaxsiy qabul sahifasi: vaqt, shifokor, holat; qabulgacha 2 soatdan ko'p bo'lsa — o'zi bekor qiladi

**Qabulxona uchun**
- Kunlik jadval shifokorlar bo'yicha: bandlik, bemor, telefon, shikoyat
- Holatlar: kutilmoqda → keldi → qabul tugadi, yoki kelmadi / bekor
- Kun ko'rsatkichlari va haftalik qabullar soni; bugungi sahifa o'zi yangilanadi
- Shifokor qo'shish, jadvalini o'zgartirish, yashirish; xizmatlar va narxlar

**Ishonchlilik**
- Bitta vaqtga ikki bemor yozila olmaydi — bazada qisman unikal indeks (bir vaqtda bosilsa ham faqat bittasi o'tadi)
- Har bir qabul o'z davomiyligini saqlaydi: shifokor jadvali keyin o'zgarsa ham, uzun qabul ustiga yangisi yozilmaydi
- Holat faqat ruxsat etilgan bosqichga o'tadi
- Admin sessiyasi HMAC bilan imzolangan httpOnly cookie, barcha kirishlar zod bilan tekshiriladi, botlarga qarshi yashirin maydon

## Ishga tushirish

```bash
npm install
npm run dev
```

`DATABASE_URL` bo'sh bo'lsa, xotiradagi Postgres (PGlite) ishlatiladi. Jadvallar va namunaviy shifokorlar o'zi yaratiladi.

## Sozlamalar

| O'zgaruvchi | Vazifasi |
| --- | --- |
| `DATABASE_URL` | Postgres manzili (Neon, Supabase va h.k.) |
| `ADMIN_LOGIN`, `ADMIN_PASSWORD` | Admin panelga kirish. `ADMIN_PASSWORD` bo'lmasa — demo rejim (`admin` / `admin123`) |
| `SESSION_SECRET` | Kamida 16 belgili tasodifiy satr. Bo'lmasa `DATABASE_URL`dan hosil qilinadi |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Yangi qabul xabari (ixtiyoriy) |

Klinika nomi, manzil, telefon — `src/lib/config.ts`. Yozilish oralig'i va bekor qilish qoidasi — `src/lib/schedule.ts`.

Muallif: Murodulloh — Telegram [@kadirjanovvm](https://t.me/kadirjanovvm)
