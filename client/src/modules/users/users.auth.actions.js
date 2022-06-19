import UsersAuthRepository from './users.auth.repository'
import usersAuthTypes from './users.auth.types'

const usersAuthRepository = new UsersAuthRepository()

export const setLoading =
  (loading = true) =>
  dispatch =>
    dispatch({ type: usersAuthTypes.LOADING, payload: loading })

export const signIn = credentials => async dispatch => {
  setLoading()(dispatch)

  try {
    const user = await usersAuthRepository.signIn(credentials)
    dispatch({ type: usersAuthTypes.SIGN_IN, payload: user })
  } catch (error) {
    dispatch({
      type: usersAuthTypes.ERROR,
      payload: error.response.data.message,
    })
  }
}

export const readUserById = () => async dispatch => {
  setLoading()(dispatch)

  try {
    const user = await usersAuthRepository.readUserById()
    dispatch({ type: usersAuthTypes.READ_USER_BY_ID, payload: user })
  } catch (error) {
    dispatch({
      type: usersAuthTypes.ERROR,
      payload: error.response.data.message,
    })
  }
}

export const signUp = user => async dispatch => {
  setLoading()(dispatch)

  try {
    await usersAuthRepository.signUp(user)
    dispatch({ type: usersAuthTypes.SIGN_UP })
  } catch (error) {
    dispatch({
      type: usersAuthTypes.ERROR,
      payload: error.response.data.message,
    })
  }
}

export const signOut = () => async dispatch => {
  setLoading()(dispatch)

  try {
    const user = await usersAuthRepository.signOut()
    dispatch({ type: usersAuthTypes.SIGN_OUT, payload: user })
  } catch (error) {
    dispatch({
      type: usersAuthTypes.ERROR,
      payload: error.response.data.message,
    })
  }
}
