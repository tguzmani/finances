const { queryOne, command } = require('../common/repository')
const usersQueries = require('./users.queries')

exports.readUserById = async userId => {
  return await queryOne(usersQueries.READ_USER_BY_ID, [userId])
}

exports.readUserByUsername = async username => {
  return await queryOne(usersQueries.READ_USER_BY_NAME, [username])
}

exports.createUser = async (username, email, password, firstName, lastName) => {
  await command(usersQueries.CREATE_USER, [
    username,
    password,
    firstName,
    lastName,
  ])
}
