const Row = require('./rows.model')

const readRow = async rowId => {
  return await Row.findByPk(rowId)
}

exports.readRows = async userId => {
  return await Row.findAll({ where: { userId } })
}

exports.createRow = async row => {
  return await Row.create(row)
}

exports.createManyRows = async rows => {
  console.log('rows', rows)
  return await Row.bulkCreate(rows)
}

exports.updateRow = async (rowId, row) => {
  await Row.update(row, { where: { id: rowId } })

  return await readRow(rowId)
}

exports.deleteRow = async rowId => {
  const row = await readRow(rowId)

  await Row.destroy({ where: { id: rowId } })

  return row
}
