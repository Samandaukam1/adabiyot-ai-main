# delete-own-account

Apple App Review **guideline 5.1.1 (v)** talab qiladigan haqiqiy, qaytarib
bo'lmaydigan hisob o'chirish. Bu "so'rov yuborish" emas — bitta oqimda hisob
butunlay yo'q qilinadi.

- **Supabase project ref:** `jrwtggbxveficgglccxq`
- **Endpoint:** `https://jrwtggbxveficgglccxq.supabase.co/functions/v1/delete-own-account`
- **Metod:** `POST` (va `OPTIONS` — CORS preflight)
- **Header:** `Authorization: Bearer <foydalanuvchining o'z access_token'i>`
- **Body:** bo'sh `{}` — server hech qachon `user_id` qabul qilmaydi

## Xavfsizlik modeli

| Talab | Qanday bajarilgan |
| --- | --- |
| `service_role` key frontendda bo'lmasin | Faqat `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` — ilovada umuman yo'q |
| Boshqa hisobni o'chirib bo'lmasin | Hisob **faqat** JWT'dan aniqlanadi (`auth.getUser(token)`); body'dagi id o'qilmaydi |
| Mobil ilovadan `auth.users`'ga DELETE ketmasin | Ilova faqat shu funksiyaga POST qiladi; `auth.admin.deleteUser()` server tomonda |
| Anon key bilan purge chaqirilmasin | `delete_user_account_data()` — `security definer`, `grant execute … to service_role` (anon/authenticated'dan `revoke`) |
| Javob tekshirilmasdan logout bo'lmasin | `useAccountDeletion` faqat 200'dan keyin `signOut()` qiladi |
| Log'da maxfiy ma'lumot bo'lmasin | Token hech qachon log qilinmaydi; klientda log faqat `__DEV__` ostida |

## Javob kodlari

| Kod | Ma'nosi | Ilovadagi xabar |
| --- | --- | --- |
| `200 { ok: true }` | O'chirildi | "Hisobingiz butunlay o'chirildi." |
| `401 unauthorized` | Token yo'q / muddati tugagan | Bir marta `refreshSession()`, bo'lmasa "qaytadan tizimga kiring" |
| `409 in_progress` | Shu hisob uchun o'chirish allaqachon ketmoqda | "Jarayon allaqachon boshlangan. Biroz kuting." |
| `429 rate_limited` | 1 daqiqada 5 martadan ko'p urinish | "Bir daqiqadan so'ng qayta urining." |
| `500 server_error` | Hech narsa o'chirilmadi | "Hisobni o'chirib bo'lmadi." — **hech qachon yolg'on muvaffaqiyat emas** |

Serverning texnik matni foydalanuvchiga ko'rsatilmaydi — klient faqat `code`
maydonini o'qiydi (`expo/lib/accountDeletion.ts`).

## Serverdagi oqim

1. `try_account_deletion_lock(p_user_id)` — bir vaqtda bitta o'chirish (409).
2. `delete_user_account_data(p_user_id)` — foydalanuvchiga tegishli barcha
   qatorlar. Jadval/ustun nomlari **qo'lda yozilmagan**: `pg_constraint`'dan
   `auth.users(id)` yoki `public.profiles(id)`'ga ishora qiluvchi har bir bir
   ustunli FK topiladi. `processed_by`, `reviewed_by` kabi admin ustunlari
   ro'yxatdan chiqarilgan (ular boshqa odamning yozuvi).
3. `auth.admin.deleteUser(user_id)` — auth identifikatori va sessiyalar.
4. `account_deletion_audit` — PII'siz iz: `user_id` **SHA-256 hash** ko'rinishida.
5. `finally` → `release_account_deletion_lock`.

## Deploy

```bash
# 1) SQL migration (bir marta, idempotent — qayta ishga tushirsa buzilmaydi)
#    Supabase Dashboard → SQL Editor'ga qo'yib "Run" bosing:
#    expo/supabase/migrations/20260728000000_account_deletion_hard_delete.sql

# 2) Edge Function (loyiha ildizidan)
supabase login
supabase link --project-ref jrwtggbxveficgglccxq
supabase functions deploy delete-own-account

# 3) Tekshirish
supabase functions list
supabase functions logs delete-own-account --tail
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` va `SUPABASE_SERVICE_ROLE_KEY` Edge
Function muhitida **avtomatik** mavjud — qo'lda `secrets set` qilish shart emas
va hech qanday kalit kodga yozilmagan.

Migration'ni CLI orqali qo'llash uchun (ixtiyoriy):

```bash
supabase db push
```

## Test ssenariylari

Har biri fizik qurilmada (iOS + Android) va webda tekshiriladi.

| # | Ssenariy | Kutilgan natija |
| --- | --- | --- |
| 1 | Mehmon (guest) → Sozlamalar → Hisobni butunlay o'chirish | "Avval akkauntga kiring" xabari, ekran ochilmaydi |
| 2 | Kirgan foydalanuvchi → tugmani bosadi | `/settings/delete-account` ochiladi, ogohlantirish matni ko'rinadi |
| 3 | "Bekor qilish" | Sozlamalarga qaytadi, hech narsa o'chmaydi |
| 4 | "Davom etish" → maydon bo'sh | Yakuniy tugma **kulrang va faol emas** |
| 5 | Noto'g'ri so'z (`OCHIR`) | Tugma hamon faol emas |
| 6 | `o'chirish` (kichik harf) yoki `O‘CHIRISH` (egri apostrof) | Tugma faollashadi — kichik/katta harf va apostrof turi qabul qilinadi |
| 7 | To'g'ri so'z → "Hisobimni butunlay o'chirish" | Spinner, tugma bloklanadi, 200'dan keyin "Hisob o'chirildi" → `/auth` |
| 8 | O'chirilgandan keyin xuddi shu Google/Apple hisob bilan qayta kirish | Yangi, **bo'sh** profil yaratiladi — eski ma'lumotlar qaytmaydi |
| 9 | Aviarejim yoqilgan holda o'chirish | "Internet aloqasini tekshiring", foydalanuvchi tizimda **qoladi** |
| 10 | Token muddati tugagan (30+ daqiqa turgan ilova) | Avtomatik `refreshSession()` → o'chirish davom etadi |
| 11 | Refresh ham ishlamasa | "Sessiya muddati tugagan, qaytadan kiring" — logout **qilinmaydi** |
| 12 | Tugmani ketma-ket 2 marta bosish | Ikkinchi bosish e'tiborsiz (`busy` ref), 409 chiqmaydi |
| 13 | Bir vaqtda ikki qurilmadan o'chirish | Ikkinchisi 409 → "Jarayon allaqachon boshlangan" |
| 14 | 1 daqiqada 6 marta urinish | 429 → "Bir daqiqadan so'ng qayta urining" |
| 15 | Boshqa foydalanuvchi id'sini body'da yuborish (`curl`) | O'zining hisobi o'chadi, boshqasiniki tegilmaydi |
| 16 | Token'siz `curl` | 401, hech narsa o'chmaydi |
| 17 | O'chirishdan keyin `profiles`, `sozlab_posts`, `content_reviews` | Bu foydalanuvchining qatorlari yo'q |
| 18 | O'chirishdan keyin qurilma xotirasi | `sb-*-auth-token`, `adabiyotx:user:<id>:*` kalitlari tozalangan |

`curl` bilan qo'lda tekshirish:

```bash
# 401
curl -i -X POST https://jrwtggbxveficgglccxq.supabase.co/functions/v1/delete-own-account

# Haqiqiy o'chirish (test hisobi bilan!)
curl -i -X POST \
  -H "Authorization: Bearer <TEST_USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000"}' \
  https://jrwtggbxveficgglccxq.supabase.co/functions/v1/delete-own-account
# body'dagi user_id e'tiborsiz qoldiriladi — token egasining hisobi o'chadi
```

## Apple Review uchun video ssenariysi

Fizik qurilmada, bitta uzluksiz yozuvda (~50–60 soniya), test hisobi bilan:

1. **0:00** — Ilova ochiq, foydalanuvchi tizimga kirgan. Profil tabini ko'rsating.
2. **0:05** — Profil → **Sozlamalar** (tepadagi tishli belgi) ni bosing.
3. **0:10** — Sozlamalar ro'yxatini pastga aylantiring. Qizil **"Hisobni butunlay
   o'chirish"** qatorini 2 soniya ekranda ushlab turing.
4. **0:18** — Bosing. Ogohlantirish ekrani: **"Hisobni o'chirmoqchimisiz?"**,
   "Bu amal qaytarib bo'lmaydi…" matni va nima o'chishi ro'yxati ko'rinadi.
   Matnni to'liq o'qish uchun 4–5 soniya to'xtang.
5. **0:26** — **"Davom etish"** ni bosing.
6. **0:30** — Yakuniy tasdiqlash bloki. Tugma **kulrang** (faol emas) ekanini
   ko'rsating.
7. **0:35** — Maydonga **`O'CHIRISH`** so'zini yozing. Tugma qizil rangga o'tib
   faollashadi.
8. **0:42** — **"Hisobimni butunlay o'chirish"** ni bosing. Spinner ko'rinadi.
9. **0:46** — **"Hisob o'chirildi"** xabari, so'ng kirish ekraniga qaytish.
10. **0:52** — Xuddi shu hisob bilan qayta kiring va profil **bo'sh** ekanini
    ko'rsating (eski taxallus/rasm yo'q) — hisob haqiqatan o'chirilgani isboti.

App Store Connect → App Review Information → Notes uchun matn:

> Account deletion: Profile → Settings (gear icon) → "Hisobni butunlay
> o'chirish" (Delete account permanently) → "Davom etish" (Continue) → type
> `O'CHIRISH` (DELETE) → "Hisobimni butunlay o'chirish". The account and all
> personal data are deleted immediately; no support request or email is
> required.
