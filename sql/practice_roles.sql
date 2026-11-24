SET client_encoding = 'UTF8';

-- Базовые роли создаются без входа в систему: вход выполняет приложение
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noir_viewer') THEN
        CREATE ROLE noir_viewer NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noir_manager') THEN
        CREATE ROLE noir_manager NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noir_admin') THEN
        CREATE ROLE noir_admin NOLOGIN;
    END IF;
END;
$$;

-- Иерархия: администратор наследует права менеджера, менеджер — права просмотра
GRANT noir_viewer TO noir_manager;
GRANT noir_manager TO noir_admin;

GRANT USAGE ON SCHEMA public TO noir_viewer, noir_manager, noir_admin;

-- Роль просмотра: только чтение справочников и каталога
GRANT SELECT ON brands, perfumes TO noir_viewer;

-- Роль менеджера: заказы, состав заказов и чтение данных покупателя без пароля
GRANT SELECT, INSERT, UPDATE, DELETE ON orders, order_items TO noir_manager;
GRANT SELECT (userid, fullname, email) ON users TO noir_manager;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO noir_manager;

-- Управление карточкой товара: можно менять название и описание, но не цену
REVOKE UPDATE ON perfumes FROM noir_manager;
GRANT UPDATE (name, description, price) ON perfumes TO noir_manager;
REVOKE UPDATE (price) ON perfumes FROM noir_manager;

-- Администратор БД: полный доступ к объектам учебной базы
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO noir_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO noir_admin;
