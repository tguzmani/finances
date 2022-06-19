const express = require('express')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const { monitor, csv } = require('./logger')

require('dotenv').config()

const useRoute = entity => {
  app.use(`/api/${entity}`, require(`./src/${entity}/${entity}.routes`))
}

// App initialization
const app = express()

// Middleware
app.use(express.json({ extended: false }))
app.use(monitor)
app.use(cookieParser())
app.use(
  cors({
    origin: ['http://localhost:3000'],
    credentials: true,
  })
)

// Routes Middleware
routes = ['users']

routes.forEach(route => useRoute(route))

// Listen
const port = process.env.PORT || 5000

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`)
})
