import { createStore } from 'easy-peasy'

import auth from '../modules/users/users.auth.store'
import accounts from '../modules/accounts/accounts.store'
import registers from '../modules/registers/registers.store'

const store = createStore({
  auth,
  accounts,
  registers,
})

export default store
