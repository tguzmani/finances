import periodsActions from './periods.actions'
import periodsThunks from './periods.thunks'
import periodsComputeds from './periods.computeds'
import periodListeners from './periods.listeners'

const periodsStore = {
  periods: [],
  filteredPeriods: [],
  loading: false,
  error: undefined,
  editorError: undefined,

  ...periodsComputeds,
  ...periodsActions,
  ...periodsThunks,
  ...periodListeners,
}

export default periodsStore
