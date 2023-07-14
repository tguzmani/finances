import { thunk } from 'easy-peasy'
import PeriodsRepository from './periods.repository'

const periodsRepository = new PeriodsRepository()

const periodsThunks = {
  readPeriods: thunk(async actions => {
    const periods = await periodsRepository.readPeriods()

    actions.setPeriods(periods)
  }),

  createPeriod: thunk(async (actions, period) => {
    const newPeriod = await periodsRepository.createPeriod(period)

    actions.addPeriod(newPeriod)
  }),

  setCurrentPeriod: thunk(async (actions, period, { getStoreActions }) => {
    await periodsRepository.setCurrentPeriod(period)

    actions.readPeriods()

    getStoreActions().registers.readRegisters()
    getStoreActions().accounts.readAccounts()
  }),
}

export default periodsThunks
