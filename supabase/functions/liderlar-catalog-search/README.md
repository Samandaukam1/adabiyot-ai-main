# liderlar-catalog-search

AdabiyotX katalogi bo'yicha ommaviy qidiruv — Liderlar integratsiyasi uchun.

- **Supabase project ref:** `jrwtggbxveficgglccxq`
- **Production endpoint:**
  `https://jrwtggbxveficgglccxq.supabase.co/functions/v1/liderlar-catalog-search?q=Adashgan`
- **Metod:** `GET` (va `OPTIONS` — CORS preflight)
- **Header:** `x-adabiyotx-api-key: <ADABIYOTX_INTEGRATION_API_KEY>`

Vercel'da API route yaratilmagan — `https://adabiyotx.uz/...` faqat static SPA
(`index.html`) qaytaradi, shuning uchun butun integratsiya shu Edge Function
orqali ishlaydi.

## Qidiriladigan jadvallar

Jadval/ustun nomlari jonli sxemadan tekshirilgan (PostgREST introspection):

| Jadval        | contentType | Public route                        | Qidirish ustunlari                                                                | Muallif                                     |
| ------------- | ----------- | ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| `books`       | `book`      | `https://adabiyotx.uz/book/{id}`       | title, slug, description, short_description, author, author_display_name, tags, categories | `author` / `author_display_name` / `authors` |
| `articles`    | `article`   | `https://adabiyotx.uz/article/{id}`    | title, slug, description, short_description, author_name, author_display_name       | `author_name` / `authors` (author_id)        |
| `poems`       | `poem`      | `https://adabiyotx.uz/poem/{id}`       | title, slug, description, short_description, author, author_display_name, tags, categories | `author` / `author_display_name` / `authors` |
| `screenplays` | `scenario`  | `https://adabiyotx.uz/screenplay/{id}` | title, slug, description, short_description, author_display_name                    | `authors` (author_id)                        |

Eslatmalar:

- `articles` va `screenplays` jadvallarida `tags` va `author` ustunlari **yo'q**
  (`column ... does not exist`), shuning uchun ular qidiruvga qo'shilmagan.
- Har bir so'rov `status = 'published'` filtri bilan ketadi — draft, o'chirilgan
  va moderatsiyadan o'tmagan materiallar hech qachon qaytarilmaydi.
  (`submission_status` moderatsiya oqimining ichki maydoni: chop etilgan
  yozuvlarda ham `draft` bo'lib qolishi mumkin, shuning uchun u ishlatilmaydi —
  ilova kodi ham aynan `status` ustuniga tayanadi.)
- `externalUrl` ichida canonical UUID ishlatiladi: `book`/`poem` sahifalari
  faqat `id` bo'yicha yuklaydi (`hooks/usePublishedBooks.ts` → `.eq("id", id)`),
  slug esa hamma joyda ishlamaydi.
- Muallif ismi yozuvda bo'lmasa, `authors` jadvalidan (`display_name`/`full_name`)
  olinadi; `q` muallif ismiga to'g'ri kelsa, `author_id` bo'yicha ham qidiriladi.
- Umumiy natija — eng ko'pi 30 ta (title mos kelishi > muallif > matn, keyin
  `published_at` bo'yicha yangi birinchi).

## Secret

Kalit faqat Supabase secret sifatida saqlanadi — repositoryda emas:

```bash
# Kalitni generatsiya qilish (masalan)
openssl rand -hex 32

# Secret o'rnatish (<KEY> o'rniga generatsiya qilingan qiymat)
supabase secrets set ADABIYOTX_INTEGRATION_API_KEY=<KEY> --project-ref jrwtggbxveficgglccxq

# Tekshirish (faqat nomi va digest ko'rinadi, qiymati emas)
supabase secrets list --project-ref jrwtggbxveficgglccxq
```

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` va `SUPABASE_ANON_KEY` platforma
tomonidan avtomatik beriladi — ularni qo'lda o'rnatish shart emas.

## Deploy

```bash
supabase login
supabase link --project-ref jrwtggbxveficgglccxq

supabase functions deploy liderlar-catalog-search --no-verify-jwt
```

`--no-verify-jwt` platforma JWT tekshiruvini o'chiradi (chaqiruvchi Supabase
JWT emas, custom kalit bilan keladi). Function ichidagi `x-adabiyotx-api-key`
tekshiruvi — yagona himoya, uni olib tashlash mumkin emas.

## Test

```bash
ENDPOINT="https://jrwtggbxveficgglccxq.supabase.co/functions/v1/liderlar-catalog-search"
KEY="<ADABIYOTX_INTEGRATION_API_KEY>"

# 401 — kalit yo'q
curl -i "$ENDPOINT?q=Adashgan"

# 401 — noto'g'ri kalit
curl -i "$ENDPOINT?q=Adashgan" -H "x-adabiyotx-api-key: wrong"

# 400 — query yo'q / 1 belgili
curl -i "$ENDPOINT" -H "x-adabiyotx-api-key: $KEY"
curl -i "$ENDPOINT?q=a" -H "x-adabiyotx-api-key: $KEY"

# 200 — kitob / maqola / she'r / ssenariy
curl -s "$ENDPOINT?q=Namuna" -H "x-adabiyotx-api-key: $KEY"
curl -s "$ENDPOINT?q=JST"    -H "x-adabiyotx-api-key: $KEY"
curl -s "$ENDPOINT?q=Muhammad%20Yusuf" -H "x-adabiyotx-api-key: $KEY"
curl -s "$ENDPOINT?q=Kutish" -H "x-adabiyotx-api-key: $KEY"

# 200 — bo'sh natija
curl -s "$ENDPOINT?q=zzzqqqxxx" -H "x-adabiyotx-api-key: $KEY"

# CORS preflight
curl -i -X OPTIONS "$ENDPOINT" -H "Origin: https://liderlar.uz"
```

## Lokal ishga tushirish

```bash
supabase functions serve liderlar-catalog-search --no-verify-jwt --env-file supabase/.env.local
# supabase/.env.local:  ADABIYOTX_INTEGRATION_API_KEY=...   (git'ga qo'shilmasin)
```
