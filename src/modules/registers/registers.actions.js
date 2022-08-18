import { action } from 'easy-peasy'

const registersActions = {
  setRegisters: action((state, registers) => {
    state.registers = registers
    state.loading = false
  }),

  setLoading: action((state, loading) => {
    state.loading = loading
  }),

  filterRegisters: action((state, lookupValue) => {
    state.filteredRegisters = state.registers.filter(register =>
      register.name.toLowerCase().includes(lookupValue)
    )
  }),

  addRegister: action((state, register) => {
    state.registers = [register, ...state.registers]
    state.loading = false
  }),
}

export default registersActions
