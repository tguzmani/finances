exports.CREATE_ENTITY = `
insert into entity (SQL_CREATE_COLS)
values (SQL_CREATE_PLACEHOLDERS)
`

exports.READ_ENTITIES = `
select * 
from entity, user
where entity.userId = user.userId
and user.userId = ?
`

exports.READ_ENTITY = `
select * 
from entity
where entityId = ?
`

exports.UPDATE_ENTITY = `
update entity
set SQL_UPDATE_COLS
where entityId = ?
`

exports.DELETE_ENTITY = `
delete from entity
where entityId = ?
`
