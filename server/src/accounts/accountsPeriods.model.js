const database = require('../config/database')
const { DataTypes } = require('sequelize')

const User = require('../users/users.model')
const Account = require('../accounts/accounts.model')
const Period = require('../periods/periods.model')

const AccountPeriod = database.define('accountPeriod', {
  initialBalance: {
    type: DataTypes.DECIMAL(12, 2),
  },
})

module.exports = AccountPeriod
