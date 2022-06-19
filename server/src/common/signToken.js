const jwt = require('jsonwebtoken')

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '1h',
  })
}

module.exports = signToken
