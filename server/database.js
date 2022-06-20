const mysql2 = require('mysql2/promise')
require('dotenv').config()

module.exports = mysql2.createPool({
  multipleStatements: true,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
})
