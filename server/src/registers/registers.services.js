const RegistersException = require('./registers.exception')
const registersRepository = require('./registers.repository')
const registersParser = require('./registers.parser')
const rowsServices = require('../rows/rows.services')
const periodsServices = require('../periods/periods.services')

const readRegister = async registerId => {
  return await registersRepository.readRegister(registerId)
}

exports.readRegisters = async userId => {
  const { startDate, endDate } = await periodsServices.readCurrentPeriodByUser(
    userId
  )

  return await registersRepository.readRegisters(userId, startDate, endDate)
}

exports.createRegister = async register => {
  return await registersRepository.cresateRegister(register)
}

exports.createRegisterByScript = async script => {
  const { rows, ...registerData } = await registersParser.parseRegisterByScript(
    script
  )

  const register = await registersRepository.createRegister(registerData)

  await rowsServices.createManyRows(rows, register.id)

  return await readRegister(register.id)
}

exports.createManyRegisters = async (registers, userId) => {
  return await registersRepository.createManyRegisters(registers, userId)
}

exports.updateRegister = async (registerId, register) => {
  return await registersRepository.updateRegister(registerId, register)
}

exports.deleteRegister = async registerId => {
  return await registersRepository.deleteRegister(registerId)
}
