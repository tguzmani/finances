const { queryOne, command } = require('../common/repository')
const usersQueries = require('./users.queries')

exports.readUserById = async userId => {
  return await queryOne(usersQueries.READ_USER_BY_ID, [userId])
}

exports.readUserByName = async userName => {
  return await queryOne(usersQueries.READ_USER_BY_NAME, [userName])
}

exports.createUser = async (
  username,
  email,
  password,
  birthDate,
  firstName,
  lastName
) => {
  await command(usersQueries.CREATE_USER, [
    username,
    email,
    password,
    birthDate,
    firstName,
    lastName,
  ])
}
