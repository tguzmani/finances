import { computed } from 'easy-peasy'
import usersAuthActions from './users.auth.actions'
import usersAuthThunks from './users.auth.thunks'

const authStore = {
  user: undefined,
  isAuthenticated: false,
  loading: true,

  hideAmounts: computed(state => state?.user?.settings?.hideAmounts),

  ...usersAuthActions,
  ...usersAuthThunks,
}

export default authStore
