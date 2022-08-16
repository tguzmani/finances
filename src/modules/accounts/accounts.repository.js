import AxiosRepository from '../../common/axios.repository'

export default class AccountsRepository extends AxiosRepository {
  constructor() {
    super('accounts')
  }

  async readAccounts() {
    return await super.get('/')
  }
}
