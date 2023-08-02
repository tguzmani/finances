import { computed } from 'easy-peasy'

const periodsComputeds = {
  currentPeriod: computed(state =>
    state.periods.find(period => period.isCurrent)
  ),
}

export default periodsComputeds
