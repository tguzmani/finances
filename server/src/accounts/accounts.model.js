const database = require('../config/database')
const { DataTypes } = require('sequelize')

const User = require('../users/users.model')
const Period = require('../periods/periods.model')
const AccountPeriod = require('./accountsPeriods.model')

const Account = database.define('account', {
  name: {
    type: DataTypes.STRING,
    unique: true,
  },

  initialBalance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },

  type: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['assets', 'liabilities', 'equity', 'incomes', 'expenses']],
    },
  },

  classification: {
    type: DataTypes.STRING,
    validate: {
      isIn: [['real', 'nominal']],
    },
  },
})

Account.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
})

Account.belongsToMany(Period, { through: AccountPeriod })
Period.belongsToMany(Account, { through: AccountPeriod })

module.exports = Account
