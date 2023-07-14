const dayjs = require('dayjs')
var customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)

const rowsParser = require('../rows/rows.parser')
const RegistersException = require('./registers.exception')

const parseDate = date => {
  if (date.match(/^[0-9]{2}$/)) return dayjs(date, 'DD').format()
  if (date.match(/^[0-9]{2}-[0-9]{2}$/)) return dayjs(date, 'MM-DD').format()

  return dayjs(date).format()
}

exports.parseRegisterByScript = async script => {
  let register = {}
  var rows = []
  var error = undefined

  const scriptLines = script
    .split('\n')
    .filter(line => line !== '')
    .map(line => line.split(', '))

  scriptLines.forEach(async (line, index) => {
    const directive = line[0]

    switch (directive) {
      case 'date':
        register.date = line[1]
        break

      case 'description':
        register.description = line.slice(1).join(', ')
        break

      case 'debit':
      case 'credit':
        rows.push(line)
        break

      default:
        error = `Invalid directive '${directive}' in line ${index + 1}`
    }
  })

  if (error) throw new RegistersException(error)

  rows = await Promise.all(
    rows.map(async row => await rowsParser.parseRowFromScriptLine(row))
  )

  // const debits = rows
  //   .filter(row => row.type === 'debit')
  //   .map(row => parseFloat(row.amount))

  // const credits = rows
  //   .filter(row => row.type === 'credit')
  //   .map(row => parseFloat(row.amount))

  // const totalDebit = debits.reduce((total, value) => (total += value), 0)
  // const totalCredit = credits.reduce((total, value) => (total += value), 0)

  return { ...register, rows }
}
