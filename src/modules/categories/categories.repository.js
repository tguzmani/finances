import AxiosRepository from '../../common/axios.repository'

export default class CategoriesRepository extends AxiosRepository {
  constructor() {
    super('categories')
  }

  async readCategories() {
    return await super.get('/')
  }

  async createCategory(category) {
    return await super.post('/', category)
  }
}
