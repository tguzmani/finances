const { queryOne, query, command, insert } = require('../common/repository')
const entriesQueries = require('./entries.queries')

exports.createEntry = async (date, description) => {
  return await insert(entriesQueries.CREATE_ENTRY, [date, description])
}

exports.readEntries = async userId => {
  return await query(entriesQueries.READ_ENTRIES, [userId])
}

exports.readEntry = async entryId => {
  return await queryOne(entriesQueries.READ_ENTRY, [entryId])
}

exports.updateEntry = async (entryId, date, description) => {
  await command(entriesQueries.UPDATE_ENTRY, [date, description, entryId])
}

exports.deleteEntry = async entryId => {
  await command(entriesQueries.DELETE_ENTRY, [entryId])
}
