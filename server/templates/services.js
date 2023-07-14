const entitiesRepository = require('./entities.repository')

exports.createEntity = async ARG_CREATE_COLS => {
  return await entitiesRepository.createEntity(COMMA_CREATE_COLS)
}

exports.readEntities = async userId => {
  return await entitiesRepository.readEntities(userId)
}

exports.readEntity = async entityId => {
  return await entitiesRepository.readEntity(entityId)
}

exports.updateEntity = async (entityId, COMMA_UPDATE_COLS) => {
  await entitiesRepository.updateEntity(entityId, COMMA_UPDATE_COLS)
}

exports.deleteEntity = async entityId => {
  await entitiesRepository.deleteEntity(entityId)
}
