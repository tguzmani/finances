const accountsServices = require('./accounts.services')

exports.readAccounts = async (req, res) => {
  try {
    const accounts = await accountsServices.readAccounts(req.userId)

    res.send(accounts)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createAccount = async (req, res) => {
  try {
    const account = await accountsServices.createAccount(req.body, req.userId)
    res.send(account)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createManyAccounts = async (req, res) => {
  try {
    const account = await accountsServices.createManyAccounts(
      req.body,
      req.userId
    )

    res.send(account)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updateAccount = async (req, res) => {
  const { accountId } = req.params

  try {
    const account = await accountsServices.updateAccount(accountId, req.body)
    res.send(account)
  } catch (error) {
    return res.status(400).send(error.message)
  }
}

exports.deleteAccount = async (req, res) => {
  const { accountId } = req.params

  try {
    const account = await accountsServices.deleteAccount(accountId)
    res.send(account)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.setInitialBalances = async (req, res) => {
  const { periodId } = req.params

  try {
    const account = await accountsServices.setInitialBalances(periodId)
    res.send(account)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}
