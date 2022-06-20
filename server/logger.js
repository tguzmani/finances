const morgan = require('morgan')
const fs = require('fs')
const path = require('path')

const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')

dayjs.extend(utc)
dayjs.extend(timezone)

morgan.token('date', (req, res) => dayjs().tz('America/Caracas').format())

morgan.format(
  'monitor',
  '[:date] :remote-addr ":method :url HTTP/:http-version" :status - :response-time ms'
)

module.exports = morgan('monitor')
