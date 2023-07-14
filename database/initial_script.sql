-- Este es el primer script de la base de datos
-- contiene los inserts iniciales
--
-- Creado el 19 de junio de 2022

insert into category (name)
values ('Comida');

insert into subcategory (name, categoryId)
values ('Restaurant', 1);

insert into account (name, classification, type, initialBalance, userId)
values ('Binance', 'real', 'asset', 6300, 1),
       ('Zelle', 'real', 'asset', 80, 1),
       ('Zinli', 'real', 'asset', 0, 1),
       ('Cash', 'real', 'asset', 125, 1),
       ('Cuentas por pagar Norma', 'real', 'liability', 3500, 1);

insert into account (name, classification, type, initialBalance, userId, subcategoryId)
values ('Gastos en comida', 'nominal', 'expense', 0, 1, 1);

insert into entry (date, description)

insert into entryitem (amount, type, entryId, accountId)