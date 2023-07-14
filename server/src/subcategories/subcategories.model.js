const database = require('../config/database')
const { DataTypes } = require('sequelize')

const Category = require('../categories/categories.model')

const Subcategory = database.define('subcategory', {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },

  icon: {
    type: DataTypes.STRING,
    allowNull: true,
  },
})

module.exports = Subcategory
