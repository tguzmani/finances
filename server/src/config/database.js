const { Sequelize } = require('sequelize')

const database = new Sequelize(
  'postgres://postgres:gh1290yu@localhost:5432/finances',
  { logging: false }
)

module.exports = database
