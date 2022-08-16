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
      account.name.toLowerCase().includes(lookupValue)
    )
  }),

  addAccount: action((state, account) => {
    state.accounts = [account, ...state.accounts]
    state.loading = false
  }),
}

export default accountsActions
