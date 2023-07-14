import AxiosRepository from '../../common/axios.repository'

export default class SubcategoriesRepository extends AxiosRepository {
  constructor() {
    super('subcategories')
  }

  async readSubcategories() {
    return await super.get('/')
  }

  async createSubcategory(subcategory) {
    return await super.post('/', subcategory)
  }
}
