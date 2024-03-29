import { thunk } from 'easy-peasy'
import AccountsRepository from './accounts.repository'

const accountsRepository = new AccountsRepository()

const accountsThunks = {
  readAccounts: thunk(async actions => {
    actions.setLoading(true)

    const accounts = await accountsRepository.readAccounts()

    actions.setAccounts(accounts)
  }),

  createAccount: thunk(async (actions, account) => {
    actions.setLoading(true)

    const newAccount = await accountsRepository.createAccount(account)

    actions.addAccount(newAccount)
  }),

  deleteAccount: thunk(async (actions, accountId) => {
    actions.setLoading(true)

    await accountsRepository.deleteAccount(accountId)

    actions.removeAccount(accountId)
  }),
}

export default accountsThunks
