import { useStoreState } from 'easy-peasy'

const debitBalances = ['assets', 'expenses']

const useReadAccountById = accountId => {
  const { accounts } = useStoreState(state => state.accounts)

  const account = accounts.find(account => account?.id === accountId)

  const accountBalanceType = () => {
    if (debitBalances.includes(account?.type)) return 'debit'

    return 'credit'
  }

  return { account, accountBalanceType }
}

export default useReadAccountById
