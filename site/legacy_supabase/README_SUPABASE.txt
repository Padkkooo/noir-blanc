NOIR&BLANC — подключение к Supabase

1. Создайте проект на Supabase.
2. Откройте SQL Editor и выполните полностью файл supabase.sql.
3. В Supabase -> Connect возьмите Project URL и Publishable key (или старый anon key).
4. Откройте supabase-config.js и вставьте их вместо YOUR_SUPABASE_URL и YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY. Публиковать service_role key НЕЛЬЗЯ.
5. Если хотите, чтобы после регистрации пользователь сразу входил без подтверждения почты: Authentication -> Providers -> Email -> отключите Confirm email. Иначе после регистрации нужно подтвердить письмо.
6. Открывайте index.html. Supabase работает из браузера, а сессия Auth сохраняется в localStorage.

Что работает:
- регистрация через Supabase Auth;
- вход и сохранение сессии;
- корзина в таблице cart_items, отдельно для каждого пользователя;
- оформление заказа в orders + order_items;
- после заказа корзина очищается.

Важно: для браузера используется только Publishable/anon key. service_role key в HTML/JS вставлять нельзя.


НОВЫЕ ФУНКЦИИ
- В parfum.html добавлены поиск по названию и фильтр по бренду.
- Добавлена страница order-history.html с заказами текущего пользователя и составом заказа.
- Корзина и оформление заказа сохранены без замены.
- История использует существующие таблицы orders и order_items, которые создаются скриптом supabase.sql.
- Добавлены ссылки на корзину и историю заказов в навигацию.
