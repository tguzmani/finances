import categoriesActions from './categories.actions'
import categoriesThunks from './categories.thunks'

const categoriesStore = {
  categories: [],
  filteredCategories: [],

  ...categoriesActions,
  ...categoriesThunks,
}

export default categoriesStore
