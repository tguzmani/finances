const usersRepository = require('./users.repository')
const encrypt = require('../common/encrypt')
const UsersException = require('./users.exception')

exports.signIn = async (username, password) => {
  const user = await usersRepository.readUserByName(username)

  if (!user) throw new UsersException('El usuario no existe')
  const passwordsMatch = await encrypt.compare(password, user.password)

  if (!passwordsMatch) throw new UsersException('Contraseña no válida')

  return user.id
}

exports.signUp = async (username, email, password, firstName, lastName) => {
  const user = await usersRepository.readUserByName(username)

  if (user)
    throw new UsersException(
      'Ya existe un usuario con este username en el sistema'
    )

  const hashedPassword = await encrypt.hash(password)

  await usersRepository.createUser(
    username,
    email,
    hashedPassword,
    firstName,
    lastName
  )
}
