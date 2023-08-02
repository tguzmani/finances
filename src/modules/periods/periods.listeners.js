import { startLoading, stopLoading, setError } from 'common/listeners'

const periodsListeners = {
  ...startLoading('readPeriods', 'setCurrentPeriod'),
  ...stopLoading('readPeriods', 'setCurrentPeriod'),
  ...setError('readPeriods', 'setCurrentPeriod'),
}

export default periodsListeners
