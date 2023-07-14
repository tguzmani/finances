const rowsRepository = require('./rows.repository')

exports.readRows = async userId => {
  return await rowsRepository.readRows(userId)
}

exports.createRow = async row => {
  return await rowsRepository.createRow(row)
}

exports.createManyRows = async (rows, registerId) => {
  const newRows = rows.map(row => ({ ...row, registerId }))

  return await rowsRepository.createManyRows(newRows)
}

exports.updateRow = async (rowId, row) => {
  return await rowsRepository.updateRow(rowId, row)
}

exports.deleteRow = async rowId => {
  return await rowsRepository.deleteRow(rowId)
}
