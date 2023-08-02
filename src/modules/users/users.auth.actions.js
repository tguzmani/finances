import { action } from 'easy-peasy'

const usersAuthActions = {
  setUser: action((state, user) => {
    state.user = { ...user, settings: { hideAmounts: false, theme: 'light' } }
    state.isAuthenticated = true
  }),

  unsetUser: action((state, user) => {
    state.user = undefined
    state.isAuthenticated = false
  }),

  setLoading: action((state, loading) => {
    state.loading = loading
  }),

  // TODO: esto va aca?
  toggleHideAmounts: action(state => {
    state.user = {
      ...state.user,
      settings: {
        hideAmounts: !state.user.settings.hideAmounts,
        theme: 'light',
      },
    }
  }),
}

export default usersAuthActions
