const usersAuthServices = require('./users.auth.services')
const usersServices = require('./users.services')
const signToken = require('./../common/signToken')

exports.signIn = async (req, res) => {
  const { username, password } = req.body

  try {
    const userId = await usersAuthServices.signIn(username, password)
    const user = await usersServices.readUserById(userId)

    const token = signToken({ id: userId })
    res.cookie('t', token)

    res.send(user)
  } catch (error) {
    return res.status(400).send(error)
  }
}

exports.signUp = async (req, res) => {
  const { username, password, email, birthDate, firstName, lastName } = req.body

  try {
    await usersAuthServices.signUp(
      username,
      email,
      password,
      birthDate,
      firstName,
      lastName
    )

    res.send({ message: 'Usuario creado con éxito' })
  } catch (error) {
    return res.status(400).send(error)
  }
}

exports.signOut = async (_, res) => {
  res.clearCookie('t')

  res.send({ message: 'Sesión finalizada de forma exitosa' })
}
