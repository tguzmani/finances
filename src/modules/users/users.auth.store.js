import usersAuthActions from './users.auth.actions'
import usersAuthThunks from './users.auth.thunks'

const authStore = {
  user: undefined,
  isAuthenticated: false,
  loading: true,

  ...usersAuthActions,
  ...usersAuthThunks,
}

export default authStore
