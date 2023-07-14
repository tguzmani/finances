import { thunk } from 'easy-peasy'
import SubcategoriesRepository from './subcategories.repository'

const subcategoriesRepository = new SubcategoriesRepository()

const subcategoriesThunks = {
  readSubcategories: thunk(async actions => {
    actions.setLoading(true)

    const subcategories = await subcategoriesRepository.readSubcategories()

    actions.setSubcategories(subcategories)
  }),

  createSubcategory: thunk(async (actions, subcategory) => {
    actions.setLoading(true)

    const newSubcategory = await subcategoriesRepository.createSubcategory(
      subcategory
    )

    actions.addSubcategory(newSubcategory)
  }),
}

export default subcategoriesThunks
