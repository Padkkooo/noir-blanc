SET client_encoding = 'UTF8';

-- Учебные пользователи (пароли приведены в виде демонстрационного хеша)
INSERT INTO users (fullname, email, passwordhash) VALUES
    ('Лаура Шукенова', 'laura@example.com', 'scrypt$demo$7f4b1c9a'),
    ('Тестовый покупатель', 'buyer@example.com', 'scrypt$demo$2c8e6d10'),
    ('Менеджер магазина', 'manager@example.com', 'scrypt$demo$5a1f3e72')
ON CONFLICT (email) DO NOTHING;

-- Два демонстрационных заказа
WITH u AS (
    SELECT userid FROM users WHERE email = 'laura@example.com'
), new_order AS (
    INSERT INTO orders (userid, customername, phone, email, delivery, address, payment, status, totalamount)
    SELECT userid, 'Лаура Шукенова', '+7 (900) 123-45-67', 'laura@example.com',
           'Курьером', 'г. Энгельс, ул. Театральная, д. 10', 'Картой онлайн', 'Новый', 0
    FROM u
    RETURNING orderid
)
INSERT INTO order_items (orderid, perfumeid, quantity, unitprice)
SELECT o.orderid, p.perfumeid, 1, p.price
FROM new_order o
JOIN perfumes p ON p.name = 'LOTUS';

WITH u AS (
    SELECT userid FROM users WHERE email = 'buyer@example.com'
), new_order AS (
    INSERT INTO orders (userid, customername, phone, email, delivery, address, payment, status, totalamount)
    SELECT userid, 'Тестовый покупатель', '+7 (900) 765-43-21', 'buyer@example.com',
           'Самовывоз', 'г. Энгельс, ул. Театральная, д. 10', 'При получении', 'Оплачен', 0
    FROM u
    RETURNING orderid
)
INSERT INTO order_items (orderid, perfumeid, quantity, unitprice)
SELECT o.orderid, p.perfumeid, 2, p.price
FROM new_order o
JOIN perfumes p ON p.name = 'RHIZOME 04';

-- Пересчёт итогов после вставки позиций
UPDATE orders o
SET totalamount = COALESCE((
    SELECT SUM(oi.quantity * oi.unitprice)
    FROM order_items oi
    WHERE oi.orderid = o.orderid
), 0);

INSERT INTO contact_messages (name, email, message, status) VALUES
    ('Лаура Шукенова', 'laura@example.com', 'Подскажите, есть ли аромат RHIZOME 04 в наличии?', 'Новое');
