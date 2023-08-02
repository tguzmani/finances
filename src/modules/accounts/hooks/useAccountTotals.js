import useAccountRows from './useAccountRows'
import useAccountById from './useAccountById'
import useCurrentPeriod from 'modules/periods/hooks/useCurrentPeriod'

const useAccountTotals = account => {
  const { getRowsByType } = useAccountRows(account)
  const { currentPeriod } = useCurrentPeriod()
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

  let initialBalance = currentPeriod?.accounts?.find(
    periodAccout => periodAccout.id === account.id
  )?.accountPeriod?.initialBalance

  if (!initialBalance) initialBalance = 0

  const balance =
    accountBalanceType === 'debit'
      ? parseFloat(initialBalance) + totalDebit - totalCredit
      : parseFloat(initialBalance) - totalDebit + totalCredit

  return { debits, credits, totalCredit, totalDebit, balance, initialBalance }
}

export default useAccountTotals
