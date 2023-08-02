import { useStoreState } from 'easy-peasy'

const useSubcategoriesByCategory = categoryId => {
  const { subcategories } = useStoreState(state => state.subcategories)

  const subcategoriesByCategory = subcategories.filter(
    subcategory => subcategory.categoryId === categoryId
  )

  return subcategoriesByCategory
}

export default useSubcategoriesByCategory
