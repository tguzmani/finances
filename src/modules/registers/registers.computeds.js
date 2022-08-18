import { computed } from 'easy-peasy'

const registersComputeds = {
  rows: computed(state =>
    state.registers.map(register => register.rows).flat()
  ),
}

export default registersComputeds
