exports.CREATE_ENTRY = `
insert into entry (date, description)
values (?, ?)
`

exports.READ_ENTRIES = `
select * 
from entry
`

exports.READ_ENTRY = `
select * 
from entry
where entryId = ?
`

exports.UPDATE_ENTRY = `
update entry
set date = ?, description = ?
where entryId = ?
`

exports.DELETE_ENTRY = `
delete from entry
where entryId = ?
`
