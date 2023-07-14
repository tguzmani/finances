const Subcategory = require('./subcategories.model')
const Category = require('../categories/categories.model')
const { Op } = require('sequelize')

const readSubcategory = async subcategoryId => {
  return await Subcategory.findByPk(subcategoryId)
}

exports.readSubcategoryByName = async subcategoryName => {
  return await Subcategory.findOne({
    where: { name: { [Op.iLike]: subcategoryName } },
  })
}

exports.readSubcategories = async userId => {
  return await Subcategory.findAll({
    include: {
      model: Category,
      as: 'category',
      attributes: ['name', 'color'],
      where: { userId },
    },
  })
}

exports.createSubcategory = async subcategory => {
  return await Subcategory.create(subcategory)
}

exports.createManySubcategories = async subcategories => {
  return await Subcategory.bulkCreate(subcategories)
}

exports.updateSubcategory = async (subcategoryId, subcategory) => {
  await Subcategory.update(subcategory, { where: { id: subcategoryId } })

  return await readSubcategory(subcategoryId)
}

exports.deleteSubcategory = async subcategoryId => {
  const subcategory = await readSubcategory(subcategoryId)

  await Subcategory.destroy({ where: { id: subcategoryId } })

  return subcategory
}
