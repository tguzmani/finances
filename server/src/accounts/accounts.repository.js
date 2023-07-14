const Account = require('./accounts.model')
const Period = require('../periods/periods.model')
const AccountPeriod = require('./accountsPeriods.model')

const { Op } = require('sequelize')

const readAccount = async accountId => {
  return await Account.findByPk(accountId)
}

const readAccountsByCriteria = async where => {
  return await Account.findAll({ where })
}

exports.readAccountByName = async accountName => {
  return await Account.findOne({
    where: { name: { [Op.iLike]: accountName } },
  })
}

exports.readAccounts = async userId => {
  return await Account.findAll({
    include: {
      model: Period,
      attributes: ['id'],

      through: { attributes: ['initialBalance'] },
    },
    attributes: ['name', 'type', 'classification', 'id'],
    where: { userId },
    order: [
      ['type', 'ASC'],
      ['name', 'ASC'],
    ],
  })
}

exports.createAccount = async (account, userId) => {
  return await Account.create({ ...account, userId })
}

exports.createManyAccounts = async (accounts, userId) => {
  const newAccounts = accounts.map(account => ({ ...account, userId }))

  return await Account.bulkCreate(newAccounts)
}

exports.updateAccount = async (accountId, account) => {
  await Account.update(account, { where: { id: accountId } })

  return await readAccount(accountId)
}

exports.deleteAccount = async accountId => {
  const account = await readAccount(accountId)

  await Account.destroy({ where: { id: accountId } })

  return account
}

exports.setInitialBalances = async periodId => {
  const realAccounts = await readAccountsByCriteria({ classification: 'real' })
  const accountPeriodsData = realAccounts.map(account => ({
    accountId: account.id,
    periodId: parseInt(periodId),
    initialBalance: account.initialBalance,
  }))

  console.log('accountPeriodsData', accountPeriodsData)

  const accountPeriods = await AccountPeriod.bulkCreate(accountPeriodsData)
}
