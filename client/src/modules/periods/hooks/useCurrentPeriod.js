import { useStoreState, useStoreActions } from 'easy-peasy'
import useRead from 'layout/hooks/useRead'

const useCurrentPeriod = () => {
  const { readPeriods } = useStoreActions(state => state.periods)
  const { periods, currentPeriod } = useStoreState(state => state.periods)

  // useRead(readPeriods)

  // const currentPeriod = periods.find(period => period.isCurrent)

  return { currentPeriod, periods }
}

export default useCurrentPeriod
