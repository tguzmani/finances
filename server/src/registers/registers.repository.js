const Register = require('./registers.model')
const Row = require('../rows/rows.model')
const Account = require('../accounts/accounts.model')
const User = require('../users/users.model')
const { Op } = require('sequelize')
const dayjs = require('dayjs')

exports.readRegister = async registerId => {
  return await Register.findByPk(registerId, {
    include: { model: Row, as: 'rows' },
  })
}

exports.readRegisters = async (userId, from, to) => {
  console.log(from, to)
  return await Register.findAll({
    include: {
      model: Row,
      as: 'rows',

      include: {
        model: Account,
        as: 'account',
        attributes: [],

        include: {
          model: User,
          as: 'user',
          where: { id: userId },
        },
      },
    },
    where: {
      date: {
        [Op.between]: [from, dayjs(to).add(1, 'days').format()],
      },
    },
    order: [['date', 'DESC']],
  })
}

exports.createRegister = async register => {
  return await Register.create(register)
}

exports.createManyRegisters = async (registers, userId) => {
  const newRegisters = registers.map(register => ({
    ...register,
    userId,
  }))

  return await Register.bulkCreate(newRegisters)
}

exports.updateRegister = async (registerId, register) => {
  await Register.update(register, { where: { id: registerId } })

  return await readRegister(registerId)
}

exports.deleteRegister = async registerId => {
  const register = await readRegister(registerId)

  await Register.destroy({ where: { id: registerId } })

  return register
}
