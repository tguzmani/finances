import { action } from 'easy-peasy'

const categoriesActions = {
  setCategories: action((state, categories) => {
    state.categories = categories
    state.loading = false
  }),

  setLoading: action((state, loading) => {
    state.loading = loading
  }),

  filterCategories: action((state, lookupValue) => {
    state.filteredCategories = state.categories.filter(category =>
      category.name.toLowerCase().includes(lookupValue)
    )
  }),

  addCategory: action((state, category) => {
    state.categories = [category, ...state.categories]
    state.loading = false
  }),
}

export default categoriesActions
