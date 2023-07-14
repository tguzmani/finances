const database = require('../config/database')
const { DataTypes } = require('sequelize')

const Account = require('../accounts/accounts.model')
const Register = require('../registers/registers.model')
const Subcategory = require('../subcategories/subcategories.model')

const Row = database.define('row', {
  amount: {
    type: DataTypes.DECIMAL(12, 2),
  },

  type: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['debit', 'credit']],
    },
  },
})

Row.belongsTo(Account, {
  foreignKey: 'accountId',
  as: 'account',
})

// Row.belongsTo(Register, {
//   foreignKey: 'registerId',
//   as: 'register',
// })

Row.belongsTo(Subcategory, {
  foreignKey: 'subcategoryId',
  as: 'subcategory',
})

module.exports = Row
