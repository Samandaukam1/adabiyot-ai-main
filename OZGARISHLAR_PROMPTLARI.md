# AdabiyotX — 6 ta o'zgarish uchun promtlar (App + Admin + SQL)

> Har bir bo'lim 3 qismdan iborat: **🗄 SQL** (Supabase SQL Editor'da ishga tushiriladi), **📱 App prompt** (`adabiyot-ai-main/expo`), **🛠 Admin prompt** (`adabiyot-ai-admin`). Qism kerak bo'lmasa "kerak emas" deb belgilangan.
>
> **SQL ishga tushirish tartibi:** 1 → 3 → 4 → 5 → 6 (2-bo'limda SQL yo'q). Barcha SQL **idempotent** (qayta ishga tushsa ham xavfsiz).
>
> Texnik nomlar (fayl yo'llari, jadval/ustun nomlari, kod) ataylab inglizcha qoldirildi — agar prompt'ni Rork yoki Claude Code'ga tashlasangiz to'g'ri ishlashi uchun.

---

## Umumiy texnik kontekst (har bir promtga tegishli)

- App: Expo Router + RN + TS, Supabase (`jrwtggbxveficgglccxq`), `@tanstack/react-query`, `createContextHook`.
- Auth haqiqiy: `providers/AuthProvider.tsx` → `useAuth().userId` (Supabase auth user id; guest bo'lsa `null`).
- Theme pattern (MAJBURIY yangi ekranlarda):
  ```tsx
  const { colors: c, isDark } = useTheme();
  const styles = useMemo(() => createStyles(c, isDark), [c, isDark]);
  ```
- `PressableScale` (`components/ui.tsx`): `style?: ViewStyle | ViewStyle[]` — array ichida `false`/`undefined` ishlatmang; `disabled` propi yo'q (`onPress`ni shartlang).
- Profil identifikatori: `profiles` jadvali + `mobile_public_profiles` view (`id, display_name, full_name, pen_name, avatar_url, verification_type`).
- So'zLab: `app/(tabs)/sozlab.tsx`, `components/sozlab/SozlabPostModals.tsx`. Postlar `sozlab_posts`, izohlar `sozlab_comments`.
- Admin: Next.js, `lib/supabase/*.ts` data-layer, `app/<bo'lim>/page.tsx` sahifalar.

---

## 1) So'zLab: izohga javob yozilganda noto'g'ri muallif nomi chiqishi

**Muammo:** Izohga (comment) javob (reply) yozilganda, javob *parent* izoh egasining nomidan ko'rinmoqda. Har bir izoh/javob O'ZINING egasini ko'rsatishi kerak.

**Ildiz sabab:** Deployed `sozlab_comments` jadvali strukturasi mos emas. App `user_id` / `parent_comment_id` / `content` yozadi (`sozlab.tsx` `loadComments`/`handleSend`, ~1240–1348-qatorlar), lekin tip `SozlabCommentRow` (`types/database.ts:302`) faqat `author_id` / `display_name` / `body` ni biladi. Natijada har bir qatorning egasi `user_id` orqali ishonchli aniqlanmayapti.

### 🗄 SQL
```sql
-- ============================================================
-- 1) sozlab_comments — strukturani normallashtirish + author view
-- Safe to re-run.
-- ============================================================

-- 1.1 Kerakli ustunlarni kafolatlash
alter table public.sozlab_comments add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.sozlab_comments add column if not exists parent_comment_id uuid references public.sozlab_comments(id) on delete cascade;
alter table public.sozlab_comments add column if not exists content text;
alter table public.sozlab_comments add column if not exists status text not null default 'published';
alter table public.sozlab_comments add column if not exists is_edited boolean not null default false;
alter table public.sozlab_comments add column if not exists is_deleted boolean not null default false;
alter table public.sozlab_comments add column if not exists created_at timestamptz not null default now();

-- 1.2 Legacy ma'lumotni ko'chirish: body -> content, author_id -> user_id
update public.sozlab_comments set content = body where content is null and body is not null;
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='sozlab_comments' and column_name='author_id') then
    update public.sozlab_comments set user_id = author_id where user_id is null and author_id is not null;
  end if;
end $$;

create index if not exists sozlab_comments_post_idx   on public.sozlab_comments(post_id, created_at);
create index if not exists sozlab_comments_parent_idx on public.sozlab_comments(parent_comment_id);
create index if not exists sozlab_comments_user_idx   on public.sozlab_comments(user_id);

-- 1.3 Har bir izohni O'Z egasi bilan qaytaradigan view
create or replace view public.mobile_sozlab_comments as
select
  c.id, c.post_id, c.parent_comment_id, c.user_id,
  coalesce(c.content, c.body) as content,
  c.status, c.is_edited, c.is_deleted, c.created_at,
  p.pen_name                                              as author_pen_name,
  coalesce(p.pen_name, p.display_name, p.full_name)       as author_name,
  p.avatar_url                                            as author_avatar_url,
  p.verification_type                                     as author_verification_type
from public.sozlab_comments c
left join public.profiles p on p.id = c.user_id
where coalesce(c.is_deleted,false) = false
  and coalesce(c.status,'published') <> 'deleted';

-- 1.4 RLS: hamma o'qiy oladi, kirgan user o'z izohini yozadi/tahrirlaydi
alter table public.sozlab_comments enable row level security;

drop policy if exists sozlab_comments_select on public.sozlab_comments;
create policy sozlab_comments_select on public.sozlab_comments
  for select using (true);

drop policy if exists sozlab_comments_insert on public.sozlab_comments;
create policy sozlab_comments_insert on public.sozlab_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists sozlab_comments_update on public.sozlab_comments;
create policy sozlab_comments_update on public.sozlab_comments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.mobile_sozlab_comments to anon, authenticated;
```

### 📱 App prompt
```text
Loyiha: adabiyot-ai-main/expo. Fayl: app/(tabs)/sozlab.tsx (CommentSheet komponenti, ~1205–1502-qatorlar).

MUAMMO: izohga javob (reply) yozilganda javob noto'g'ri (parent izoh egasining) nomidan ko'rinadi. Har bir izoh va javob O'ZINING egasini (pen_name/avatar/badge) ko'rsatishi shart.

BAJAR:
1. loadComments() ni `mobile_sozlab_comments` view'dan o'qiydigan qilib soddalashtir (base `sozlab_comments` fallback sifatida qolsin). Har bir qator author ma'lumotini O'ZINING user_id orqali oladi:
   - id, content, ts=created_at, userId=user_id, parentId=parent_comment_id
   - authorName  = author_name
   - authorPhoto = author_avatar_url
   - authorVerification = author_verification_type
   - isEdited = is_edited
   `fetchAuthorMap` chaqiruvi qolsa ham bo'ladi, lekin endi view author'ni bergani uchun har bir qatorga ALOHIDA qo'llanishi shart — parent yoki post egasidan MEROS OLMASIN.
2. renderComment'da `name = cm.authorName?.trim() || DEFAULT_AUTHOR_NAME` — har bir cm uchun o'zining authorName/photo/badge ishlatilsin (parentdan ko'chirma).
3. handleSend(): insert {post_id, user_id: currentUserId, parent_comment_id: replyTarget?.id ?? null, content, status:'published'} — endi `.select('*').single()` bilan yangi qator id'sini qaytar (3-bo'limdagi mention/notification uchun kerak bo'ladi).
4. currentUserId null bo'lsa (guest) — "Izoh yozish uchun hisobingizga kiring" deb auth ekraniga yo'naltir.
5. Reply UI: javob parent ostida 38px chap otступ bilan ko'rinsin (hozirgidek), lekin javobning avatar/nomi javob EGASINIKI bo'lsin.

TEKSHIRUV: 2 xil akkount bilan kir. A izoh yozadi → B unga javob yozadi. B ning javobi B ning ismi/avatari bilan, A ning izohi A bilan ko'rinishi kerak. Sahifani yangilagandan keyin ham to'g'ri qolsin.
```

### 🛠 Admin prompt
Kerak emas (faqat DB + app).

### ✅ Tekshiruv
- A→izoh, B→javob: har biri o'z nomidan. Refresh'dan keyin ham.

---

## 2) So'zLab: postga biriktirilgan adabiyot bosilganda preview ochilmasligi

**Muammo:** Postga biriktirilgan adabiyot (she'r/kitob/maqola/ssenariy) bosilganda preview sahifasi ochilmaydi yoki noto'g'ri ekran ochiladi.

**Ildiz sabab (`sozlab.tsx`):**
- `openAttachment` (762–768) `attachment.id` null bo'lsa **darhol qaytadi** (hech narsa ochmaydi). Eski/qidiruvdagi biriktmalarda faqat `title` saqlangan bo'lishi mumkin.
- `attachedKind` faqat `attached_content_type` mavjud bo'lsa hisoblanadi (2059), aks holda `"material"` → har doim `/book/[id]` ga boradi (she'rni ham kitob deb ochadi → "topilmadi").

### 🗄 SQL
```sql
-- ============================================================
-- 2) Eski sozlab_posts biriktmalarida content_type ni to'ldirish (ixtiyoriy tozalash)
-- Safe to re-run.
-- ============================================================
update public.sozlab_posts
set attached_content_type = 'book'
where attached_content_id is not null
  and (attached_content_type is null or attached_content_type = '');
-- Eslatma: bu faqat eski yozuvlar uchun. Asosiy yechim app tomonida (kind to'g'ri saqlash + routing).
```

### 📱 App prompt
```text
Loyiha: adabiyot-ai-main/expo. Fayllar: app/(tabs)/sozlab.tsx, app/poem/[id].tsx, app/book/[id].tsx, app/article/[id].tsx, app/screenplay/[id].tsx.

MUAMMO: So'zLab postiga biriktirilgan adabiyot (she'r, kitob, maqola, ssenariy) bosilganda preview ochilmaydi yoki noto'g'ri ekran ochiladi.

BAJAR:
1. openAttachment (sozlab.tsx ~762): kind aniqlashni mustahkamla.
   - kind'ni `normalizeKind(post.attachedType || post.attachedKind || "")` orqali hisobla (types/community.ts).
   - Routing: article→/article/[id]; (poem|tale)→/poem/[id]; (script|screenplay)→/screenplay/[id]; qolgan barchasi (book|novel|story|guide|material)→/book/[id].
2. attachment.id YO'Q bo'lsa, lekin title bor bo'lsa: title bo'yicha `mobile_literature_search_index` / `public_material_index` dan id ni topib ochishga harakat qil; topilmasa /tokcha ga qidiruv bilan yo'naltir (sukut saqlab qolmasin).
3. Composer (ComposeSheet) biriktma saqlaganda HAR DOIM attached_content_id VA attached_content_type ni yoz (att.id, att.contentType||att.kind). Hozir kind yo'qolib qolmoqda — buni tuzat.
4. Preview ekranlari (poem/book/article/screenplay [id].tsx) Supabase id VA mock id ikkalasini ham yecha olsin:
   - Avval mock (getBook/getArticle/...) tekshir, bo'lmasa Supabase hook (usePublishedBook va h.k.).
   - poem/[id].tsx: agar berilgan id `books`/`poems`da she'r bo'lmasa, lekin oddiy kitob bo'lsa → /book/[id] ga redirect (hozirgidek), aksincha ham.
5. Topilmasa "Topilmadi" o'rniga foydalanuvchini ortga qaytaruvchi tugmali holat ko'rsat.

TEKSHIRUV: She'r biriktirilgan post → bosilsa /poem/[id] ochilsin. Kitob → /book/[id]. Maqola → /article/[id]. Ssenariy → /screenplay/[id]. Hech qaysisi "jim qolmasin" yoki noto'g'ri ekranga ketmasin.
```

### 🛠 Admin prompt
Kerak emas.

### ✅ Tekshiruv
- 4 turdagi biriktma → mos preview ochiladi; id yo'q bo'lsa qidiruvga olib boradi.

---

## 3) So'zLab: `@` bilan mention + bildirishnoma (notification) → izohga olib borish

**Maqsad:** Izoh/javob yozayotganda `@` bilan boshqa foydalanuvchini belgilash (autocomplete). Mention qilingan kishiga So'zLabdagi va bosh sahifadagi **bildirishnoma** bo'limiga xabar keladi; xabar bosilsa — o'sha izohga olib boradi.

> Bu bo'lim **notifications infratuzilmasini** o'rnatadi — 4-bo'lim ham shu jadvaldan foydalanadi.

### 🗄 SQL
```sql
-- ============================================================
-- 3) notifications jadvali (mention, reply, follow, new_book, rating, system)
-- Safe to re-run.
-- ============================================================
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  type         text not null check (type in
                 ('mention','comment_reply','new_follower','followed_new_post','new_book','rating','system')),
  title        text,
  body         text,
  entity_type  text,   -- 'sozlab_post' | 'sozlab_comment' | 'book' | 'poem' | 'article' | 'screenplay' | 'profile'
  entity_id    uuid,
  post_id      uuid,   -- izohga deep-link uchun (postni ochib, izohgacha scroll)
  comment_id   uuid,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications(recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;

-- Qabul qiluvchi faqat o'zinikini ko'radi va o'qilgan deb belgilaydi
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (auth.uid() = recipient_id);

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- Kirgan user FAQAT o'zi "actor" bo'lgan bildirishnoma yarata oladi (mention/reply)
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert with check (auth.uid() = actor_id);

-- O'qilmaganlar sonini tez olish uchun (ixtiyoriy) RPC
create or replace function public.unread_notifications_count()
returns integer language sql security definer set search_path = public as $$
  select count(*)::int from public.notifications
  where recipient_id = auth.uid() and is_read = false;
$$;

grant select, update on public.notifications to authenticated;
grant execute on function public.unread_notifications_count() to authenticated;
```

### 📱 App prompt — A: notifications infratuzilma + ekran
```text
Loyiha: adabiyot-ai-main/expo.

MAQSAD: bildirishnoma (notifications) tizimini o'rnatish.

BAJAR:
1. hooks/useNotifications.ts yarat:
   - list(): `notifications` dan recipient_id=auth.uid() bo'yicha, created_at desc, limit 100.
   - actor ma'lumotini `mobile_public_profiles` dan join qil (avatar/ism).
   - unreadCount: o'qilmaganlar soni (RPC unread_notifications_count yoki count).
   - markRead(id) va markAllRead(): is_read=true.
   - createNotification({recipientId, type, title, body, entityType, entityId, postId, commentId}) — actor_id=auth.uid(). recipientId === auth.uid() bo'lsa O'TKAZIB YUBOR (o'zingga xabar kelmasin).
   - Realtime ixtiyoriy: supabase.channel('notifications') insert event'iga obuna bo'lib unreadCount'ni yangila.
2. app/notifications.tsx ekrani yarat (Stack, _layout.tsx ga HIDDEN_HEADER bilan qo'sh):
   - Sarlavha "Bildirishnomalar", "Hammasini o'qilgan qil" tugmasi.
   - Ro'yxat: avatar + matn ("X sizni izohda belgiladi", "X sizning izohingizga javob berdi", "X yangi asar joyladi", "Yangi kitob: ...") + nisbiy vaqt. O'qilmagan = nuqta/fon.
   - Bosilganda: markRead + deep-link:
       * type mention|comment_reply  → /(tabs)/sozlab?openPostId=<post_id>&focusCommentId=<comment_id>
       * type followed_new_post       → /(tabs)/sozlab?openPostId=<post_id>
       * type new_book|rating (entity)→ entity_type bo'yicha /book|/poem|/article|/screenplay/[id]
       * type new_follower            → /u/[id] (actor)
3. Bell tugmalarini ulash:
   - app/(tabs)/sozlab.tsx header Bell (~513): onPress → router.push('/notifications'); statik nuqtani unreadCount>0 bilan almashtir.
   - app/(tabs)/index.tsx notifications tugmasi (~819): xuddi shunday.
4. So'zLab tab'i `openPostId`/`focusCommentId` paramlarini o'qib, o'sha postning CommentSheet'ini avtomatik ochsin va izohga scroll qilsin (ScrollView ref + comment id bo'yicha).

TEKSHIRUV: tugma soni o'qilmaganlar bilan mos; bosilsa ekran ochiladi; element bosilsa to'g'ri joyga olib boradi; o'qilgach nuqta yo'qoladi.
```

### 📱 App prompt — B: `@` mention autocomplete + mention/reply notification
```text
Loyiha: adabiyot-ai-main/expo. Fayl: app/(tabs)/sozlab.tsx (CommentSheet input + ComposeSheet input).

MAQSAD: izoh/post yozayotganda `@` bilan foydalanuvchi belgilash; mention/javob bo'lsa notification yuborish.

BAJAR:
1. hooks/useMentionSearch.ts: `mobile_public_profiles` dan pen_name/display_name/full_name ILIKE %q% bo'yicha 8 ta natija (id, name, avatar, verification).
2. Mention autocomplete:
   - Input matnida kursordan oldingi `@token` ni aniqla (regex /@(\w[\w'.]*)$/).
   - token bo'lsa input ustida suzuvchi ro'yxat ko'rsat; tanlanganda `@name ` qo'shib, {id, name, start, end} ni `mentions` massivida sakla.
   - Yuborganda matnda `@name` ko'rinishida qolsin (oddiy text). Kim mention qilinganini `mentions` dagi userId lar bilan bilamiz.
3. Render: matндаги `@name` larни primary rangда ko'rsat (oddiy regex bilan bo'lib chiqarish) — bosilsa /u/[id] (agar id ma'lum bo'lsa).
4. Izoh yuborilгач (handleSend, 1-bo'limда .select().single() id qaytaradi):
   - Har bir mention uchun: createNotification({recipientId: mentionUserId, type:'mention', title: me.name, body: matn qisqasi, entityType:'sozlab_comment', entityId: commentId, postId, commentId}).
   - replyTarget bor va parent egasi (replyTarget.userId) men EMAS bo'lsa: createNotification({recipientId: replyTarget.userId, type:'comment_reply', ..., postId, commentId}).
   - Dublikat bo'lmasin: parentAuthor ham mention qilingan bo'lsa faqat bitta xabar.
5. Postlardagi (ComposeSheet) mention ham xuddi shunday — postdagi @mention → type:'mention', entityType:'sozlab_post', entityId/postId=postId.

ESLATMA: createNotification recipientId === auth.uid() bo'lsa o'tkazib yubor (o'zingга xabar kelmasin). RLS faqat actor_id=auth.uid() ga ruxsat beradi — bu mention/reply uchun yetarli.

TEKSHIRUV: B ni @ bilan belgila → B ning bildirishnomasiga "mention" keladi → bosilsa o'sha izoh ochiladi. A ga javob yoz → A ga "javob" xabari keladi.
```

### 🛠 Admin prompt
Kerak emas (mention/reply'ni app to'g'ridan-to'g'ri yozadi). Moderatsiya 1-bo'limdagi mavjud So'zLab moderatsiyasiga tegishli.

### ✅ Tekshiruv
- `@` → autocomplete; mention/reply → xabar; xabar bosilsa izohga olib boradi; o'zingga xabar kelmaydi.

---

## 4) Bildirishnomalar ishlashi: yangi kitob + kuzatilgan ijodkor yangi nimadir joylaganda

**Maqsad:** (a) Kuzatish (follow) tizimi. (b) Kuzatilayotgan ijodkor yangi So'zLab posti yoki yangi asar joylasa — kuzatuvchiga xabar. (c) Yangi kitob/she'r/maqola/ssenariy chiqqanda — muallifning kuzatuvchilariga xabar (+ ixtiyoriy admin broadcast).

> 3-bo'limdagi `notifications` jadvali shart. Bu yerda `user_follows` + DB trigger'lar qo'shiladi (trigger'lar `security definer` — RLS'ni chetlab xabar yaratadi).

### 🗄 SQL
```sql
-- ============================================================
-- 4) user_follows + trigger'lar (followed_new_post, new_book)
-- Safe to re-run. (Avval 3-bo'lim SQL ishga tushgan bo'lsin.)
-- ============================================================

-- 4.1 Kuzatish jadvali
create table if not exists public.user_follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists user_follows_following_idx on public.user_follows(following_id);

alter table public.user_follows enable row level security;
drop policy if exists user_follows_select on public.user_follows;
create policy user_follows_select on public.user_follows for select using (true);
drop policy if exists user_follows_write on public.user_follows;
create policy user_follows_write on public.user_follows
  for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- 4.2 Yangi follower bo'lganda → kuzatilganga xabar
create or replace function public.notify_new_follower()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(recipient_id, actor_id, type, title, entity_type, entity_id)
  values (new.following_id, new.follower_id, 'new_follower',
          (select coalesce(pen_name, display_name, full_name) from public.profiles where id = new.follower_id),
          'profile', new.follower_id);
  return new;
end $$;
drop trigger if exists trg_notify_new_follower on public.user_follows;
create trigger trg_notify_new_follower after insert on public.user_follows
  for each row execute function public.notify_new_follower();

-- 4.3 Kuzatilgan user yangi So'zLab posti joylaganda → kuzatuvchilarga xabar
create or replace function public.notify_followers_new_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.status,'published') <> 'published' then return new; end if;
  insert into public.notifications(recipient_id, actor_id, type, title, body, entity_type, entity_id, post_id)
  select f.follower_id, new.user_id, 'followed_new_post',
         (select coalesce(pen_name, display_name, full_name) from public.profiles where id = new.user_id),
         left(coalesce(new.content, new.body, ''), 120),
         'sozlab_post', new.id, new.id
  from public.user_follows f
  where f.following_id = new.user_id;
  return new;
end $$;
drop trigger if exists trg_notify_followers_new_post on public.sozlab_posts;
create trigger trg_notify_followers_new_post after insert on public.sozlab_posts
  for each row execute function public.notify_followers_new_post();

-- 4.4 Yangi kitob PUBLISHED bo'lganda → muallif kuzatuvchilariga xabar
-- (Muallif ismi profiles.full_name/pen_name bilan mos kelsa kuzatuvchilar topiladi.)
create or replace function public.notify_new_book_published()
returns trigger language plpgsql security definer set search_path = public as $$
declare author_profile uuid;
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    select id into author_profile from public.profiles
      where coalesce(pen_name, display_name, full_name) = new.author limit 1;
    if author_profile is not null then
      insert into public.notifications(recipient_id, actor_id, type, title, body, entity_type, entity_id)
      select f.follower_id, author_profile, 'new_book', 'Yangi asar', new.title, 'book', new.id
      from public.user_follows f where f.following_id = author_profile;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_new_book on public.books;
create trigger trg_notify_new_book after insert or update of status on public.books
  for each row execute function public.notify_new_book_published();

-- (Ixtiyoriy) poems jadvali uchun ham xuddi shunday trigger qo'shsa bo'ladi.
```

### 📱 App prompt
```text
Loyiha: adabiyot-ai-main/expo.

MAQSAD: kuzatish (follow) tugmasini ishlatish; bildirishnomalar 3-bo'limdagi ekranda ko'rinsin.

BAJAR:
1. hooks/useFollow.ts:
   - isFollowing(userId), followersCount(userId), followingCount(userId) — `user_follows` dan.
   - follow(userId): insert {follower_id: auth.uid(), following_id: userId}.
   - unfollow(userId): delete.
   - guest bo'lsa auth ekraniga yo'naltir.
2. app/u/[id].tsx ("Kuzatish"/"Kuzatilyapti" tugmasi) va profil ekranidagi follower/following sonlarini shu hookga ula. Hozir UI bor, lekin Supabase'ga ulanmagan — ulab qo'y.
3. Bildirishnomalar ekrani (3-bo'limda yaratilgan) followed_new_post / new_follower / new_book turlarini ham ko'rsatadi — qo'shimcha ish shart emas, faqat matnlar to'g'ri bo'lsin.
4. Realtime (ixtiyoriy): notifications insert'ga obuna — yangi xabar kelганда Bell nuqtasi yangilansin.

TEKSHIRUV: A, B akkountlar. B → A ni kuzatadi: A ga "yangi follower" keladi. A So'zLabга post yozadi: B ga "followed_new_post" keladi, bosilsa post ochiladi. Admin yangi kitobni "published" qilsa, muallifning kuzatuvchilariga "new_book" keladi.
```

### 🛠 Admin prompt (ixtiyoriy — "barcha foydalanuvchilarga e'lon")
```text
Loyiha: adabiyot-ai-admin. Maqsad: katta e'lonlarni hammaga yuborish (broadcast).

BAJAR (ixtiyoriy):
1. SQL: security-definer funksiya broadcast_notification(p_title text, p_body text, p_entity_type text, p_entity_id uuid) — barcha profiles uchun notifications insert qiladi (type='system'/'new_book').
2. app/settings yoki yangi app/broadcast/page.tsx: admin sarlavha+matn kiritib, RPC chaqiradi. Faqat is_admin/super_admin uchun.
Eslatma: bu IXTIYORIY — asosiy follow-asosli xabarlar trigger orqali avtomatik ishlaydi.
```

### ✅ Tekshiruv
- Follow → "yangi follower"; kuzatilgan post → "followed_new_post"; kitob published → "new_book".

---

## 5) She'r o'qish sahifasini yaxshilash (premium, minimalistik) + "Ijodni boshlash"

**Talablar (foydalanuvchi):**
1. Tepadagi **"She'r sahifasi"** yozuvi olib tashlansin.
2. **Muallif sarlavhadan TEPADA** tursin.
3. "Ijro uchun ... bepul" joyiga **tugma**: *"Ushbu she'r bilan ijodni boshlash"*. Ijodkor akkount bo'lsa — shu she'rga **monolog yoki video reels** yuborishi mumkin; hammasi **admin panelda tasdiqlanadi**.
4. Sahifa **premium, professional, minimalistik** bo'lsin.
5. "Asar haqida" ma'lumotlari sahifadan **olib tashlansin** YOKI tepadagi zoom in/out yonidagi **"i" (info) tugmasi** bosilganda **markazdan** chiqadigan oynada ko'rsatilsin.

**Fayl:** `app/poem/[id].tsx`. Hozir: kicker "She'r sahifasi" (613), title→author tartibi (614–615), `metaCard` "Asar haqida" (637–658), `licenseCard` (660–666), top zoom A-/A+ (589–609).

### 🗄 SQL
```sql
-- ============================================================
-- 5) creator_media_submissions ni she'rga (kontentga) bog'lash
-- Safe to re-run.
-- ============================================================
alter table public.creator_media_submissions add column if not exists related_content_type  text;
alter table public.creator_media_submissions add column if not exists related_content_id    uuid;
alter table public.creator_media_submissions add column if not exists related_content_title text;

create index if not exists creator_media_related_idx
  on public.creator_media_submissions(related_content_type, related_content_id, status);

-- RLS: kirgan ijodkor o'z submission'ini yaratadi/ko'radi (mavjud bo'lmasa)
alter table public.creator_media_submissions enable row level security;
drop policy if exists creator_media_insert on public.creator_media_submissions;
create policy creator_media_insert on public.creator_media_submissions
  for insert with check (auth.uid() = user_id);
drop policy if exists creator_media_select_own on public.creator_media_submissions;
create policy creator_media_select_own on public.creator_media_submissions
  for select using (auth.uid() = user_id);
```

### 📱 App prompt
```text
Loyiha: adabiyot-ai-main/expo. Fayl: app/poem/[id].tsx (+ app/creator/submit.tsx).

MAQSAD: she'r o'qish sahifasini premium/minimalistik qilish va "Ijodni boshlash" oqimini qo'shish.

BAJAR — sahifa dizayni:
1. Kicker "She'r sahifasi" (heroWrap ichidagi `styles.kicker` Text, ~613) ni BUTUNLAY o'chir.
2. Hero tartibini o'zgartir: MUALLIF (kichik, primary rang) — sarlavhadan TEPADA; keyin katta serif TITLE; keyin moodLine. (Hozir title→author; teskari qil.)
3. "Asar haqida" metaCard (637–658) ni sahifa tanasidan OLIB TASHLA. O'rniga top bar'ga, A-/A+ yonига, "i" (Info, lucide `Info`) tugmasi qo'sh. Bosilganda MARKAZDAN chiqadigan modal (animationType="fade", markazda card) — ichida: Sana, Muallif, Nashr, "Mualliflik sertifikatiga ega" pill. Modalni tashqarisiga bosib yopish.
4. licenseCard (660–666) ni qayta ishла: minimal "Ijro uchun: bepul / <narx>" satri + ostida ASOSIY tugma "Ushbu she'r bilan ijodni boshlash" (PressableScale, primary, Feather/Sparkles ikonka). Eski "SHERNI HARID QILISH" tugmasini saqla, lekin ikkinchi darajali (outline) ko'rinishда.
5. Umumiy premium polish: ko'proq oq bo'shliq, yengil shadow, serif sarlavha (FONT.serif), bitta accent rang (primary). Dark mode useTheme orqali (hozir createStyles faqat palette oladi — isDark qo'shsang yaxshi). Ortiqcha bezakларni kamaytир.

BAJAR — "Ijodni boshlash" oqimi:
6. "Ushbu she'r bilan ijodni boshlash" bosilganda:
   - profile.accountType creator/creator_adib BO'LSA → router.push({ pathname:'/creator/submit', params:{ relatedType:'poem', relatedId: vm.id, relatedTitle: vm.title } }).
   - aks holda → /creator/become (ijodkor bo'lishga taklif) modal/ekrani.
7. app/creator/submit.tsx ni Supabase'ga ula (hozir mock setTimeout):
   - useLocalSearchParams: relatedType, relatedId, relatedTitle ni o'qi; ekran tepasida "<title> uchun ijro" deб ko'rsat.
   - media turi: faqat 'monologue' va 'reel' (video) tanlovi (she'r konteksti uchun).
   - handleSubmit: insert into creator_media_submissions { user_id: auth.uid(), media_type, title, description, media_url (agar yuklash bo'lsa), status:'pending', related_content_type:'poem', related_content_id, related_content_title }.
   - media_url uchun fayl yuklash: lib/media.ts/storage'dan foydalan (mavjud uploadProfileImage uslubida). MVP'da link bilan ham bo'ladi.
   - Muvaffaqiyat: "Yuborildi! Admin 1–3 kunda ko'rib chiqadi" (mavjud success UI).
   - Tarix tab'i: shu user'ning creator_media_submissions yozuvlari (status badge bilan).

TEKSHIRUV: She'r sahifasi tepasida "She'r sahifasi" yo'q; muallif sarlavha tepasида; "i" bosilsa markazдан ma'lumot oynаси; "Ijodni boshlash" → ijodkor bo'lsa submit ekrani (she'r konteksti bilan), bo'lmasa "ijodkor bo'lish". Submission Supabase'ga 'pending' bo'lib tushadi.
```

### 🛠 Admin prompt
```text
Loyiha: adabiyot-ai-admin. Fayllar: app/creator-media/page.tsx, lib/supabase/creator-media.ts.

MAQSAD: she'rga biriktirilgan monolog/reel submission'larни ko'rish va tasdiqlash/rad etish.

BAJAR:
1. lib/supabase/creator-media.ts: CreatorMediaSubmission interfeysiga related_content_type, related_content_id, related_content_title qo'sh; select('*') allaqachon hammasini oladi — mapping'ga qo'sh.
2. app/creator-media/page.tsx: har bir submission kartochkasida "Biriktirilgan asar: <related_content_title> (she'r)" ni ko'rsat. media_type='monologue'|'reel' uchun badge.
3. Filtrlar: media_type va related_content_type bo'yicha. status='pending' birinchi.
4. Tasdiqlash (approveSubmission) bosilganda status='approved'; rad etishда rejection_reason. Mavjud approve/reject oqimини qoldир — faqat related kontent ko'rinsin.
5. (Ixtiyoriy) approved monolog/reel'ni `reels` yoki `creator_media`га publish qilish — agar mavjud oqim bo'lsa, related_content_type/id ni o'tkaz, токи app'da she'r sahifasидаги "Monologlar"/"Videolar" bo'limида chiqsин.

TEKSHIRUV: app'дан yuborilган she'r-monolog admin'да "pending" bo'lib ko'rinади, biriktирилган she'r nomi bilan; tasдиqласа status approved bo'lади.
```

### ✅ Tekshiruv
- Premium sahifa; "i" modal markazда; ijodkor submit → admin pending → tasdiqlash.

---

## 6) Har bir asar sahifasида 5-yulduzли baho + izoh → So'zLabга ko'chirish

**Maqsad:** Kitob, She'r, Maqola, Ssenariy — har birining alohida (preview) sahifasida **5 yulduz baho** va **izoh** qoldirish. Har bir izoh **bahosi bilan birga So'zLabга ham** o'tkazilsin (post sifatида). Aniq, muammosiz ishlasин.

**Fayllar:** `app/book/[id].tsx`, `app/poem/[id].tsx`, `app/article/[id].tsx`, `app/screenplay/[id].tsx`.

### 🗄 SQL
```sql
-- ============================================================
-- 6) content_ratings (5 yulduz + izoh) + agregат view
-- Safe to re-run.
-- ============================================================
create table if not exists public.content_ratings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  content_type       text not null check (content_type in ('book','poem','article','screenplay')),
  content_id         uuid not null,
  content_title      text,
  content_author     text,
  content_cover_url  text,
  rating             int  not null check (rating between 1 and 5),
  review             text,
  sozlab_post_id     uuid references public.sozlab_posts(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, content_type, content_id)   -- har user har asarга bitta baho (qayta baholash = update)
);
create index if not exists content_ratings_content_idx on public.content_ratings(content_type, content_id);

alter table public.content_ratings enable row level security;
drop policy if exists content_ratings_select on public.content_ratings;
create policy content_ratings_select on public.content_ratings for select using (true);
drop policy if exists content_ratings_write on public.content_ratings;
create policy content_ratings_write on public.content_ratings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Agregат: o'rtacha baho + soni
create or replace view public.content_rating_stats as
select content_type, content_id,
       round(avg(rating)::numeric, 2) as avg_rating,
       count(*)                       as ratings_count
from public.content_ratings
group by content_type, content_id;

grant select on public.content_rating_stats to anon, authenticated;
```

### 📱 App prompt
```text
Loyiha: adabiyot-ai-main/expo. Fayllar: app/book/[id].tsx, app/poem/[id].tsx, app/article/[id].tsx, app/screenplay/[id].tsx + yangi components/RatingReviewBlock.tsx + hooks/useContentRating.ts.

MAQSAD: har bir asar sahifasида 5-yulduz baho + izoh; izoh bahosi bilan So'zLabga ham post bo'lib tushadi.

BAJAR:
1. hooks/useContentRating.ts(contentType, contentId):
   - stats: content_rating_stats dan { avgRating, ratingsCount }.
   - myRating: content_ratings dan auth.uid() + content bo'yicha (bor bo'lsa rating/review).
   - recentReviews: content_ratings dan shu content uchun oxirgi 10 ta (review!=null), author join (mobile_public_profiles).
   - submit({rating, review, contentMeta}):
       a) upsert content_ratings { user_id:auth.uid(), content_type, content_id, content_title, content_author, content_cover_url, rating, review } onConflict (user_id,content_type,content_id).
       b) review bo'sh bo'lmasa: insert sozlab_posts {
            user_id: auth.uid(), title: deriveTitle(review), content: review, post_type:'review', status:'published',
            attached_content_id: content_id, attached_content_type: content_type,
            attached_content_title: content_title, attached_content_cover_url: content_cover_url,
            attached_content_author: content_author }  → .select('id').single().
          Yulduz sonини post matни boshiga "★★★★★" yoki metadata sifatида qo'sh (So'zLabда baho ko'rinsин).
       c) content_ratings.sozlab_post_id = post.id (update).
       d) guest bo'lsa auth ekraniga.
   - Idempotent: qayta baho berса content_ratings UPDATE bo'lsин; har safar yangi So'zLab post yaratmaslik uchun — agar sozlab_post_id bor bo'lsa, eski postni UPDATE qil (content/baho), yangi yaratма.
2. components/RatingReviewBlock.tsx (theme pattern bilan):
   - Tepada: katta avg_rating + yulduzlar + "(N baho)".
   - Interaktив 5 yulduz (tanlash), TextInput "Fikringiz...", "Baholash" tugmasi (PressableScale qoidalarига rioya).
   - myRating bor bo'lsa: "Siz N yulduz berdingiz" + Tahrirlash.
   - Ostида recentReviews ro'yxati (avatar, ism, yulduz, matn, vaqt). Har biri bosilsa /u/[id].
3. Har 4 ekranga (book/poem/article/screenplay [id].tsx) RatingReviewBlock'ni mos contentType bilan joylashtir (kontent ostida, premium card). poem/[id].tsx da 5-bo'limдаги yangi dizaynga mos joyga qo'y.
4. content_title/author/cover'ni har ekrandagi mavjud vm/book ma'lumotidан uzat.

TEKSHIRUV: Kitob sahifasида 4 yulduz + izoh ber → saqlangani ko'rinади (avg yangilanади). So'zLabга o'sha izoh '★★★★ + matn' bo'lib, kitob biriktмаси bilan tushади (2-bo'lim tuzatиlgani uchun biriktма bosilsa kitob ochilади). Qayta baholaganда dublikat post yaratилmaydi (update). She'r/Maqola/Ssenariyда ham aynan shunday.
```

### 🛠 Admin prompt
```text
Loyiha: adabiyot-ai-admin.

MAQSAD: bahо+izohlar So'zLab postlari sifatида allaqачon moderatsiyадан o'tади (sozlab_posts). Qo'shimча:
1. (Ixtiyoriy) lib/supabase ga content-ratings.ts: content_ratings'ни o'qish; app/<bo'lim> da asar bo'yicha o'rtача baho + izohlar sonини ko'rsатиш (books/poems/articles/screenplays detail sahifаларида "O'rtача baho: 4.3 (12)").
2. Moderatsiya: review-type postlar sozlab moderatsияsида ko'rinади — alohида ish shart emas. Истасангиз filter qo'sh: post_type='review'.

TEKSHIRUV: app'дан berилган baho admin'да asar reytingида aks etади; izoh So'zLab moderatsияsида ko'rinади.
```

### ✅ Tekshiruv
- 4 turdаги sahifада baho+izoh; avg yangиланади; izoh So'zLabга biriktма bilan tushади; qayta baho = update (dublikat yo'q).

---

## Yakuniy eslатмалар

- **Bog'liqlik:** 3-bo'lim (`notifications`) 4-bo'limдан oldин. 2-bo'lim 6-bo'limга yordам беради (So'zLabга tushган baho-izoh biriktмаси to'g'ri ochилиши uchun).
- **RLS:** barcha yangi jadvаллар RLS bilan; mention/reply'ни app yozади (actor=auth.uid()), system/follow/new_book'ни trigger (security definer) yozади.
- **Guest holати:** har bir yozиш amалидан oldин `useAuth().userId` tekshирилсин; null bo'lsа auth ekranига.
- **Idempotent SQL:** hammаси "Safe to re-run" — Supabase SQL Editor'га ketма-ket qo'yиб ishga tushिринг.
```
