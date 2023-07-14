exports.CREATE_ACCOUNT = `
insert into account (name, description, initialBalance, classification, type, userId, subcategoryId)
values (?, ?, ?, ?, ?, ?, ?)
`

exports.READ_ACCOUNTS = `
select accountId, account.name, account.classification, account.type, initialBalance, subcategoryId
from account, user
where account.userId = user.userId
and user.userId = ?
`

exports.READ_ACCOUNT = `
select * 
from account
where accountId = ?
`

exports.UPDATE_ACCOUNT = `
update account
set name = ?, description = ?, initialBalance = ?, subcategoryId = ?
where accountId = ?
`

exports.DELETE_ACCOUNT = `
delete from account
where accountId = ?
`
