const usersRepository = require('./users.repository')

exports.readUserByUsername = async username => {
  return await usersRepository.readUserByUsername(username)
}

exports.readUserById = async userId => {
  return await usersRepository.readUserById(userId)
}
