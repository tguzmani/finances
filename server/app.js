const express = require('express')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const { monitor, csv } = require('./logger')
const validate = require('./src/middleware/validate')
const database = require('./src/config/database')

require('dotenv').config()

const useRoute = entity =>
  app.use(`/api/${entity}`, require(`./src/${entity}/${entity}.routes`))

const useModel = entity => {
  require(`./src/${entity}/${entity}.model`)
}

const useJunctionModel = (entity, junction) => {
  require(`./src/${entity}/${junction}.model`)
}

// App initialization
const app = express()

// Middleware
app.use(express.json({ extended: false }))
app.use(monitor)
app.use(cookieParser())
app.use(
  cors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  })
)

// Adding routes and models
entities = [
  'users',
  'accounts',
  'categories',
  'subcategories',
  'periods',
  'registers',
  'rows',
]

entities.forEach(entity => {
  useRoute(entity)
  useModel(entity)
})

useJunctionModel('accounts', 'accountsPeriods')

// Synchronize database
database
  .sync({ alter: true })
  .then(() => console.log('Database synchronized'))
  .catch(error => {
    throw Error(`Error in database synchronization: ${error.message}`)
  })

// Listen
const port = process.env.PORT || 5000

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
})
