import accountsActions from './accounts.actions'
import accountsThunks from './accounts.thunks'

const accountsStore = {
  accounts: [],
  filteredAccounts: [],

  ...accountsActions,
  ...accountsThunks,
}

export default accountsStore
