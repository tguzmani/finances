import { thunk } from 'easy-peasy'
import RegistersRepository from './registers.repository'

const registersRepository = new RegistersRepository()

const registersThunks = {
  readRegisters: thunk(async actions => {
    const registers = await registersRepository.readRegisters()

    actions.setRegisters(registers)
  }),

  createRegister: thunk(async (actions, register) => {
    const newRegister = await registersRepository.createRegister(register)

    actions.addRegister(newRegister)
  }),

  createRegisterFromScript: thunk(async (actions, script, { fail }) => {
    try {
      const newRegister = await registersRepository.createRegisterFromScript(
        script
      )
      actions.addRegister(newRegister)
    } catch (error) {
      fail(error)
    }
  }),

  updateRegisterFromScript: thunk(
    async (actions, updateRegisterFromScriptDto, { fail }) => {
      try {
        const newRegister = await registersRepository.updateRegisterFromScript(
          updateRegisterFromScriptDto
        )
        actions.updateRegisters(newRegister)
      } catch (error) {
        fail(error)
      }
    }
  ),
}

export default registersThunks
