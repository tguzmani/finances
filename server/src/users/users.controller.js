const usersServices = require('./users.services')

exports.readProfile = async (req, res) => {
  try {
    const users = await usersServices.readUserById(req.userId)

    res.send(users)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}
