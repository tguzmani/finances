import { action } from 'easy-peasy'

const usersAuthActions = {
  setUser: action((state, user) => {
    state.user = { ...user, settings: { hideAmounts: false, theme: 'light' } }
    state.isAuthenticated = true
    state.loading = false
  }),

  unsetUser: action((state, user) => {
    state.user = undefined
    state.isAuthenticated = false
    state.loading = false
  }),

  setLoading: action((state, loading) => {
    state.loading = loading
  }),
}

export default usersAuthActions
