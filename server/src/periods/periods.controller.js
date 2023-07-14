const periodsServices = require('./periods.services')

exports.readPeriods = async (req, res) => {
  try {
    const periods = await periodsServices.readPeriods(req.userId)

    res.send(periods)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createPeriod = async (req, res) => {
  try {
    const period = await periodsServices.createPeriod(req.body, req.userId)
    res.send(period)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createManyPeriods = async (req, res) => {
  try {
    const period = await periodsServices.createManyPeriods(req.body, req.userId)

    res.send(period)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updatePeriod = async (req, res) => {
  const { periodId } = req.params

  try {
    const period = await periodsServices.updatePeriod(periodId, req.body)
    res.send(period)
  } catch (error) {
    return res.status(400).send(error.message)
  }
}

exports.setCurrentPeriod = async (req, res) => {
  const { periodId } = req.params

  try {
    const period = await periodsServices.setCurrentPeriod(periodId)
    res.send(period)
  } catch (error) {
    return res.status(400).send(error.message)
  }
}

exports.deletePeriod = async (req, res) => {
  const { periodId } = req.params

  try {
    const period = await periodsServices.deletePeriod(periodId)
    res.send(period)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}
