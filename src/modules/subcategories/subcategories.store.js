import subcategoriesActions from './subcategories.actions'
import subcategoriesThunks from './subcategories.thunks'

const subcategoriesStore = {
  subcategories: [],
  filteredSubcategories: [],

  ...subcategoriesActions,
  ...subcategoriesThunks,
}

export default subcategoriesStore
