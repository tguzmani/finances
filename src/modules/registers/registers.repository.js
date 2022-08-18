import AxiosRepository from '../../common/axios.repository'

export default class RegistersRepository extends AxiosRepository {
  constructor() {
    super('registers')
  }

  async readRegisters() {
    return await super.get('/')
  }

  async createRegister(register) {
    return await super.post('/', register)
  }

  async createRegisterFromScript(script) {
    return await super.post('/script', { script })
  }
}
