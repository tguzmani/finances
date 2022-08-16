import { action } from 'easy-peasy'

const accountsActions = {
  setAccounts: action((state, accounts) => {
    state.accounts = accounts
    state.loading = false
  }),

  setLoading: action((state, loading) => {
    state.loading = loading
  }),

  filterAccounts: action((state, lookupValue) => {
    state.filteredAccounts = state.accounts.filter(account =>
      account.name.includes(lookupValue)
    )
  }),
}

export default accountsActions
