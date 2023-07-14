const express = require('express')
const router = express.Router()
const periodsController = require('./periods.controller')

const hasToken = require('../middleware/hasToken')

router.post('/', [hasToken], periodsController.createPeriod)
router.post('/many', [hasToken], periodsController.createManyPeriods)
router.get('/', [hasToken], periodsController.readPeriods)
router.put('/:periodId', [hasToken], periodsController.updatePeriod)
router.put(
  '/set-current/:periodId',
  [hasToken],
  periodsController.setCurrentPeriod
)
router.delete('/:periodId', [hasToken], periodsController.deletePeriod)

module.exports = router
