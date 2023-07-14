const Category = require('./categories.model')
const Subcategory = require('../subcategories/subcategories.model')

const readCategory = async categoryId => {
  return await Category.findByPk(categoryId)
}

exports.readCategories = async userId => {
  return await Category.findAll({
    include: Subcategory,
    where: { userId },
    order: [['name']],
  })
}

exports.createCategory = async (category, userId) => {
  return await Category.create({ ...category, userId })
}

exports.createManyCategories = async (categories, userId) => {
  const newCategories = categories.map(category => ({
    ...category,
    userId,
  }))

  return await Category.bulkCreate(newCategories)
}

exports.updateCategory = async (categoryId, category) => {
  await Category.update(category, { where: { id: categoryId } })

  return await readCategory(categoryId)
}

exports.deleteCategory = async categoryId => {
  const category = await readCategory(categoryId)

  await Category.destroy({ where: { id: categoryId } })

  return category
}
