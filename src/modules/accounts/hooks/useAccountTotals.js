import useAccountRows from './useAccountRows'
import useAccountById from './useAccountById'

const useAccountTotals = account => {
  const { getRowsByType } = useAccountRows(account)
  const { accountBalanceType } = useAccountById(account?.id)

  const debits = getRowsByType('debit')
  const credits = getRowsByType('credit')

  const totalDebit = debits.reduce(
    (sum, debit) => (sum += parseFloat(debit.amount)),
    0
  )
  const totalCredit = credits.reduce(
    (sum, credit) => (sum += parseFloat(credit.amount)),
    0
  )

  const balance =
    accountBalanceType === 'debit'
      ? parseFloat(account?.initialBalance) + totalDebit - totalCredit
      : parseFloat(account?.initialBalance) - totalDebit + totalCredit

  return { debits, credits, totalCredit, totalDebit, balance }
}

export default useAccountTotals
