const entriesRepository = require('./entries.repository')

exports.createEntry = async (date, description) => {
  return await entriesRepository.createEntry(date, description)
}

exports.readEntries = async () => {
  return await entriesRepository.readEntries()
}

exports.readEntry = async entryId => {
  return await entriesRepository.readEntry(entryId)
}

exports.updateEntry = async (entryId, date, description) => {
  await entriesRepository.updateEntry(entryId, date, description)
}

exports.deleteEntry = async entryId => {
  await entriesRepository.deleteEntry(entryId)
}
