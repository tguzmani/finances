import registersActions from './registers.actions'
import registersThunks from './registers.thunks'
import registersComputeds from './registers.computeds'
import registerListeners from './registers.listeners'

const registersStore = {
  registers: [],
  filteredRegisters: [],
  loading: false,
  error: undefined,
  editorError: undefined,

  ...registersComputeds,
  ...registersActions,
  ...registersThunks,
  ...registerListeners,
}

export default registersStore
