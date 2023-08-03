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
    return await super.post('/by-script', { script })
  }

  async updateRegisterFromScript(updateRegisterFromScriptDto) {
    const { registerId, script, oldRows } = updateRegisterFromScriptDto

    return await super.put(`/by-script/${registerId}`, { script, oldRows })
  }
}
