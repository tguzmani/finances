import AxiosRepository from '../../common/axios.repository'

export default class PeriodsRepository extends AxiosRepository {
  constructor() {
    super('periods')
  }

  async readPeriods() {
    return await super.get('/')
  }

  async createPeriod(period) {
    return await super.post('/', period)
  }

  async setCurrentPeriod(period) {
    return await super.put(`/set-current/${period.id}`, period)
  }
}
