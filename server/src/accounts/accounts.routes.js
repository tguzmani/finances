const express = require('express')
const router = express.Router()
const accountsController = require('./accounts.controller')

const hasToken = require('../middleware/hasToken')

router.post('/', [hasToken], accountsController.createAccount)
router.post('/many', [hasToken], accountsController.createManyAccounts)
router.post(
  '/initial-balances/:periodId',
  [hasToken],
  accountsController.setInitialBalances
)
router.get('/', [hasToken], accountsController.readAccounts)
router.put('/:accountId', [hasToken], accountsController.updateAccount)
router.delete('/:accountId', [hasToken], accountsController.deleteAccount)

module.exports = router
