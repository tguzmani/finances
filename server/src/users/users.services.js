const usersRepository = require('./users.repository')

exports.readUserByUsername = async username => {
  return await usersRepository.readUserByUsername(username)
}

exports.readUserById = async userId => {
  const user = await usersRepository.readUserById(userId)

  user.password = undefined

  return user
}
