import { useStoreState } from 'easy-peasy'

const debitBalances = ['assets', 'expenses']

const useAccountById = accountId => {
  const { accounts } = useStoreState(state => state.accounts)

  const account = accounts.find(account => account?.id === accountId)

  const accountBalanceType = debitBalances.includes(account?.type)
    ? 'debit'
    : 'credit'

  return { account, accountBalanceType }
}

export default useAccountById
