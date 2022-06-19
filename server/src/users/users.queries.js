exports.READ_USER_BY_NAME = `
select id_user, username, password
from user
where username = ?
`

exports.READ_USER_BY_ID = `
select id_user, username, email, birth_date, first_name firstName, last_name lastName
from user
where id_user = ?
`

exports.CREATE_USER = `
insert into user (username, email, password, birth_date, first_name, last_name)
values (?, ?, ?, ?, ?, ?)
`
