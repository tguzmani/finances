const express = require('express')
const router = express.Router()
const registersController = require('./registers.controller')

const hasToken = require('../middleware/hasToken')

router.post('/script', [hasToken], registersController.createRegisterByScript)
router.post('/', [hasToken], registersController.createRegister)
router.post('/many', [hasToken], registersController.createManyRegisters)
router.get('/', [hasToken], registersController.readRegisters)
router.put('/:registerId', [hasToken], registersController.updateRegister)
router.delete('/:registerId', [hasToken], registersController.deleteRegister)

module.exports = router
