-- Lịch sử hội thoại với trợ lý ảo.
--
-- Khác với dữ liệu nghiệp vụ (nông hộ, thửa ruộng) vốn dùng chung trong hợp tác xã,
-- câu hỏi người ta gõ cho trợ lý mang tính riêng tư: có thể là đang dò xem mình làm
-- sai chỗ nào. Nên phạm vi ở đây hẹp hơn mọi bảng khác — chỉ đúng chủ hội thoại đọc
-- được, đồng nghiệp cùng HTX và cả quản trị nền tảng đều không.

create type chat_role as enum ('user', 'assistant');

create table chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  -- Chụp lại HTX tại thời điểm trò chuyện. Người dùng chuyển HTX thì hội thoại cũ
  -- vẫn cho biết nó nói về đơn vị nào.
  cooperative_id uuid references cooperatives (id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_user_idx on chat_conversations (user_id, updated_at desc);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role chat_role not null,
  content text not null,
  -- Tên công cụ và tham số đã dùng để dựng câu trả lời này. Không lưu dữ liệu trả
  -- về (có thể rất lớn và đã nằm sẵn ở bảng gốc), chỉ đủ để sau này truy được vì
  -- sao trợ lý nói ra một con số.
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_idx on chat_messages (conversation_id, created_at);

alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;

create policy chat_conversations_own on chat_conversations for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy chat_messages_own on chat_messages for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Policy trên chỉ buộc `user_id` phải là chính mình; nó không ngăn được việc chèn
-- tin nhắn vào hội thoại của người khác. Không rò rỉ dữ liệu (đọc vẫn lọc theo
-- user_id) nhưng làm bẩn hội thoại người khác, nên chặn ngay tại đây.
create function guard_chat_message_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.chat_conversations
    where id = new.conversation_id and user_id = new.user_id
  ) then
    raise exception 'Tin nhắn không thuộc hội thoại của người gửi';
  end if;
  return new;
end;
$$;

create trigger chat_messages_guard_owner
  before insert on chat_messages
  for each row execute function guard_chat_message_owner();

-- Đưa hội thoại vừa có tin nhắn lên đầu danh sách.
create function touch_chat_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.chat_conversations
    set updated_at = now()
  where id = new.conversation_id and user_id = new.user_id;
  return new;
end;
$$;

create trigger chat_messages_touch_conversation
  after insert on chat_messages
  for each row execute function touch_chat_conversation();

revoke all on function guard_chat_message_owner() from public;
revoke all on function touch_chat_conversation() from public;
