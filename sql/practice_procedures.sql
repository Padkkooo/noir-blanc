SET client_encoding = 'UTF8';

-- Хранимая процедура добавляет позицию в заказ и берёт цену из perfumes
CREATE OR REPLACE PROCEDURE add_order_item(
    p_orderid   INT,
    p_perfumeid INT,
    p_quantity  INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_price NUMERIC(10,2);
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Количество должно быть больше нуля';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM orders WHERE orderid = p_orderid) THEN
        RAISE EXCEPTION 'Заказ не найден';
    END IF;

    SELECT price INTO v_price
    FROM perfumes
    WHERE perfumeid = p_perfumeid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Парфюм не найден';
    END IF;

    INSERT INTO order_items (orderid, perfumeid, quantity, unitprice)
    VALUES (p_orderid, p_perfumeid, p_quantity, v_price);
END;
$$;

-- Триггер пересчитывает итоговую сумму заказа после изменения состава
CREATE OR REPLACE FUNCTION update_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        UPDATE orders
        SET totalamount = COALESCE((
            SELECT SUM(quantity * unitprice)
            FROM order_items
            WHERE orderid = OLD.orderid
        ), 0)
        WHERE orderid = OLD.orderid;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE orders
        SET totalamount = COALESCE((
            SELECT SUM(quantity * unitprice)
            FROM order_items
            WHERE orderid = NEW.orderid
        ), 0)
        WHERE orderid = NEW.orderid;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_order_total ON order_items;
CREATE TRIGGER trg_update_order_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_total();

-- Права на процедуру: менеджер может добавлять позиции, обычный viewer — нет
REVOKE ALL ON PROCEDURE add_order_item(INT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON PROCEDURE add_order_item(INT, INT, INT) TO noir_manager;
