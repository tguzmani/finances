const entitiesServices = require('./entities.services')

exports.createEntity = async (req, res) => {
  const { COMMA_CREATE_COLS } = req.body

  try {
    const entityId = await entitiesServices.createEntity(COMMA_CREATE_COLS)
    const entity = await entitiesServices.readEntity(entityId)

    res.send(entity)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.readEntities = async (req, res) => {
  const { userId } = req
  try {
    const entities = await entitiesServices.readEntities(userId)

    res.send(entities)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updateEntity = async (req, res) => {
  const { entityId } = req.params
  const { COMMA_UPDATE_COLS } = req.body

  try {
    await entitiesServices.updateEntity(entityId, COMMA_UPDATE_COLS)
    const entity = await entitiesServices.readEntity(entityId)

    res.send(entity)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.deleteEntity = async (req, res) => {
  const { entityId } = req.params

  try {
    await entitiesServices.deleteEntity(entityId)

    res.send('Entity successfully deleted')
  } catch (error) {
    return res.status(400).send(error.stack)
  }
  await entitiesServices.deleteEntity(entityId)
}
