const database = require('../config/database')
const { DataTypes } = require('sequelize')
const dayjs = require('dayjs')

const User = require('../users/users.model')
const Account = require('../accounts/accounts.model')
const AccountPeriod = require('../accounts/accountsPeriods.model')

const Period = database.define('period', {
  name: {
    type: DataTypes.STRING,
  },

  startDate: {
    type: DataTypes.DATE,
    defaultValue: dayjs().startOf('month').format(),
  },

  endDate: {
    type: DataTypes.DATE,
    defaultValue: dayjs().endOf('month').subtract(1, 'day').format(),
  },

  estimatedIncome: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },

  isCurrent: {
    type: DataTypes.BOOLEAN,
  },

  isClosed: {
    type: DataTypes.BOOLEAN,
  },

  savings: {
    type: DataTypes.REAL,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 1,
    },
  },
})

Period.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
})

module.exports = Period
