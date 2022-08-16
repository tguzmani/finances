import { createStore } from 'easy-peasy'

import auth from '../modules/users/users.auth.store'
import accounts from '../modules/accounts/accounts.store'

const store = createStore({
  auth,
  accounts,
})

export default store
