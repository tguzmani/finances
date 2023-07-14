const connection = require('../../database')

const repository = {
  async queryOne(query, params) {
    const [rows] = await connection.query(query, params)

    return rows.pop()
  },

  async query(query, params) {
    const [rows] = await connection.query(query, params)

    return rows
  },

  async command(query, params) {
    await connection.query(query, params)
  },

  async insert(query, params) {
    const [rows] = await connection.query(query, params)

    return rows.insertId
  },
}

module.exports = repository
