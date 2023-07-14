const periodsRepository = require('./periods.repository')

exports.readPeriods = async userId => {
  return await periodsRepository.readPeriods(userId)
}

exports.readCurrentPeriodByUser = async userId => {
  return await periodsRepository.readCurrentPeriodByUser(userId)
}

exports.createPeriod = async (period, userId) => {
  return await periodsRepository.createPeriod(period, userId)
}

exports.createManyPeriods = async (periods, userId) => {
  return await periodsRepository.createManyPeriods(periods, userId)
}

exports.updatePeriod = async (periodId, period) => {
  return await periodsRepository.updatePeriod(periodId, period)
}

exports.setCurrentPeriod = async periodId => {
  return await periodsRepository.setCurrentPeriod(periodId)
}

exports.deletePeriod = async periodId => {
  return await periodsRepository.deletePeriod(periodId)
}
