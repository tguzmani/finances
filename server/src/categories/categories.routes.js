const express = require('express')
const router = express.Router()
const categoriesController = require('./categories.controller')

const hasToken = require('../middleware/hasToken')

router.post('/', [hasToken], categoriesController.createCategory)
router.post(
  '/many',
  [hasToken],
  categoriesController.createManyCategories
)
router.get('/', [hasToken], categoriesController.readCategories)
router.put(
  '/:categoryId',
  [hasToken],
  categoriesController.updateCategory
)
router.delete(
  '/:categoryId',
  [hasToken],
  categoriesController.deleteCategory
)

module.exports = router
