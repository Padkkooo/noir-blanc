-- ============================================================
--  Noir&Blanc — схема базы данных PostgreSQL
--  Запуск: psql -U postgres -d noir_blanc -f db/schema.sql
--  Скрипт можно запускать повторно: он не удаляет данные.
-- ============================================================

-- ---------- Справочник брендов ----------
CREATE TABLE IF NOT EXISTS brands (
    brandid    serial PRIMARY KEY,
    brandname  varchar(100) NOT NULL UNIQUE
);

-- ---------- Товары (парфюмерия) ----------
CREATE TABLE IF NOT EXISTS perfumes (
    perfumeid   serial PRIMARY KEY,
    brandid     integer NOT NULL REFERENCES brands(brandid),
    name        varchar(150) NOT NULL,
    type        varchar(50)  NOT NULL,
    gender      varchar(30)  NOT NULL,
    volume      integer      NOT NULL CHECK (volume > 0),
    price       numeric(10,2) NOT NULL CHECK (price >= 0),
    description text,
    image       varchar(255),
    createdat   timestamptz  NOT NULL DEFAULT now()
);

-- На случай, если таблица уже была создана старой версией скрипта
ALTER TABLE perfumes ADD COLUMN IF NOT EXISTS image varchar(255);
ALTER TABLE perfumes ADD COLUMN IF NOT EXISTS createdat timestamptz NOT NULL DEFAULT now();

-- ---------- Пользователи ----------
CREATE TABLE IF NOT EXISTS users (
    userid       serial PRIMARY KEY,
    fullname     varchar(120) NOT NULL,
    email        varchar(255) NOT NULL UNIQUE,
    passwordhash text         NOT NULL,
    createdat    timestamptz  NOT NULL DEFAULT now()
);

