import { action } from 'easy-peasy'

const periodsActions = {
  setPeriods: action((state, periods) => {
    state.periods = periods
    state.loading = false
  }),

  setLoading: action((state, loading) => {
    state.loading = loading
  }),

  filterPeriods: action((state, lookupValue) => {
    state.filteredPeriods = state.periods.filter(period =>
      period.name.toLowerCase().includes(lookupValue)
    )
  }),

  addPeriod: action((state, period) => {
    state.periods = [period, ...state.periods]
    state.loading = false
  }),

  updatePeriods: action((state, updatedPeriod) => {
    state.periods = state.periods.map(period =>
      period.id === updatedPeriod.id ? updatedPeriod : period
    )
    state.loading = false
  }),

  updateCurrentPeriod: action((state, updatedPeriod) => {
    state.periods = state.periods.map(period =>
      period.id === updatedPeriod.id
        ? updatedPeriod
        : { ...period, isCurrent: false }
    )
    state.loading = false
  }),
}

export default periodsActions
