import { computed } from 'easy-peasy'
import usersAuthActions from './users.auth.actions'
import usersAuthThunks from './users.auth.thunks'
import usersAuthListeners from './users.auth.listeners'

const authStore = {
  user: undefined,
  isAuthenticated: false,
  loading: true,
  error: undefined,

  hideAmounts: computed(state => state?.user?.settings?.hideAmounts),

  ...usersAuthActions,
  ...usersAuthThunks,
  ...usersAuthListeners,
}

export default authStore
