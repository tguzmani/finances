const express = require('express')
const router = express.Router()
const usersController = require('./users.controller')
const usersAuthController = require('./users.auth.controller')

const hasToken = require('../middleware/hasToken')

router.get('/profile', [hasToken], usersController.readProfile)

// Auth
router.post('/sign-up', usersAuthController.signUp)
router.post('/sign-in', usersAuthController.signIn)
router.post('/sign-out', [hasToken], usersAuthController.signOut)

module.exports = router
