const registersServices = require('./registers.services')

exports.readRegisters = async (req, res) => {
  try {
    const registers = await registersServices.readRegisters(req.userId)

    res.send(registers)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createRegister = async (req, res) => {
  try {
    const register = await registersServices.createRegister(req.body)
    res.send(register)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createRegisterByScript = async (req, res) => {
  const { script } = req.body

  try {
    const register = await registersServices.createRegisterByScript(script)

    res.send(register)
  } catch (error) {
    return res.status(400).send(error)
  }
}

exports.createManyRegisters = async (req, res) => {
  try {
    const register = await registersServices.createManyRegisters(
      req.body,
      req.userId
    )

    res.send(register)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updateRegister = async (req, res) => {
  const { registerId } = req.params

  try {
    const register = await registersServices.updateRegister(
      registerId,
      req.body
    )
    res.send(register)
  } catch (error) {
    return res.status(400).send(error.message)
  }
}

exports.deleteRegister = async (req, res) => {
  const { registerId } = req.params

  try {
    const register = await registersServices.deleteRegister(registerId)
    res.send(register)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}
