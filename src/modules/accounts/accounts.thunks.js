import { thunk } from 'easy-peasy'
import AccountsRepository from './accounts.repository'

const accountsRepository = new AccountsRepository()

const accountsThunks = {
  readAccounts: thunk(async actions => {
    actions.setLoading(true)

    const accounts = await accountsRepository.readAccounts()

    actions.setAccounts(accounts)
  }),
}

export default accountsThunks
