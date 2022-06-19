import { combineReducers } from 'redux'

import auth from '../modules/users/users.auth.reducer'

export default combineReducers({
  auth,
})
