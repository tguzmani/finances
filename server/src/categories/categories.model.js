const database = require('../config/database')
const { DataTypes } = require('sequelize')

const User = require('../users/users.model')
const Subcategory = require('../subcategories/subcategories.model')

const BLUE = '#4153AF'

const Category = database.define('category', {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },

  color: {
    type: DataTypes.STRING,
    defaultValue: BLUE,
  },

  isHidden: {
    type: DataTypes.BOOLEAN,
  },
})

Category.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
})

Subcategory.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category',
})

Category.hasMany(Subcategory)

module.exports = Category