-- ---------- Сессии (вход по cookie) ----------
CREATE TABLE IF NOT EXISTS sessions (
    token      text PRIMARY KEY,
    userid     integer NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    expiresat  timestamptz NOT NULL,
    createdat  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_userid_idx ON sessions(userid);

-- ---------- Корзина (хранится на сервере) ----------
CREATE TABLE IF NOT EXISTS cart_items (
    userid     integer NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
    perfumeid  integer NOT NULL REFERENCES perfumes(perfumeid) ON DELETE CASCADE,
    quantity   integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    updatedat  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (userid, perfumeid)
);
CREATE INDEX IF NOT EXISTS cart_items_userid_idx ON cart_items(userid);

-- ---------- Заказы ----------
CREATE TABLE IF NOT EXISTS orders (
    orderid      serial PRIMARY KEY,
    userid       integer NOT NULL REFERENCES users(userid),
    orderdate    timestamptz NOT NULL DEFAULT now(),
    status       varchar(30) NOT NULL DEFAULT 'Новый',
    totalamount  numeric(12,2) NOT NULL CHECK (totalamount >= 0),
    customername varchar(120) NOT NULL,
    phone        varchar(40)  NOT NULL,
    email        varchar(255) NOT NULL,
    delivery     varchar(50)  NOT NULL,
    address      text         NOT NULL,
    payment      varchar(50)  NOT NULL,
    comment      text
);
CREATE INDEX IF NOT EXISTS orders_userid_idx ON orders(userid);

-- ---------- Состав заказа ----------
CREATE TABLE IF NOT EXISTS order_items (
    orderitemid serial PRIMARY KEY,
    orderid     integer NOT NULL REFERENCES orders(orderid) ON DELETE CASCADE,
    perfumeid   integer NOT NULL REFERENCES perfumes(perfumeid),
    quantity    integer NOT NULL CHECK (quantity > 0),
    unitprice   numeric(12,2) NOT NULL CHECK (unitprice >= 0)
);
CREATE INDEX IF NOT EXISTS order_items_orderid_idx ON order_items(orderid);

-- ---------- Сообщения из формы «Свяжитесь с нами» ----------
CREATE TABLE IF NOT EXISTS contact_messages (
    messageid  serial PRIMARY KEY,
    name       varchar(120) NOT NULL,
    email      varchar(255) NOT NULL,
    message    text         NOT NULL,
    status     varchar(30)  NOT NULL DEFAULT 'Новое',
    createdat  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_messages_createdat_idx ON contact_messages(createdat DESC);

-- ============================================================
--  Начальные данные: бренды и 8 ароматов из каталога
-- ============================================================
INSERT INTO brands (brandid, brandname) VALUES
    (17, 'AJMAL'),
    (18, 'CITY'),
    (19, 'FRANCK BOCLET'),
    (20, 'HFC'),
    (21, 'KOKESHI'),
    (22, 'MAISON DE L ASIE'),
    (23, 'MARK BUXTON'),
    (24, 'RHIZOME')
ON CONFLICT (brandid) DO NOTHING;

INSERT INTO perfumes (perfumeid, brandid, name, type, gender, volume, price, description, image) VALUES
    (1, 24, 'RHIZOME 04', 'Парфюмерная вода', 'Унисекс', 100, 6380.00,
     'Древесный аромат с нотами лаванды, уда, табака, кедра, ветивера, амбры, сандала и белого мускуса.',
     'media/RHIZOME 04.jpg'),
    (2, 18, 'CITY FUNNY PRINCESS', 'Туалетная вода', 'Детский', 30, 424.00,
     'Фруктовый аромат с нотами клубники и сахара, молочным аккордом, пломбиром, мускусом и ванильным мороженым.',
     'media/CITY FUNNY PRINCESS.webp'),
    (3, 22, 'MAISON DE L ASIE Les Nuits De Bal', 'Парфюмерия', 'Унисекс', 100, 21725.00,
     'Восточный аромат с нотами шафрана, пачули, ванили, розы, амбры, уда, сандала и дубового мха.',
     'media/MAISON DE L ASIE Les Nuits De Bal.jpg'),
    (4, 23, 'MARK BUXTON Dreaming with Ghosts', 'Парфюмерная вода', 'Мужской', 100, 13173.00,
     'Аромат с нотами бархатцев, айвы, пиона, кожи, ветивера и ванили.',
     'media/MARK BUXTON Dreaming with Ghosts.webp'),
    (5, 19, 'FRANCK BOCLET Eccentric', 'Духи', 'Мужской', 100, 17850.00,
     'Аромат с нотами бергамота, мандарина, звездчатого аниса, вишни, ириса, непальского сандала, ванили и мускуса.',
     'media/FRANCK BOCLET Eccentric.webp'),
    (6, 20, 'HFC PROPOSAL', 'Парфюмерная вода', 'Женский', 75, 33600.00,
     'Чувственный аромат с нотами бергамота, миндаля, чёрной смородины, чёрного чая, жасмина, личи, мускуса, ириса и ванили.',
     'media/HFC PROPOSAL.jpg'),
    (7, 21, 'KOKESHI LOTUS', 'Туалетная вода', 'Детский', 50, 2925.00,
     'Цветочный аромат с нотами фрезии, белых цветов, свежести, белой древесины и мускуса.',
     'media/KOKESHI LOTUS.jpg'),
    (8, 17, 'AJMAL ARISTOCRAT HER', 'Парфюмерная вода', 'Женский', 75, 10625.00,
     'Цветочно-амбровый аромат. Верхние ноты: бергамот, апельсин, бархатцы. Средние: шафран, жасмин, фиалка. Базовые: кедр, пачули, мускус, амбра, дубовый мох.',
     'media/AJMAL ARISTOCRAT HER.jpg')
ON CONFLICT (perfumeid) DO NOTHING;

-- После вставки с явными id «подкручиваем» счётчики serial,
-- чтобы новые записи не конфликтовали с существующими.
SELECT setval(pg_get_serial_sequence('brands', 'brandid'),
              COALESCE((SELECT MAX(brandid) FROM brands), 1));
SELECT setval(pg_get_serial_sequence('perfumes', 'perfumeid'),
              COALESCE((SELECT MAX(perfumeid) FROM perfumes), 1));
