const express = require('express')
const router = express.Router()
const entitiesController = require('./entities.controller')

const hasToken = require('../middleware/hasToken')

router.post('/', [hasToken], entitiesController.createEntity)
router.get('/', [hasToken], entitiesController.readEntities)
router.put('/:entityId', [hasToken], entitiesController.updateEntity)
router.delete('/:entityId', [hasToken], entitiesController.deleteEntity)

module.exports = router
