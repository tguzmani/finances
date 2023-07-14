const Period = require('./periods.model')
const Account = require('../accounts/accounts.model')
const Category = require('../categories/categories.model')
const { Op } = require('sequelize')

const readPeriod = async periodId => {
  return await Period.findByPk(periodId, { include: Account })
}

exports.readCurrentPeriodByUser = async userId => {
  return await Period.findOne({ where: { userId, isCurrent: true } })
}

exports.readPeriods = async userId => {
  return await Period.findAll({ include: Account })
}

exports.createPeriod = async (period, userId) => {
  return await Period.create({ ...period, userId })
}

exports.createManyPeriods = async periods => {
  return await Period.bulkCreate(periods)
}

exports.updatePeriod = async (periodId, period) => {
  await Period.update(period, { where: { id: periodId } })

  return await readPeriod(periodId)
}

exports.setCurrentPeriod = async periodId => {
  await Period.update({ isCurrent: true }, { where: { id: periodId } })

  await Period.update(
    { isCurrent: false },
    { where: { id: { [Op.ne]: periodId } } }
  )

  return await readPeriod(periodId)
}

exports.deletePeriod = async periodId => {
  const period = await readPeriod(periodId)

  await Period.destroy({ where: { id: periodId } })

  return period
}
