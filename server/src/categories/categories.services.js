const categoriesRepository = require('./categories.repository')

exports.readCategories = async userId => {
  return await categoriesRepository.readCategories(userId)
}

exports.createCategory = async (category, userId) => {
  return await categoriesRepository.createCategory(category, userId)
}

exports.createManyCategories = async (categories, userId) => {
  return await categoriesRepository.createManyCategories(
    categories,
    userId
  )
}

exports.updateCategory = async (categoryId, category) => {
  return await categoriesRepository.updateCategory(
    categoryId,
    category
  )
}

exports.deleteCategory = async categoryId => {
  return await categoriesRepository.deleteCategory(categoryId)
}
