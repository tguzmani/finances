const dayjs = require('dayjs')
var customParseFormat = require('dayjs/plugin/customParseFormat')
dayjs.extend(customParseFormat)

const initialDate = dayjs().startOf('month').format()
const endDate = dayjs().endOf('month').subtract(1, 'day').format()

console.log(initialDate)
console.log(endDate)

console.log(dayjs('20', 'DD').format())
