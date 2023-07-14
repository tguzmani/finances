const express = require('express')
const router = express.Router()
const entriesController = require('./entries.controller')

const hasToken = require('../middleware/hasToken')

router.post('/', [hasToken], entriesController.createEntry)
router.get('/', [hasToken], entriesController.readEntries)
router.put('/:entryId', [hasToken], entriesController.updateEntry)
router.delete('/:entryId', [hasToken], entriesController.deleteEntry)

module.exports = router
