import { thunk } from 'easy-peasy'
import CategoriesRepository from './categories.repository'

const categoriesRepository = new CategoriesRepository()

const categoriesThunks = {
  readCategories: thunk(async actions => {
    actions.setLoading(true)

    const categories = await categoriesRepository.readCategories()

    actions.setCategories(categories)
  }),

  createCategory: thunk(async (actions, category) => {
    actions.setLoading(true)

    const newCategory = await categoriesRepository.createCategory(category)

    actions.addCategory(newCategory)
  }),
}

export default categoriesThunks
