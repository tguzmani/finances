class Exception extends Error {
  constructor(domain, message, description = undefined, code = 400) {
    super()
    this.message = message
    this.description = description
  }
}

module.exports = Exception
