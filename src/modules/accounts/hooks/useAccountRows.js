import { useStoreState, useStoreActions } from 'easy-peasy'
import useRead from 'layout/hooks/useRead'

const useAccountRows = account => {
  const { rows } = useStoreState(state => state.registers)
  // const { readRegisters } = useStoreActions(state => state.registers)

  // useRead(readRegisters)

  const thisAccountRows = rows.filter(row => row.accountId === account.id)

  const getRowsByType = type => thisAccountRows.filter(row => row.type === type)

  const getRowAmountsByType = type =>
    getRowsByType(type).map(row => parseFloat(row.amount))

  return { thisAccountRows, getRowsByType, getRowAmountsByType }
}

export default useAccountRows
