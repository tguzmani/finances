const rowsServices = require('./rows.services')

exports.readRows = async (req, res) => {
  try {
    const rows = await rowsServices.readRows(req.userId)

    res.send(rows)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createRow = async (req, res) => {
  try {
    const row = await rowsServices.createRow(req.body)
    res.send(row)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.createManyRows = async (req, res) => {
  try {
    const row = await rowsServices.createManyRows(req.body)

    res.send(row)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updateRow = async (req, res) => {
  const { rowId } = req.params

  try {
    const row = await rowsServices.updateRow(rowId, req.body)
    res.send(row)
  } catch (error) {
    return res.status(400).send(error.message)
  }
}

exports.deleteRow = async (req, res) => {
  const { rowId } = req.params

  try {
    const row = await rowsServices.deleteRow(rowId)
    res.send(row)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}
