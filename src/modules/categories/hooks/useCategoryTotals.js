import { useStoreState } from 'easy-peasy'
import useSubcategoryTotals from 'modules/subcategories/hooks/useSubcategoryTotals'

const useCategoryTotals = category => {
  const { categories } = useStoreState(state => state.categories)
  const { rows } = useStoreState(state => state.registers)

  const categorySubcategories = category.subcategories

  const categoryRows = categorySubcategories
    .map(subcategory =>
      rows.filter(row => row.subcategoryId === subcategory.id)
    )
    .flat()

  const categoryDebits = categoryRows.filter(row => row.type === 'debit')

  const categoryTotalDebit = categoryDebits.reduce(
    (total, debit) => (total += parseFloat(debit.amount)),
    0
  )

  return { categoryTotalDebit }
}

export default useCategoryTotals
