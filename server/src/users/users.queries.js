exports.READ_USER_BY_NAME = `
select userId, username, password
from user
where username = ?
`

exports.READ_USER_BY_ID = `
select *
from user
where userId = ?
`

exports.CREATE_USER = `
insert into user (username, password, first_name, last_name)
values (?, ?, ?, ?)
`
