const entriesServices = require('./entries.services')

exports.createEntry = async (req, res) => {
  const { date, description } = req.body

  try {
    const entryId = await entriesServices.createEntry(date, description)
    const entry = await entriesServices.readEntry(entryId)

    res.send(entry)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.readEntries = async (req, res) => {
  const { userId } = req
  try {
    const entries = await entriesServices.readEntries(userId)

    res.send(entries)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.updateEntry = async (req, res) => {
  const { entryId } = req.params
  const { date, description } = req.body

  try {
    await entriesServices.updateEntry(entryId, date, description)
    const entry = await entriesServices.readEntry(entryId)

    res.send(entry)
  } catch (error) {
    return res.status(400).send(error.stack)
  }
}

exports.deleteEntry = async (req, res) => {
  const { entryId } = req.params

  try {
    await entriesServices.deleteEntry(entryId)

    res.send('Entry successfully deleted')
  } catch (error) {
    return res.status(400).send(error.stack)
  }
  await entriesServices.deleteEntry(entryId)
}
