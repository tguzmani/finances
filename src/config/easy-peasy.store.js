import { createStore } from 'easy-peasy'

import auth from 'modules/users/users.auth.store'
import accounts from 'modules/accounts/accounts.store'
import registers from 'modules/registers/registers.store'
import categories from 'modules/categories/categories.store'
import subcategories from 'modules/subcategories/subcategories.store'
import periods from 'modules/periods/periods.store'

const store = createStore({
  auth,
  accounts,
  registers,
  categories,
  subcategories,
  periods,
})

export default store
