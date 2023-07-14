const { validationResult } = require('express-validator')

const validate = (req, res, next) => {
  const errors = validationResult(req)

  console.log('errors', JSON.stringify(errors))

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }

  next()
}

module.exports = validate
