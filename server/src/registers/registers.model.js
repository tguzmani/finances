const database = require('../config/database')
const { DataTypes } = require('sequelize')
const Row = require('../rows/rows.model')

const Register = database.define('register', {
  date: {
    type: DataTypes.DATEONLY,
  },

  description: {
    type: DataTypes.STRING,
  },
})

Register.hasMany(Row, {
  as: 'rows',
})

module.exports = Register
