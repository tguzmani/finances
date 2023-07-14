const express = require('express')
const router = express.Router()
const rowsController = require('./rows.controller')

const hasToken = require('../middleware/hasToken')

router.post('/', [hasToken], rowsController.createRow)
router.post(
  '/many',
  [hasToken],
  rowsController.createManyRows
)
router.get('/', [hasToken], rowsController.readRows)
router.put(
  '/:rowId',
  [hasToken],
  rowsController.updateRow
)
router.delete(
  '/:rowId',
  [hasToken],
  rowsController.deleteRow
)

module.exports = router
