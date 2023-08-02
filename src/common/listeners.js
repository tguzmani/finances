import { action, actionOn } from 'easy-peasy'

export const startLoading = (...actionsNames) => {
  const actionsOnStart = actions =>
    actionsNames.map(actionName => actions[actionName].startType)

  return {
    startLoading: actionOn(
      actions => actionsOnStart(actions),
      state => {
        state.loading = true
      }
    ),
  }
}

export const stopLoading = (...actionsNames) => {
  const actionsOnSuccess = actions =>
    actionsNames.map(actionName => actions[actionName].successType)

  return {
    stopLoading: actionOn(
      actions => actionsOnSuccess(actions),
      state => {
        state.loading = false
        state.error = undefined
      }
    ),
  }
}

export const setError = (...actionsNames) => {
  const actionsOnFailure = actions =>
    actionsNames.map(actionName => actions[actionName].failType)

  return {
    setError: actionOn(
      actions => actionsOnFailure(actions),
      (state, target) => {
        state.loading = false
        state.error = target.error.response.data.message
      }
    ),
  }
}
