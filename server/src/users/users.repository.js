const User = require('./users.model')

exports.readUserById = async userId => {
  return await User.findByPk(userId, { attributes: { exclude: ['password'] } })
}

exports.readUserByName = async username => {
  return await User.findOne({
    where: { username },
  })
}

exports.createUser = async (username, email, password, firstName, lastName) => {
  return await User.create({ username, email, password, firstName, lastName })
}
