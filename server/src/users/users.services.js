const usersRepository = require('./users.repository')

exports.readUserByName = async userName => {
  return await usersRepository.readUserByName(userName)
}

exports.readUserById = async userId => {
  return await usersRepository.readUserById(userId)
}
