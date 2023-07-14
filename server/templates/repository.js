const { queryOne, query, command, insert } = require('../common/repository')
const entitiesQueries = require('./entities.queries')

exports.createEntity = async ARG_CREATE_COLS => {
  return await insert(entitiesQueries.CREATE_ENTITY, [COMMA_CREATE_COLS])
}

exports.readEntities = async userId => {
  return await query(entitiesQueries.READ_ENTITIES, [userId])
}

exports.readEntity = async entityId => {
  return await queryOne(entitiesQueries.READ_ENTITY, [entityId])
}

exports.updateEntity = async (entityId, COMMA_UPDATE_COLS) => {
  await command(entitiesQueries.UPDATE_ENTITY, [COMMA_UPDATE_COLS, entityId])
}

exports.deleteEntity = async entityId => {
  await command(entitiesQueries.DELETE_ENTITY, [entityId])
}
