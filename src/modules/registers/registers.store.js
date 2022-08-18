import registersActions from './registers.actions'
import registersThunks from './registers.thunks'
import registersComputeds from './registers.computeds'

const registersStore = {
  registers: [],
  filteredRegisters: [],

  ...registersComputeds,
  ...registersActions,
  ...registersThunks,
}

export default registersStore
