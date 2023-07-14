const subcategoriesRepository = require('./subcategories.repository')

exports.readSubcategories = async userId => {
  return await subcategoriesRepository.readSubcategories(userId)
}

exports.readSubcategoryByName = async subcategoryName => {
  return await subcategoriesRepository.readSubcategoryByName(subcategoryName)
}

exports.createSubcategory = async (subcategory, userId) => {
  return await subcategoriesRepository.createSubcategory(subcategory, userId)
}

exports.createManySubcategories = async (subcategories, userId) => {
  return await subcategoriesRepository.createManySubcategories(
    subcategories,
    userId
  )
}

exports.updateSubcategory = async (subcategoryId, subcategory) => {
  return await subcategoriesRepository.updateSubcategory(
    subcategoryId,
    subcategory
  )
}

exports.deleteSubcategory = async subcategoryId => {
  return await subcategoriesRepository.deleteSubcategory(subcategoryId)
}
