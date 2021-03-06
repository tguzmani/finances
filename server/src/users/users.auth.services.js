const usersRepository = require('./users.repository')
const encrypt = require('../common/encrypt')
const UsersException = require('./users.exception')

exports.signIn = async (username, password) => {
  const user = await usersRepository.readUserByUsername(username)

  if (!user) throw new UsersException('El usuario no existe')

  const passwordsMatch = await encrypt.compare(password, user.password)

  if (!passwordsMatch) throw new UsersException('Contraseña no válida')

  return user.userId
}

exports.signUp = async (username, password, firstName, lastName) => {
  const user = await usersRepository.readUserByUsername(username)

  if (user)
    throw new UsersException(
      'Ya existe un usuario con este username en el sistema'
    )

  const hashedPassword = await encrypt.hash(password)

  await usersRepository.createUser(
    username,
    hashedPassword,
    firstName,
    lastName
  )
}
