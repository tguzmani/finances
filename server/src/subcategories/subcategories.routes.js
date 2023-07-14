const express = require('express')
const router = express.Router()
const subcategoriesController = require('./subcategories.controller')

const hasToken = require('../middleware/hasToken')

router.post('/', [hasToken], subcategoriesController.createSubcategory)
router.post(
  '/many',
  [hasToken],
  subcategoriesController.createManySubcategories
)
router.get('/', [hasToken], subcategoriesController.readSubcategories)
router.put(
  '/:subcategoryId',
  [hasToken],
  subcategoriesController.updateSubcategory
)
router.delete(
  '/:subcategoryId',
  [hasToken],
  subcategoriesController.deleteSubcategory
)

module.exports = router
