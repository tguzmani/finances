import { thunk } from 'easy-peasy'
import RegistersRepository from './registers.repository'

const registersRepository = new RegistersRepository()

const registersThunks = {
  readRegisters: thunk(async actions => {
    actions.setLoading(true)

    const registers = await registersRepository.readRegisters()

    actions.setRegisters(registers)
  }),

  createRegister: thunk(async (actions, register) => {
    actions.setLoading(true)

    const newRegister = await registersRepository.createRegister(register)

    actions.addRegister(newRegister)
  }),

  createRegisterFromScript: thunk(async (actions, script) => {
    actions.setLoading(true)

    const newRegister = await registersRepository.createRegisterFromScript(
      script
    )

    actions.addRegister(newRegister)
  }),
}

export default registersThunks
