import { action } from 'easy-peasy'

const subcategoriesActions = {
  setSubcategories: action((state, subcategories) => {
    state.subcategories = subcategories
    state.loading = false
  }),

  setLoading: action((state, loading) => {
    state.loading = loading
  }),

  filterSubcategories: action((state, lookupValue) => {
    state.filteredSubcategories = state.subcategories.filter(subcategory =>
      subcategory.name.toLowerCase().includes(lookupValue)
    )
  }),

  addSubcategory: action((state, subcategory) => {
    state.subcategories = [subcategory, ...state.subcategories]
    state.loading = false
  }),
}

export default subcategoriesActions
