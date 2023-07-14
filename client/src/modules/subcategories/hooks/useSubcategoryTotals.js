import { useStoreState } from 'easy-peasy'

const useSubcategoryTotals = subcategory => {
  const { rows } = useStoreState(state => state.registers)

  const subcategoryRows = rows.filter(
    row => row.subcategoryId === subcategory.id
  )

  const subcategoryDebits = subcategoryRows.filter(row => row.type === 'debit')

  const subcategoryTotalDebit = subcategoryDebits.reduce(
    (total, debit) => (total += parseFloat(debit.amount)),
    0
  )

  return { subcategoryRows, subcategoryDebits, subcategoryTotalDebit }
}

export default useSubcategoryTotals
