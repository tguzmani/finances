import AxiosRepository from '../../common/axios.repository'

export default class AccountsRepository extends AxiosRepository {
  constructor() {
    super('accounts')
  }

  async readAccounts() {
    return await super.get('/')
  }

  async createAccount(account) {
    return await super.post('/', account)
  }

  async deleteAccount(accountId) {
    return await super.delete(`/${accountId}`, accountId)
  }
}
