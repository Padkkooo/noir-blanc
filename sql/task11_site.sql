SET client_encoding = 'UTF8';

-- Задание 11. Автоматическое блокирование пользователей
-- Рабочая база данных сайта Noir&Blanc: noir_blanc

CREATE TABLE IF NOT EXISTS security_events (
    eventid    serial PRIMARY KEY,
    email      varchar(255) NOT NULL,
    eventtype  varchar(30)  NOT NULL
        CHECK (eventtype IN ('login_failed', 'login_success')),
    ip         varchar(45),
    useragent  varchar(255),
    eventtime  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_email_time_idx
    ON security_events (email, eventtime DESC);

CREATE TABLE IF NOT EXISTS blocked_users (
    email        varchar(255) PRIMARY KEY,
    blockeduntil timestamptz  NOT NULL,
    reason       varchar(255) NOT NULL,
    createdat    timestamptz  NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION block_after_failed_logins()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_fail_count integer;
BEGIN
    IF NEW.eventtype <> 'login_failed' THEN
        RETURN NEW;
    END IF;

    SELECT count(*) INTO v_fail_count
    FROM security_events
    WHERE email = NEW.email
      AND eventtype = 'login_failed'
      AND eventtime > now() - interval '10 minutes';

    IF v_fail_count >= 5 THEN
        INSERT INTO blocked_users (email, blockeduntil, reason)
        VALUES (NEW.email, now() + interval '30 minutes',
                '5 неудачных попыток входа за 10 минут')
        ON CONFLICT (email) DO UPDATE
            SET blockeduntil = EXCLUDED.blockeduntil,
                reason = EXCLUDED.reason,
                createdat = now();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_after_failed_logins ON security_events;
CREATE TRIGGER trg_block_after_failed_logins
AFTER INSERT ON security_events
FOR EACH ROW
EXECUTE FUNCTION block_after_failed_logins();

CREATE OR REPLACE FUNCTION is_user_blocked(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM blocked_users
        WHERE email = p_email
          AND blockeduntil > now()
    );
$$;

-- Проверка на тестовом адресе, не связанном с реальным пользователем
DELETE FROM security_events WHERE email = 'blocked@example.com';
DELETE FROM blocked_users WHERE email = 'blocked@example.com';

INSERT INTO security_events (email, eventtype, ip, useragent) VALUES
    ('blocked@example.com', 'login_failed', '192.168.1.10', 'Mozilla/5.0 test'),
    ('blocked@example.com', 'login_failed', '192.168.1.10', 'Mozilla/5.0 test'),
    ('blocked@example.com', 'login_failed', '192.168.1.10', 'Mozilla/5.0 test'),
    ('blocked@example.com', 'login_failed', '192.168.1.10', 'Mozilla/5.0 test'),
    ('blocked@example.com', 'login_failed', '192.168.1.10', 'Mozilla/5.0 test');

SELECT email, blockeduntil, reason
FROM blocked_users
WHERE email = 'blocked@example.com';

SELECT is_user_blocked('blocked@example.com') AS blocked;
