SET client_encoding = 'UTF8';

-- Журнал событий входа: фиксируем успешные и неуспешные попытки
CREATE TABLE IF NOT EXISTS security_events (
    eventid    serial PRIMARY KEY,
    email      varchar(255) NOT NULL,
    eventtype  varchar(30)  NOT NULL CHECK (eventtype IN ('login_failed', 'login_success')),
    ip         varchar(45),
    eventtime  timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_email_time_idx
    ON security_events (email, eventtime DESC);

-- Заблокированные учётные записи
CREATE TABLE IF NOT EXISTS blocked_users (
    email        varchar(255) PRIMARY KEY,
    blockeduntil timestamptz  NOT NULL,
    reason       varchar(255) NOT NULL,
    createdat    timestamptz  NOT NULL DEFAULT now()
);

-- Пять неудачных попыток за 10 минут блокируют вход на 30 минут
CREATE OR REPLACE FUNCTION block_after_failed_logins()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_fail_count INTEGER;
BEGIN
    IF NEW.eventtype <> 'login_failed' THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_fail_count
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

-- Проверка блокировки перед входом (вызывается из auth.js)
CREATE OR REPLACE FUNCTION is_user_blocked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM blocked_users
        WHERE email = p_email AND blockeduntil > now()
    );
$$;

-- Демонстрация: пять неудачных попыток для тестовой учётной записи
DELETE FROM security_events WHERE email = 'blocked@example.com';
DELETE FROM blocked_users WHERE email = 'blocked@example.com';
INSERT INTO security_events (email, eventtype, ip) VALUES
    ('blocked@example.com', 'login_failed', '192.168.1.10'),
    ('blocked@example.com', 'login_failed', '192.168.1.10'),
    ('blocked@example.com', 'login_failed', '192.168.1.10'),
    ('blocked@example.com', 'login_failed', '192.168.1.10'),
    ('blocked@example.com', 'login_failed', '192.168.1.10');

SELECT email, blockeduntil, reason
FROM blocked_users
WHERE email = 'blocked@example.com';

SELECT is_user_blocked('blocked@example.com') AS blocked;
