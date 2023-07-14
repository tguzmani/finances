const accountsRepository = require('./accounts.repository')

exports.readAccounts = async userId => {
  return await accountsRepository.readAccounts(userId)
}

exports.readAccountByName = async accountName => {
  return await accountsRepository.readAccountByName(accountName)
}

exports.createAccount = async (account, userId) => {
  return await accountsRepository.createAccount(account, userId)
}

exports.createManyAccounts = async (accounts, userId) => {
  return await accountsRepository.createManyAccounts(accounts, userId)
}

exports.updateAccount = async (accountId, account) => {
  return await accountsRepository.updateAccount(accountId, account)
}

exports.deleteAccount = async accountId => {
  return await accountsRepository.deleteAccount(accountId)
}

exports.setInitialBalances = async periodId => {
  return await accountsRepository.setInitialBalances(periodId)
}
